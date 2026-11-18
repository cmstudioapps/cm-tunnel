import { spawn, ChildProcess } from "child_process";
import { Provider, ProviderOptions, TunnelResult } from "../Provider.js";

export type CloudflareMode = "quick" | "named";

export interface CloudflareOptions {
  /** Modo do túnel: "quick" (padrão) ou "named" */
  mode?: CloudflareMode;
  /** Domínio personalizado para Named Tunnels (ex: "api.meudominio.com.br") */
  domain?: string;
  /** ID do túnel Cloudflare previamente criado */
  tunnelId?: string;
  /** Nome do túnel Cloudflare (alternativa ao tunnelId) */
  tunnelName?: string;
  /** Caminho para o arquivo de credenciais do túnel (.json) */
  credentialsFile?: string;
  /** Caminho para o executável cloudflared (se não estiver no PATH) */
  cloudflaredPath?: string;
  /** Timeout em ms para aguardar a inicialização (padrão: 30000) */
  timeout?: number;
}

interface CloudflareProviderOptions extends ProviderOptions {
  cloudflare?: CloudflareOptions;
}

export default class CloudflareProvider extends Provider {
  private cp: ChildProcess | null = null;
  private urlRegex = /(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/;
  private cloudflareOpts: CloudflareOptions;
  private mode: CloudflareMode;

  constructor(options: CloudflareProviderOptions) {
    super(options);
    this.cloudflareOpts = options.cloudflare || {};
    this.mode = this.cloudflareOpts.mode || "quick";

    // Se o usuário forneceu domain ou tunnelId sem especificar mode, assume "named"
    if (
      this.mode === "quick" &&
      (this.cloudflareOpts.domain || this.cloudflareOpts.tunnelId || this.cloudflareOpts.tunnelName)
    ) {
      this.mode = "named";
    }
  }

  private get executable(): string {
    return this.cloudflareOpts.cloudflaredPath || "cloudflared";
  }

  private get timeout(): number {
    return this.cloudflareOpts.timeout || 30000;
  }

  /**
   * Valida as opções antes de iniciar, lançando erros claros.
   */
  private validateOptions(): void {
    if (this.mode === "named") {
      if (!this.cloudflareOpts.tunnelId && !this.cloudflareOpts.tunnelName) {
        throw new Error(
          'Cloudflare Named Tunnel requer "tunnelId" ou "tunnelName". ' +
          'Configure nas opções: cloudflare: { tunnelId: "...", domain: "..." }'
        );
      }
      if (!this.cloudflareOpts.domain) {
        throw new Error(
          'Cloudflare Named Tunnel requer "domain" para identificar a URL pública. ' +
          'Configure nas opções: cloudflare: { domain: "api.meudominio.com.br" }'
        );
      }
    }
  }

  /**
   * Monta os argumentos do cloudflared conforme o modo.
   */
  private buildArgs(): string[] {
    if (this.mode === "named") {
      const args = ["tunnel"];

      if (this.cloudflareOpts.credentialsFile) {
        args.push("--credentials-file", this.cloudflareOpts.credentialsFile);
      }

      args.push("--url", `http://localhost:${this.port}`);

      args.push("run");

      if (this.cloudflareOpts.tunnelId) {
        args.push(this.cloudflareOpts.tunnelId);
      } else if (this.cloudflareOpts.tunnelName) {
        args.push(this.cloudflareOpts.tunnelName);
      }

      return args;
    }

    // Modo quick (padrão) — mantém o comportamento original
    return ["tunnel", "--url", `http://localhost:${this.port}`];
  }

  start(): Promise<TunnelResult> {
    this.validateOptions();

    return new Promise((resolve, reject) => {
      let isResolved = false;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
      };

      const makeResult = (url: string): TunnelResult => ({
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
          const err = new Error(
            `Timeout: Cloudflare Tunnel não iniciou em ${this.timeout / 1000}s. ` +
            `Verifique se o cloudflared está configurado corretamente.`
          );
          this.stop();
          reject(err);
        }
      }, this.timeout);

      try {
        this.cp = spawn(this.executable, this.buildArgs());
      } catch (err: any) {
        cleanup();
        reject(new Error(`Falha ao executar cloudflared: ${err.message}`));
        return;
      }

      this.cp.on("error", (err: any) => {
        cleanup();
        if (err.code === "ENOENT") {
          const errorMsg =
            this.cloudflareOpts.cloudflaredPath
              ? `Cloudflared não encontrado no caminho especificado: "${this.cloudflareOpts.cloudflaredPath}". Verifique se o caminho está correto.`
              : "Cloudflared não encontrado. Por favor, instale-o a partir de https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/";
          if (!isResolved) {
            isResolved = true;
            reject(new Error(errorMsg));
          } else {
            this.emit("error", new Error(errorMsg));
          }
        } else {
          if (!isResolved) {
            isResolved = true;
            reject(err);
          } else {
            this.emit("error", err);
          }
        }
      });

      // Escuta em stderr (cloudflared emite logs em stderr)
      const handleOutput = (data: Buffer) => {
        const text = data.toString();

        if (this.mode === "quick") {
          // Quick tunnel: busca a URL trycloudflare.com na saída
          const match = text.match(this.urlRegex);
          if (match && match[1]) {
            const url = match[1];
            if (!isResolved) {
              isResolved = true;
              cleanup();
              this.emit("ready", url);
              resolve(makeResult(url));
            }
          }
        } else {
          // Named tunnel: detecta que a conexão foi estabelecida
          // O cloudflared emite "Registered tunnel connection" ou "Connection ... registered"
          // quando está pronto para aceitar tráfego
          if (
            text.includes("Registered tunnel connection") ||
            text.includes("registered connIndex=") ||
            (text.includes("Connection") && text.includes("registered"))
          ) {
            if (!isResolved) {
              isResolved = true;
              cleanup();
              const url = `https://${this.cloudflareOpts.domain}`;
              this.emit("ready", url);
              resolve(makeResult(url));
            }
          }
        }

        // Detecta erros conhecidos nos dois modos
        const lowerText = text.toLowerCase();

        if (lowerText.includes("connection refused")) {
          const err = new Error(
            `A porta ${this.port} não possui nenhum servidor ativo.`,
          );
          if (!isResolved) {
            cleanup();
            isResolved = true;
            reject(err);
            this.stop();
          } else {
            this.emit("error", err);
          }
        }

        if (lowerText.includes("tunnel credentials file") && lowerText.includes("not found")) {
          const err = new Error(
            "Arquivo de credenciais do túnel não encontrado. " +
            "Verifique o caminho em 'credentialsFile' ou configure o túnel com: cloudflared tunnel login"
          );
          if (!isResolved) {
            cleanup();
            isResolved = true;
            reject(err);
            this.stop();
          } else {
            this.emit("error", err);
          }
        }

        if (lowerText.includes("tunnel not found") || lowerText.includes("does not exist")) {
          const err = new Error(
            `Túnel "${this.cloudflareOpts.tunnelId || this.cloudflareOpts.tunnelName}" não encontrado. ` +
            "Verifique se o ID ou nome do túnel está correto."
          );
          if (!isResolved) {
            cleanup();
            isResolved = true;
            reject(err);
            this.stop();
          } else {
            this.emit("error", err);
          }
        }

        if (lowerText.includes("error") && lowerText.includes("credential")) {
          const err = new Error(
            "Credenciais do túnel Cloudflare inválidas. Reconfigure com: cloudflared tunnel login"
          );
          if (!isResolved) {
            cleanup();
            isResolved = true;
            reject(err);
            this.stop();
          } else {
            this.emit("error", err);
          }
        }
      };

      this.cp.stderr?.on("data", handleOutput);
      this.cp.stdout?.on("data", handleOutput);

      this.cp.on("close", (code) => {
        cleanup();
        if (!isResolved && code !== 0) {
          isResolved = true;
          reject(
            new Error(
              `Falha ao iniciar o túnel. Cloudflared encerrou com código ${code}.`,
            ),
          );
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
