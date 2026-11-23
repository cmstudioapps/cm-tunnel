import { spawn } from "child_process";
import { existsSync } from "fs";
import { basename, extname } from "path";
import { Provider } from "../Provider.js";
/**
 * Remove tokens e segredos de uma string de log/erro.
 */
function sanitizeOutput(text, token) {
    let sanitized = text;
    if (token && token.length > 8) {
        sanitized = sanitized.replace(new RegExp(escapeRegex(token), "g"), "[TOKEN OCULTO]");
    }
    // Remove padrões comuns de JWT tokens em logs do cloudflared
    sanitized = sanitized.replace(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[TOKEN OCULTO]");
    return sanitized;
}
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * Valida o arquivo de credenciais do túnel Cloudflare.
 *
 * O cloudflared exige o JSON gerado por `cloudflared tunnel create`.
 * O cert.pem gerado por `cloudflared tunnel login` serve apenas para
 * gerenciar túneis (criar, listar, apagar) e não pode ser usado no `run`.
 */
export function validateCredentialsFile(file) {
    if (extname(file).toLowerCase() !== ".json") {
        throw new Error(`credentialsFile inválido: "${file}". O cloudflared exige o arquivo .json de credenciais do túnel ` +
            `(ex: ~/.cloudflared/<tunnel-id>.json), mas foi informado "${basename(file)}". ` +
            'O cert.pem gerado por "cloudflared tunnel login" não serve para executar o túnel. ' +
            'Gere as credenciais com "cloudflared tunnel create" ou use autenticação por token.');
    }
    if (!existsSync(file)) {
        throw new Error(`Arquivo de credenciais não encontrado: "${file}". ` +
            "Verifique o caminho ou use autenticação por token.");
    }
}
export default class CloudflareProvider extends Provider {
    cp = null;
    urlRegex = /(https:\/\/([a-zA-Z0-9-]+)\.trycloudflare\.com)/;
    cloudflareOpts;
    mode;
    /** Últimas linhas emitidas pelo cloudflared, usadas para enriquecer erros. */
    lastOutput = "";
    constructor(options) {
        super(options);
        this.cloudflareOpts = options.cloudflare || {};
        this.mode = this.resolveMode();
    }
    /**
     * Determina o modo efetivo com base nas opções fornecidas.
     */
    resolveMode() {
        if (this.cloudflareOpts.mode) {
            return this.cloudflareOpts.mode;
        }
        if (this.cloudflareOpts.token ||
            this.cloudflareOpts.tunnelId ||
            this.cloudflareOpts.tunnelName ||
            this.cloudflareOpts.credentialsFile ||
            this.cloudflareOpts.domain) {
            return "named";
        }
        return "quick";
    }
    get executable() {
        return this.cloudflareOpts.cloudflaredPath || "cloudflared";
    }
    get timeoutMs() {
        return this.cloudflareOpts.timeout || 30000;
    }
    get protocol() {
        return this.cloudflareOpts.protocol || "https";
    }
    /**
     * Valida as opções antes de iniciar, lançando erros claros e específicos.
     */
    validateOptions() {
        if (this.mode === "named") {
            const hasToken = !!this.cloudflareOpts.token;
            const hasCredentials = !!this.cloudflareOpts.credentialsFile;
            const hasTunnelRef = !!(this.cloudflareOpts.tunnelId || this.cloudflareOpts.tunnelName);
            if (!hasToken) {
                if (!hasTunnelRef) {
                    throw new Error('Cloudflare Named Tunnel requer "token" ou "tunnelId"/"tunnelName". ' +
                        "Use token: process.env.CLOUDFLARE_TOKEN ou forneça tunnelId com credentialsFile.");
                }
                if (!hasCredentials) {
                    throw new Error("Cloudflare Named Tunnel sem token requer credentialsFile. " +
                        "Forneça o caminho do arquivo JSON de credenciais ou use autenticação por token.");
                }
            }
            // Validar existência e formato do arquivo de credenciais quando informado
            if (hasCredentials) {
                validateCredentialsFile(this.cloudflareOpts.credentialsFile);
            }
            // Token e credenciais não devem ser usados simultaneamente
            if (hasToken && hasCredentials) {
                throw new Error("Não utilize token e credentialsFile simultaneamente. Escolha um método de autenticação.");
            }
        }
    }
    /**
     * Monta os argumentos do cloudflared conforme o modo e método de autenticação.
     *
     * Quick Tunnel:
     *   cloudflared tunnel --url http://localhost:PORT
     *
     * Named Tunnel com token:
     *   cloudflared tunnel --url http://localhost:PORT run --token <TOKEN>
     *
     * Named Tunnel com credenciais:
     *   cloudflared tunnel --credentials-file <FILE> --url http://localhost:PORT run <TUNNEL_ID|NAME>
     */
    buildArgs() {
        if (this.mode === "named") {
            if (this.cloudflareOpts.token) {
                return [
                    "tunnel",
                    "--url", `http://localhost:${this.port}`,
                    "run",
                    "--token", this.cloudflareOpts.token,
                ];
            }
            // Credentials mode
            const args = ["tunnel"];
            if (this.cloudflareOpts.credentialsFile) {
                args.push("--credentials-file", this.cloudflareOpts.credentialsFile);
            }
            args.push("--url", `http://localhost:${this.port}`);
            args.push("run");
            if (this.cloudflareOpts.tunnelId) {
                args.push(this.cloudflareOpts.tunnelId);
            }
            else if (this.cloudflareOpts.tunnelName) {
                args.push(this.cloudflareOpts.tunnelName);
            }
            return args;
        }
        // Quick Tunnel
        return ["tunnel", "--url", `http://localhost:${this.port}`];
    }
    /**
     * Constrói a URL pública do túnel named.
     */
    buildNamedUrl() {
        if (this.cloudflareOpts.domain) {
            return `${this.protocol}://${this.cloudflareOpts.domain}`;
        }
        const tunnelRef = this.cloudflareOpts.tunnelId || this.cloudflareOpts.tunnelName || "tunnel";
        return `${this.protocol}://${tunnelRef}.cfargotunnel.com`;
    }
    start() {
        this.validateOptions();
        return new Promise((resolve, reject) => {
            let isResolved = false;
            let timeoutId = null;
            const token = this.cloudflareOpts.token;
            const cleanup = () => {
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
            };
            const finish = (err) => {
                if (!isResolved) {
                    isResolved = true;
                    cleanup();
                    reject(err);
                    this.stop();
                }
                else {
                    this.emit("error", err);
                }
            };
            const makeResult = (url) => ({
                provider: "cloudflare",
                url,
                port: this.port,
                stop: this.stop.bind(this),
                process: this.cp,
            });
            // Timeout de inicialização
            timeoutId = setTimeout(() => {
                if (!isResolved) {
                    isResolved = true;
                    const err = new Error(`Timeout: Cloudflare Tunnel não iniciou em ${this.timeoutMs / 1000}s. ` +
                        "Verifique se o cloudflared está configurado corretamente e se as credenciais são válidas.");
                    this.stop();
                    reject(err);
                }
            }, this.timeoutMs);
            // Spawn do processo
            try {
                this.cp = spawn(this.executable, this.buildArgs());
            }
            catch (err) {
                cleanup();
                reject(new Error(`Falha ao executar cloudflared: ${sanitizeOutput(err.message, token)}`));
                return;
            }
            // Erro de spawn (ENOENT, permissão, etc.)
            this.cp.on("error", (err) => {
                cleanup();
                if (err.code === "ENOENT") {
                    const errorMsg = this.cloudflareOpts.cloudflaredPath
                        ? `Cloudflared não encontrado em: "${this.cloudflareOpts.cloudflaredPath}". Verifique se o caminho está correto.`
                        : "Cloudflared não encontrado. Instale a partir de: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/";
                    finish(new Error(errorMsg));
                }
                else {
                    finish(new Error(sanitizeOutput(err.message, token)));
                }
            });
            // Handler unificado para stdout e stderr
            const handleOutput = (data) => {
                const text = data.toString();
                const lowerText = text.toLowerCase();
                // Guarda as últimas saídas para enriquecer a mensagem de erro caso
                // o processo encerre sem que nenhum padrão conhecido seja detectado.
                const sanitized = sanitizeOutput(text, token);
                this.options.onLog?.(sanitized);
                this.lastOutput = (this.lastOutput + sanitized).slice(-4000);
                // ---- Detecção de sucesso ----
                if (this.mode === "quick") {
                    const match = text.match(this.urlRegex);
                    // "api.trycloudflare.com" é o endpoint da API da Cloudflare e aparece
                    // justamente em mensagens de erro (ex: falha ao criar o quick tunnel).
                    // Só a URL com subdomínio aleatório é a URL pública do túnel.
                    if (match && match[1] && match[2].toLowerCase() !== "api" && !isResolved) {
                        isResolved = true;
                        cleanup();
                        const url = match[1];
                        this.emit("ready", url);
                        resolve(makeResult(url));
                        return;
                    }
                }
                else {
                    // Named tunnel: detecta conexão estabelecida
                    if ((text.includes("Registered tunnel connection") ||
                        text.includes("registered connIndex=") ||
                        (text.includes("Connection") && text.includes("registered"))) &&
                        !isResolved) {
                        isResolved = true;
                        cleanup();
                        const url = this.buildNamedUrl();
                        this.emit("ready", url);
                        resolve(makeResult(url));
                        return;
                    }
                }
                // ---- Detecção de erros específicos ----
                if (lowerText.includes("connection refused")) {
                    finish(new Error(`A porta ${this.port} não possui nenhum servidor ativo. Inicie seu servidor antes de criar o túnel.`));
                    return;
                }
                if (lowerText.includes("should be .json") ||
                    (lowerText.includes("credentials file") && lowerText.includes(".pem")) ||
                    lowerText.includes("cert.pem")) {
                    finish(new Error("credentialsFile inválido: o cloudflared exige o arquivo .json de credenciais do túnel, não o cert.pem. " +
                        'Gere as credenciais com "cloudflared tunnel create" ou use autenticação por token.'));
                    return;
                }
                if (lowerText.includes("invalid token") ||
                    lowerText.includes("token is expired") ||
                    lowerText.includes("failed to parse token") ||
                    lowerText.includes("error parsing token")) {
                    finish(new Error("Token do túnel Cloudflare inválido ou expirado. " +
                        "Gere um novo token na dashboard da Cloudflare ou com: cloudflared tunnel token <TUNNEL_NAME>"));
                    return;
                }
                if ((lowerText.includes("error") && lowerText.includes("credential")) ||
                    lowerText.includes("unauthorized") ||
                    lowerText.includes("authentication error")) {
                    finish(new Error("Credenciais do túnel Cloudflare inválidas. " +
                        "Verifique o arquivo de credenciais ou reconfigure com: cloudflared tunnel login"));
                    return;
                }
                if (lowerText.includes("credentials") && lowerText.includes("not found")) {
                    finish(new Error("Arquivo de credenciais do túnel não encontrado pelo cloudflared. " +
                        "Verifique o caminho em credentialsFile ou use autenticação por token."));
                    return;
                }
                if (lowerText.includes("tunnel not found") || lowerText.includes("does not exist")) {
                    finish(new Error(`Túnel "${this.cloudflareOpts.tunnelId || this.cloudflareOpts.tunnelName}" não encontrado. ` +
                        "Verifique se o ID ou nome do túnel está correto e se ele existe na sua conta Cloudflare."));
                    return;
                }
                if (lowerText.includes("failed to connect to edge") ||
                    lowerText.includes("cannot connect to") ||
                    lowerText.includes("connection timed out") ||
                    lowerText.includes("network is unreachable")) {
                    finish(new Error("Falha na conexão com a Cloudflare. Verifique sua conexão com a internet e tente novamente."));
                    return;
                }
                if ((lowerText.includes("hostname") && lowerText.includes("not found")) ||
                    lowerText.includes("no ingress rules") ||
                    lowerText.includes("no matching ingress")) {
                    finish(new Error("Hostname ou regra de ingress não configurados para este túnel. " +
                        "Configure o Public Hostname na dashboard da Cloudflare ou no arquivo de configuração local."));
                    return;
                }
            };
            this.cp.stderr?.on("data", handleOutput);
            this.cp.stdout?.on("data", handleOutput);
            // Encerramento do processo
            this.cp.on("close", (code) => {
                cleanup();
                if (!isResolved && code !== 0) {
                    isResolved = true;
                    const details = this.lastOutput.trim();
                    reject(new Error(`Cloudflared encerrou inesperadamente (código ${code}). ` +
                        (details
                            ? `Saída do cloudflared:\n${details}`
                            : "Verifique se o cloudflared está instalado e configurado corretamente.")));
                }
                this.emit("close");
            });
        });
    }
    stop() {
        if (this.cp) {
            this.cp.kill();
            this.cp = null;
        }
    }
}
