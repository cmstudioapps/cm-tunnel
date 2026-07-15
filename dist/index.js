import { createTunnel } from "./Tunnel.js";
const tunnel = createTunnel;
tunnel.cloudflare = (options) => createTunnel({ ...options, provider: "cloudflare" });
tunnel.localtunnel = (options) => createTunnel({ ...options, provider: "localtunnel" });
export default tunnel;
