import { EventEmitter } from "events";
import { RateLimiter } from "./RateLimiter.js";
import { StaticServer } from "./StaticServer.js";
import { validateCredentialsFile } from "./providers/cloudflare.js";
/**
 * Cabeçalho confiável para o IP do cliente, conforme o provedor.
 * - Cloudflare sobrescreve `cf-connecting-ip` na borda.
 * - LocalTunnel/ngrok anexam o IP real ao final de `x-forwarded-for`.
 */
function providerClientIp(providerName) {
    if (providerName === "cloudflare") {
        return { header: "cf-connecting-ip", strategy: "first" };
    }
    return { header: "x-forwarded-for", strategy: "last" };
}
/**
 * Injeta o `clientIp` adequado ao provedor sem sobrescrever uma escolha
 * explícita do usuário (inclusive `false`).
 */
function withProviderClientIp(rateLimit, providerName) {
    const clientIp = providerClientIp(providerName);
    if (rateLimit === true) {
        return { maxRequestsPerMinute: 100, clientIp };
    }
    return rateLimit.clientIp === undefined
        ? { ...rateLimit, clientIp }
        : rateLimit;
}
/**
 * Determina o modo efetivo do Cloudflare com base nas opções.
 */
function resolveCloudflareMode(cf) {
    if (cf.mode)
        return cf.mode;
    if (cf.token || cf.tunnelId || cf.tunnelName || cf.credentialsFile || cf.domain) {
        return "named";
    }
    return "quick";
}
/**
 * Valida as opções do Cloudflare antes de carregar o provider.
 * Erros de configuração são capturados aqui, antes do spawn do processo.
 */
function validateCloudflareOptions(options) {
    if (options.provider?.toLowerCase() !== "cloudflare" || !options.cloudflare) {
        return;
    }
    const cf = options.cloudflare;
    const mode = resolveCloudflareMode(cf);
    if (mode === "named") {
        const hasToken = !!cf.token;
        const hasCredentials = !!cf.credentialsFile;
        const hasTunnelRef = !!(cf.tunnelId || cf.tunnelName);
        // Com token: não precisa de tunnelId/credenciais (token já contém tudo)
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
        // Token e credenciais não devem ser usados juntos
        if (hasToken && hasCredentials) {
            throw new Error("Não utilize token e credentialsFile simultaneamente. Escolha um método de autenticação.");
        }
        // Validar existência e formato do arquivo de credenciais quando informado
        if (hasCredentials) {
            validateCredentialsFile(cf.credentialsFile);
        }
    }
}
export async function createTunnel(options) {
    // Com `serve`, a porta é opcional: um servidor interno é iniciado em porta aleatória.
    if (!options.serve && (!options.port || isNaN(options.port))) {
        throw new Error("Porta inválida.");
    }
    if (!options.provider) {
        throw new Error("Provider inexistente.");
    }
    // Valida opções do Cloudflare antes de tentar carregar o provider
    validateCloudflareOptions(options);
    const providerName = options.provider.toLowerCase();
    // Mapa explícito de loaders: import() com variável não é resolvido por
    // bundlers/test runners (ex: Vite), além de dificultar o tree-shaking.
    const providerLoaders = {
        cloudflare: () => import("./providers/cloudflare.js"),
        localtunnel: () => import("./providers/localtunnel.js"),
        ngrok: () => import("./providers/ngrok.js"),
    };
    const loadProvider = providerLoaders[providerName];
    if (!loadProvider) {
        throw new Error(`Provider inexistente: "${providerName}".`);
    }
    const ProviderClass = (await loadProvider()).default;
    let rateLimiterInstance = null;
    let staticServerInstance = null;
    let servedPort = null;
    // A porta do usuário (ou gerada pelo StaticServer) que o túnel/proxy vai mirar
    let targetPort = options.port || 3000;
    const cleanup = () => {
        rateLimiterInstance?.stop();
        staticServerInstance?.stop();
    };
    // We wrap the result in an EventEmitter to match the required API
    const emitter = new EventEmitter();
    let started = false;
    try {
        if (options.serve) {
            staticServerInstance = new StaticServer(options.serve);
            const serveResult = await staticServerInstance.start();
            servedPort = serveResult.port;
            targetPort = serveResult.port; // O túnel ou proxy apontará para o StaticServer
        }
        if (options.rateLimit) {
            rateLimiterInstance = new RateLimiter(targetPort, withProviderClientIp(options.rateLimit, providerName));
            targetPort = await rateLimiterInstance.start(); // O túnel apontará para o proxy
        }
        const providerInstance = new ProviderClass({ ...options, port: targetPort });
        providerInstance.on("ready", (url) => {
            // Os providers emitem "ready" antes de start() resolver. Adiamos a
            // reemissão para que listeners registrados depois do await recebam o evento.
            setImmediate(() => emitter.emit("ready", url));
        });
        providerInstance.on("close", () => {
            cleanup();
            emitter.emit("close");
        });
        providerInstance.on("error", (err) => {
            // Durante a inicialização o erro já é propagado pela rejeição de start().
            // Reemitir aqui, antes de o consumidor receber o emitter, derrubaria o
            // processo com um evento "error" sem listener.
            if (started)
                emitter.emit("error", err);
        });
        const result = await providerInstance.start();
        started = true;
        // Assign properties from result to the emitter instance to conform to TunnelInstance
        Object.assign(emitter, {
            provider: result.provider,
            url: result.url,
            port: options.port ?? servedPort ?? targetPort, // Porta original, do servidor interno ou do proxy
            stop: () => {
                cleanup();
                result.stop();
            },
            process: result.process,
        });
        return emitter;
    }
    catch (err) {
        // Se o provider falhar depois que serve/rateLimit subiram, eles precisam
        // ser encerrados para não deixar portas/processos órfãos.
        cleanup();
        throw new Error(`Falha ao iniciar o túnel: ${err.message}`);
    }
}
