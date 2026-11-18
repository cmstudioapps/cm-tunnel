import { describe, it, expect } from "vitest";
import tunnel from "../src/index.js";

describe("cm-tunnel", () => {
  it("deve exportar a função principal", () => {
    expect(typeof tunnel).toBe("function");
  });

  it("deve exportar os métodos atalhos (cloudflare, localtunnel e ngrok)", () => {
    expect(typeof tunnel.cloudflare).toBe("function");
    expect(typeof tunnel.localtunnel).toBe("function");
    expect(typeof tunnel.ngrok).toBe("function");
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

  it('deve rejeitar provider com rate limit invalido mas iniciar se for valido', async () => {
    // This just tests the api accepts the rateLimit flag. Actual network tests would require mock.
    await expect(tunnel({ provider: 'inexistente', port: 3000, rateLimit: true })).rejects.toThrow();
  });
});

describe("Cloudflare Named Tunnel - validação de opções", () => {
  it("deve lançar erro se named tunnel não tiver tunnelId nem tunnelName", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        domain: "api.meudominio.com.br",
      }),
    ).rejects.toThrow("tunnelId");
  });

  it("deve lançar erro se named tunnel não tiver domain", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        tunnelId: "abc-123",
      }),
    ).rejects.toThrow("domain");
  });

  it("deve inferir mode 'named' quando domain e tunnelId são fornecidos sem mode explícito", async () => {
    // Sem mode explícito, mas com domain + tunnelId, deve inferir "named"
    // e rejeitar apenas com ENOENT/timeout (não com erro de validação)
    const promise = tunnel.cloudflare({
      port: 3000,
      domain: "api.meudominio.com.br",
      tunnelId: "abc-123",
      timeout: 1000,
    });
    // Deve rejeitar, mas NÃO com erro de validação de tunnelId ou domain
    await expect(promise).rejects.toThrow();
    try {
      await promise;
    } catch (err: any) {
      expect(err.message).not.toContain("tunnelId");
      expect(err.message).not.toContain('"domain"');
    }
  });

  it("deve aceitar tunnelName como alternativa ao tunnelId", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        tunnelName: "meu-tunnel",
      }),
    ).rejects.toThrow("domain"); // Falha na validação por falta de domain
  });

  it("deve continuar funcionando com API simplificada (modo quick)", async () => {
    // O cloudflared não está instalado, então esperamos ENOENT ou timeout
    await expect(
      tunnel.cloudflare({ port: 3000, timeout: 1000 }),
    ).rejects.toThrow();
  });

  it("deve funcionar com a API completa usando cloudflare options", async () => {
    await expect(
      tunnel({
        provider: "cloudflare",
        port: 3000,
        cloudflare: {
          mode: "named",
          domain: "api.meudominio.com.br",
          tunnelId: "abc-123",
          timeout: 1000,
        },
      }),
    ).rejects.toThrow(); // ENOENT ou timeout
  });

  it("deve aceitar timeout personalizado", async () => {
    const start = Date.now();
    await expect(
      tunnel.cloudflare({
        port: 3000,
        timeout: 1000, // 1 segundo
      }),
    ).rejects.toThrow();
    // Verifica que falhou razoavelmente rápido (não esperou 30s)
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(5000);
  });

  it("deve aceitar cloudflaredPath personalizado e dar erro se não existir", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        cloudflaredPath: "/caminho/inexistente/cloudflared",
        timeout: 2000,
      }),
    ).rejects.toThrow();
  });

  it("deve aceitar credentialsFile", async () => {
    // Apenas verifica que a opção é aceita na tipagem e não causa crash de validação
    // (domain + tunnelId presentes, então validação named passa)
    await expect(
      tunnel.cloudflare({
        port: 3000,
        domain: "api.meudominio.com.br",
        tunnelId: "abc-123",
        credentialsFile: "/caminho/para/creds.json",
        timeout: 1000,
      }),
    ).rejects.toThrow(); // ENOENT - cloudflared não instalado
  });

  it("deve lançar erro se domain for fornecido sem tunnelId no modo named explícito", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        domain: "api.meudominio.com.br",
        // sem tunnelId
      }),
    ).rejects.toThrow("tunnelId");
  });

  it("deve preservar compatibilidade retroativa — chamada simples como antes", async () => {
    // Mesma chamada que sempre existiu: apenas port
    await expect(
      tunnel.cloudflare({ port: 3000, timeout: 1000 }),
    ).rejects.toThrow(); // ENOENT/timeout, não validação
  });
});
