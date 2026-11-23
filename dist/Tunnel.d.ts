import { EventEmitter } from "events";
import { TunnelResult } from "./Provider.js";
import { RateLimitOptions } from "./RateLimiter.js";
import { ServeOptions } from "./StaticServer.js";
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
    /** Recebe a saída bruta (sanitizada) do provedor, útil para logs ao vivo. */
    onLog?: (line: string) => void;
}
export interface TunnelInstance extends TunnelResult, EventEmitter {
    on(event: "ready", listener: (url: string) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
}
export declare function createTunnel(options: TunnelOptions): Promise<TunnelInstance>;
