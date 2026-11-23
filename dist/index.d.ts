import { TunnelOptions, TunnelInstance, CloudflareOptions, CloudflareMode } from './Tunnel.js';
import { ServeOptions } from './StaticServer.js';
type OmitProvider<T> = Omit<T, "provider">;
interface CloudflareShortcutOptions extends OmitProvider<TunnelOptions> {
    /** Domínio personalizado para Named Tunnels (DNS deve estar previamente configurado na Cloudflare) */
    domain?: string;
    /** ID do túnel Cloudflare */
    tunnelId?: string;
    /** Nome do túnel Cloudflare (alternativa ao tunnelId) */
    tunnelName?: string;
    /** Token de autenticação do túnel. Recomendado usar variável de ambiente (ex: process.env.CLOUDFLARE_TOKEN) */
    token?: string;
    /** Arquivo de credenciais JSON (alternativa ao token) */
    credentialsFile?: string;
    /** Caminho do executável cloudflared */
    cloudflaredPath?: string;
    /** Timeout em ms (padrão: 30000) */
    timeout?: number;
    /** Modo: "quick" ou "named" (inferido automaticamente) */
    mode?: CloudflareMode;
    /** Protocolo da URL (padrão: "https") */
    protocol?: string;
}
interface TunnelAPI {
    (options: TunnelOptions): Promise<TunnelInstance>;
    cloudflare: (options: CloudflareShortcutOptions) => Promise<TunnelInstance>;
    localtunnel: (options: OmitProvider<TunnelOptions>) => Promise<TunnelInstance>;
    ngrok: (options: OmitProvider<TunnelOptions>) => Promise<TunnelInstance>;
    serve: (options: ServeOptions) => Promise<{
        port: number;
        url: string;
        stop: () => void;
    }>;
}
declare const tunnel: TunnelAPI;
export default tunnel;
export type { TunnelOptions, TunnelInstance, CloudflareOptions, CloudflareMode, CloudflareShortcutOptions };
