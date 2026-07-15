import { TunnelOptions, TunnelInstance } from "./Tunnel.js";
type OmitProvider<T> = Omit<T, "provider">;
interface TunnelAPI {
    (options: TunnelOptions): Promise<TunnelInstance>;
    cloudflare: (options: OmitProvider<TunnelOptions>) => Promise<TunnelInstance>;
    localtunnel: (options: OmitProvider<TunnelOptions>) => Promise<TunnelInstance>;
}
declare const tunnel: TunnelAPI;
export default tunnel;
