import localtunnel from "localtunnel";
import { Provider } from "../Provider.js";
export default class LocalTunnelProvider extends Provider {
    tunnel = null;
    constructor(options) {
        super(options);
    }
    start() {
        return new Promise(async (resolve, reject) => {
            try {
                this.tunnel = await localtunnel({ port: this.port, subdomain: this.options.subdomain });
                if (!this.tunnel.url) {
                    return reject(new Error("Falha ao obter URL do LocalTunnel."));
                }
                this.tunnel.on("close", () => {
                    this.emit("close");
                });
                this.tunnel.on("error", (err) => {
                    this.emit("error", err);
                });
                this.emit("ready", this.tunnel.url);
                resolve({
                    provider: "localtunnel",
                    url: this.tunnel.url,
                    port: this.port,
                    stop: this.stop.bind(this),
                    process: this.tunnel,
                });
            }
            catch (err) {
                reject(new Error(`Falha ao iniciar o túnel LocalTunnel: ${err.message}`));
            }
        });
    }
    stop() {
        if (this.tunnel) {
            this.tunnel.close();
            this.tunnel = null;
        }
    }
}
