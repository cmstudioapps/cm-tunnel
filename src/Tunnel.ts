import { EventEmitter } from "events";
import { Provider, TunnelResult } from "./Provider.js";
import { RateLimiter, RateLimitOptions } from "./RateLimiter.js";
import { StaticServer, ServeOptions } from "./StaticServer.js";
import type { CloudflareMode, CloudflareOptions } from "./providers/cloudflare.js";

export type { CloudflareMode, CloudflareOptions };

export interface TunnelOptions {
  provider: string;
  port?: number;
  subdomain?: string;
  authtoken?: string;
  rateLimit?: RateLimitOptions | boolean;
  serve?: ServeOptions;
  cloudflare?: CloudflareOptions;
}

export interface TunnelInstance extends TunnelResult, EventEmitter {
  on(event: "ready", listener: (url: string) => void): this;
  on(event: "close", listener: () => void): this;
  on(event: "error", listener: (err: Error) => void): this;
  // Fallback signature
  on(event: string | symbol, listener: (...args: any[]) => void): this;
}

/**
 * Valida as opções do Cloudflare antes de carregar o provider.
 * Isso evita que erros de configuração só apareçam após o spawn do processo.
 */
function validateCloudflareOptions(options: TunnelOptions): void {
  if (options.provider?.toLowerCase() !== "cloudflare" || !options.cloudflare) {
    return;
  }

  const cf = options.cloudflare;
  
  // Determina o modo efetivo
  let mode: CloudflareMode = cf.mode || "quick";
  if (mode === "quick" && (cf.domain || cf.tunnelId || cf.tunnelName)) {
    mode = "named";
  }

  if (mode === "named") {
    if (!cf.tunnelId && !cf.tunnelName) {
      throw new Error(
        'Cloudflare Named Tunnel requer "tunnelId" ou "tunnelName". ' +
        'Configure nas opções: cloudflare: { tunnelId: "...", domain: "..." }'
      );
    }
    if (!cf.domain) {
      throw new Error(
        'Cloudflare Named Tunnel requer "domain" para identificar a URL pública. ' +
        'Configure nas opções: cloudflare: { domain: "api.meudominio.com.br" }'
      );
    }
  }
}

export async function createTunnel(
  options: TunnelOptions,
): Promise<TunnelInstance> {
  if (!options.port || isNaN(options.port)) {
    throw new Error("Porta inválida.");
  }
  if (!options.provider) {
    throw new Error("Provider inexistente.");
  }

  // Valida opções do Cloudflare antes de tentar carregar o provider
  validateCloudflareOptions(options);

  const providerName = options.provider.toLowerCase();

  let ProviderClass: new (options: any) => Provider;

  try {
    // Dynamic import to load the provider dynamically based on name
    const module = await import(`./providers/${providerName}.js`);
    ProviderClass = module.default;
  } catch (err: any) {
    if (
      err.code === "ERR_MODULE_NOT_FOUND" ||
      err.message.includes("Cannot find module") ||
      err.message.includes("Unknown variable dynamic import")
    ) {
      throw new Error(`Provider inexistente: "${providerName}".`);
    }
    throw err;
  }

  let rateLimiterInstance: RateLimiter | null = null;
  let staticServerInstance: StaticServer | null = null;
  
  // A porta do usuário (ou gerada pelo StaticServer) que o túnel/proxy vai mirar
  let targetPort = options.port || 3000;

  if (options.serve) {
     staticServerInstance = new StaticServer(options.serve);
     const serveResult = await staticServerInstance.start();
     targetPort = serveResult.port; // O túnel ou proxy apontará para o StaticServer
  }

  if (options.rateLimit) {
    rateLimiterInstance = new RateLimiter(targetPort, options.rateLimit);
    targetPort = await rateLimiterInstance.start(); // O túnel apontará para o proxy
  }

  const providerInstance = new ProviderClass({ ...options, port: targetPort });

  // We wrap the result in an EventEmitter to match the required API
  const emitter = new EventEmitter() as TunnelInstance;

  providerInstance.on("ready", (url) => emitter.emit("ready", url));
  providerInstance.on("close", () => {
    rateLimiterInstance?.stop();
    staticServerInstance?.stop();
    emitter.emit("close");
  });
  providerInstance.on("error", (err) => emitter.emit("error", err));

  try {
    const result = await providerInstance.start();

    // Assign properties from result to the emitter instance to conform to TunnelInstance
    Object.assign(emitter, {
      provider: result.provider,
      url: result.url,
      port: options.port || targetPort, // Return original user port or dynamic port
      stop: () => {
         rateLimiterInstance?.stop();
         staticServerInstance?.stop();
         result.stop();
      },
      process: result.process,
    });

    return emitter;
  } catch (err: any) {
    throw new Error(`Falha ao iniciar o túnel: ${err.message}`);
  }
}
