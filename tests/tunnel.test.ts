import { describe, it, expect } from "vitest";
import tunnel from "../src/index.js";

describe("cm-tunnel", () => {
  it("deve exportar a função principal", () => {
    expect(typeof tunnel).toBe("function");
  });

  it("deve exportar os métodos atalhos (cloudflare e localtunnel)", () => {
    expect(typeof tunnel.cloudflare).toBe("function");
    expect(typeof tunnel.localtunnel).toBe("function");
  });

  it("deve lançar erro se a porta for inválida", async () => {
    await expect(tunnel({ provider: "cloudflare", port: 0 })).rejects.toThrow(
      "Porta inválida.",
    );
  });

  it("deve lançar erro se o provider não for informado", async () => {
    // @ts-expect-error testando erro em runtime
    await expect(tunnel({ port: 3000 })).rejects.toThrow(
      "Provider inexistente.",
    );
  });

  it("deve lançar erro se o provider for inexistente", async () => {
    await expect(
      tunnel({ provider: "inexistente", port: 3000 }),
    ).rejects.toThrow('Provider inexistente: "inexistente".');
  });
});
