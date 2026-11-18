import { createTunnel, TunnelOptions, TunnelInstance, CloudflareOptions, CloudflareMode } from './Tunnel.js';
import { serve, ServeOptions } from './StaticServer.js';

type OmitProvider<T> = Omit<T, "provider">;

interface CloudflareShortcutOptions extends OmitProvider<TunnelOptions> {
  /** Domínio personalizado para Named Tunnels */
  domain?: string;
  /** ID do túnel Cloudflare */
  tunnelId?: string;
  /** Nome do túnel Cloudflare */
  tunnelName?: string;
  /** Arquivo de credenciais */
  credentialsFile?: string;
  /** Caminho do executável cloudflared */
  cloudflaredPath?: string;
  /** Timeout em ms */
  timeout?: number;
  /** Modo: "quick" ou "named" */
  mode?: CloudflareMode;
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
  const { domain, tunnelId, tunnelName, credentialsFile, cloudflaredPath, timeout, mode, ...rest } = options;

  // Monta o objeto cloudflare a partir das opções de atalho
  const cloudflareOpts: CloudflareOptions = {};

  if (mode !== undefined) cloudflareOpts.mode = mode;
  if (domain !== undefined) cloudflareOpts.domain = domain;
  if (tunnelId !== undefined) cloudflareOpts.tunnelId = tunnelId;
  if (tunnelName !== undefined) cloudflareOpts.tunnelName = tunnelName;
  if (credentialsFile !== undefined) cloudflareOpts.credentialsFile = credentialsFile;
  if (cloudflaredPath !== undefined) cloudflareOpts.cloudflaredPath = cloudflaredPath;
  if (timeout !== undefined) cloudflareOpts.timeout = timeout;

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
