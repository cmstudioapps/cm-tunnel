import { createTunnel, TunnelOptions, TunnelInstance, CloudflareOptions, CloudflareMode } from './Tunnel.js';
import { serve, ServeOptions } from './StaticServer.js';

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
  serve: (options: ServeOptions) => Promise<{ port: number; url: string; stop: () => void }>;
}

const tunnel = createTunnel as TunnelAPI;

tunnel.cloudflare = (options: CloudflareShortcutOptions) => {
  const {
    domain, tunnelId, tunnelName, token,
    credentialsFile, cloudflaredPath, timeout, mode, protocol,
    ...rest
  } = options;

  // Monta o objeto cloudflare a partir das opções de atalho
  const cloudflareOpts: CloudflareOptions = {};

  if (mode !== undefined) cloudflareOpts.mode = mode;
  if (domain !== undefined) cloudflareOpts.domain = domain;
  if (tunnelId !== undefined) cloudflareOpts.tunnelId = tunnelId;
  if (tunnelName !== undefined) cloudflareOpts.tunnelName = tunnelName;
  if (token !== undefined) cloudflareOpts.token = token;
  if (credentialsFile !== undefined) cloudflareOpts.credentialsFile = credentialsFile;
  if (cloudflaredPath !== undefined) cloudflareOpts.cloudflaredPath = cloudflaredPath;
  if (timeout !== undefined) cloudflareOpts.timeout = timeout;
  if (protocol !== undefined) cloudflareOpts.protocol = protocol;

  // Merge: se o usuário já passou cloudflare: {...}, combina
  const existingCloudflare = rest.cloudflare || {};
  const mergedCloudflare = { ...existingCloudflare, ...cloudflareOpts };

  return createTunnel({
    ...rest,
    provider: 'cloudflare',
    cloudflare: Object.keys(mergedCloudflare).length > 0 ? mergedCloudflare : undefined,
  });
};

tunnel.localtunnel = (options) => createTunnel({ ...options, provider: 'localtunnel' });
tunnel.ngrok = (options) => createTunnel({ ...options, provider: 'ngrok' });
tunnel.serve = serve;

export default tunnel;
export type { TunnelOptions, TunnelInstance, CloudflareOptions, CloudflareMode, CloudflareShortcutOptions };
