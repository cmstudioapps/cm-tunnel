import { spawn, ChildProcess } from "child_process";
import { Provider, TunnelResult } from "../Provider.js";

export default class CloudflareProvider extends Provider {
  private cp: ChildProcess | null = null;
  private urlRegex = /(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/;

  constructor(port: number) {
    super(port);
  }

  start(): Promise<TunnelResult> {
    return new Promise((resolve, reject) => {
      this.cp = spawn("cloudflared", [
        "tunnel",
        "--url",
        `http://localhost:${this.port}`,
      ]);

      let isResolved = false;

      this.cp.on("error", (err: any) => {
        if (err.code === "ENOENT") {
          const errorMsg =
            "Cloudflared não encontrado. Por favor, instale-o a partir de https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/";
          if (!isResolved) {
            reject(new Error(errorMsg));
          } else {
            this.emit("error", new Error(errorMsg));
          }
        } else {
          if (!isResolved) {
            reject(err);
          } else {
            this.emit("error", err);
          }
        }
      });

      this.cp.stderr?.on("data", (data) => {
        const text = data.toString();
        const match = text.match(this.urlRegex);

        if (match && match[1]) {
          const url = match[1];
          if (!isResolved) {
            isResolved = true;
            this.emit("ready", url);
            resolve({
              provider: "cloudflare",
              url,
              port: this.port,
              stop: this.stop.bind(this),
              process: this.cp,
            });
          }
        }

        // Detect known errors like connection refused
        if (text.toLowerCase().includes("connection refused")) {
          const err = new Error(
            `A porta ${this.port} não possui nenhum servidor ativo.`,
          );
          if (!isResolved) {
            reject(err);
            this.stop();
          } else {
            this.emit("error", err);
          }
        }
      });

      this.cp.on("close", (code) => {
        if (!isResolved && code !== 0) {
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
