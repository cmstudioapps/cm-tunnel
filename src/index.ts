import { createTunnel, TunnelOptions, TunnelInstance } from "./Tunnel.js";

type OmitProvider<T> = Omit<T, "provider">;

interface TunnelAPI {
  (options: TunnelOptions): Promise<TunnelInstance>;
  cloudflare: (options: OmitProvider<TunnelOptions>) => Promise<TunnelInstance>;
  localtunnel: (
    options: OmitProvider<TunnelOptions>,
  ) => Promise<TunnelInstance>;
}

const tunnel = createTunnel as TunnelAPI;

tunnel.cloudflare = (options) =>
  createTunnel({ ...options, provider: "cloudflare" });
tunnel.localtunnel = (options) =>
  createTunnel({ ...options, provider: "localtunnel" });

export default tunnel;
