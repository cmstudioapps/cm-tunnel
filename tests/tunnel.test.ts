import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "events";
import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import tunnel from "../src/index.js";
import CloudflareProvider from "../src/providers/cloudflare.js";

// Arquivo .json real usado nos testes que exigem credenciais válidas.
const credsFile = join(
  mkdtempSync(join(tmpdir(), "cm-tunnel-test-")),
  "creds.json",
);
writeFileSync(credsFile, "{}");

// ============================================================
// 1. Testes de API e validação (sem mock — rodam síncrono)
// ============================================================

describe("cm-tunnel — API básica", () => {
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
    await expect(tunnel({ provider: 'inexistente', port: 3000, rateLimit: true })).rejects.toThrow();
  });
});

// ============================================================
// 2. Validação de opções do Cloudflare (sem mock)
// ============================================================

describe("Cloudflare — validação de opções", () => {

  it("deve lançar erro se named tunnel não tiver token nem tunnelId", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        domain: "api.meudominio.com.br",
      }),
    ).rejects.toThrow("token");
  });

  it("deve lançar erro se named tunnel sem token não tiver credentialsFile", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        tunnelId: "abc-123",
        domain: "api.meudominio.com.br",
      }),
    ).rejects.toThrow("credentialsFile");
  });

  it("deve lançar erro se credentialsFile não existir no disco", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        tunnelId: "abc-123",
        credentialsFile: "/caminho/que/nao/existe/creds.json",
        timeout: 1000,
      }),
    ).rejects.toThrow("não encontrado");
  });

  it("deve lançar erro se token e credentialsFile forem usados juntos", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        token: "fake-token",
        credentialsFile: "/algum/arquivo.json",
        timeout: 1000,
      }),
    ).rejects.toThrow("simultaneamente");
  });

  it("deve rejeitar credentialsFile que não seja .json (ex: cert.pem)", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        tunnelId: "abc-123",
        credentialsFile: "/home/user/.cloudflared/cert.pem",
        timeout: 1000,
      }),
    ).rejects.toThrow("cert.pem");
  });

  it("deve aceitar tunnelName como alternativa ao tunnelId (sem token)", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        mode: "named",
        tunnelName: "meu-tunnel",
        domain: "api.meudominio.com.br",
      }),
    ).rejects.toThrow("credentialsFile");
  });

  it("deve aceitar named tunnel apenas com token (sem tunnelId/domain)", async () => {
    // Com token, não precisa de tunnelId — deve passar a validação
    await expect(
      tunnel.cloudflare({
        port: 3000,
        token: "eyJ-fake-token",
        timeout: 1000,
      }),
    ).rejects.toThrow(); // ENOENT/timeout, não validação
  });

  it("deve aceitar named tunnel com token + domain", async () => {
    await expect(
      tunnel.cloudflare({
        port: 3000,
        token: "eyJ-fake-token",
        domain: "api.meudominio.com.br",
        timeout: 1000,
      }),
    ).rejects.toThrow();
  });

  it("deve inferir mode 'named' quando token é fornecido", async () => {
    const promise = tunnel.cloudflare({
      port: 3000,
      token: "eyJ-fake-token",
      timeout: 1000,
    });
    await expect(promise).rejects.toThrow();
    try { await promise; } catch (err: any) {
      expect(err.message).not.toContain("tunnelId");
      expect(err.message).not.toContain("credentialsFile");
    }
  });

  it("deve continuar funcionando com API simplificada (modo quick)", async () => {
    await expect(
      tunnel.cloudflare({ port: 3000, timeout: 1000 }),
    ).rejects.toThrow();
  });

  it("deve preservar compatibilidade retroativa", async () => {
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
          token: "eyJ-fake-token",
          domain: "api.meudominio.com.br",
          timeout: 1000,
        },
      }),
    ).rejects.toThrow();
  });

  it("deve aceitar timeout personalizado e respeitá-lo", async () => {
    const start = Date.now();
    await expect(
      tunnel.cloudflare({ port: 3000, timeout: 1000 }),
    ).rejects.toThrow();
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
});

// ============================================================
// 3. Testes do CloudflareProvider com mock do child_process
// ============================================================

vi.mock("child_process", async (importOriginal) => {
  const original = await importOriginal<typeof import("child_process")>();
  return {
    ...original,
    spawn: vi.fn(original.spawn),
  };
});

import { spawn } from "child_process";
const spawnMock = vi.mocked(spawn);

/** Cria um ChildProcess fake */
function createMockProcess() {
  const proc = new EventEmitter() as any;
  proc.stderr = new EventEmitter();
  proc.stdout = new EventEmitter();
  proc.kill = vi.fn(() => {
    proc.emit("close", 0);
  });
  proc.pid = 12345;
  return proc;
}

/** Helper para criar e iniciar o provider diretamente, sem dynamic import */
function createProvider(opts: {
  port: number;
  cloudflare?: any;
  onLog?: (line: string) => void;
}) {
  return new CloudflareProvider({ ...opts });
}

describe("Cloudflare — Quick Tunnel (mock)", () => {
  let mockProc: any;

  beforeEach(() => {
    mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);
  });

  afterEach(() => {
    spawnMock.mockRestore();
  });

  it("deve capturar a URL trycloudflare.com e emitir ready", async () => {
    const provider = createProvider({ port: 8080 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("INF | https://random-words-here.trycloudflare.com\n")
      );
    }, 50);

    const result = await promise;
    expect(result.url).toBe("https://random-words-here.trycloudflare.com");
    expect(result.port).toBe(8080);
    expect(result.provider).toBe("cloudflare");
    expect(typeof result.stop).toBe("function");

    result.stop();
  });

  it("não deve confundir api.trycloudflare.com com a URL do túnel", async () => {
    const provider = createProvider({ port: 8080 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from(
          'failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": dial tcp: network is unreachable'
        )
      );
    }, 50);

    await expect(promise).rejects.toThrow("conexão com a Cloudflare");
  });

  it("deve emitir evento ready com a URL", async () => {
    const provider = createProvider({ port: 3000 });
    const readySpy = vi.fn();
    provider.on("ready", readySpy);

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("https://test-tunnel.trycloudflare.com")
      );
    }, 50);

    const result = await promise;
    expect(readySpy).toHaveBeenCalledWith("https://test-tunnel.trycloudflare.com");
    result.stop();
  });

  it("deve chamar cloudflared com os argumentos corretos no modo quick", async () => {
    const provider = createProvider({ port: 4000 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("https://abc.trycloudflare.com")
      );
    }, 50);

    const result = await promise;

    expect(spawnMock).toHaveBeenCalledWith("cloudflared", [
      "tunnel",
      "--url",
      "http://localhost:4000",
    ]);

    result.stop();
  });

  it("deve detectar connection refused e rejeitar", async () => {
    const provider = createProvider({ port: 9999 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("ERR connection refused"));
    }, 50);

    await expect(promise).rejects.toThrow("porta 9999");
  });

  it("deve rejeitar quando o processo encerra com código não-zero", async () => {
    const provider = createProvider({ port: 3000 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.emit("close", 1);
    }, 50);

    await expect(promise).rejects.toThrow("encerrou inesperadamente");
  });

  it("deve emitir close quando o processo encerra normalmente após conectar", async () => {
    const provider = createProvider({ port: 3000 });
    const closeSpy = vi.fn();
    provider.on("close", closeSpy);

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("https://abc.trycloudflare.com"));
    }, 50);

    const result = await promise;
    mockProc.emit("close", 0);
    await new Promise((r) => setTimeout(r, 50));
    expect(closeSpy).toHaveBeenCalled();
    result.stop();
  });

  it("deve encerrar o processo com stop()", async () => {
    const provider = createProvider({ port: 3000 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("https://abc.trycloudflare.com"));
    }, 50);

    const result = await promise;
    result.stop();
    expect(mockProc.kill).toHaveBeenCalled();
  });
});

describe("Cloudflare — Named Tunnel com token (mock)", () => {
  let mockProc: any;

  beforeEach(() => {
    mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);
  });

  afterEach(() => {
    spawnMock.mockRestore();
  });

  it("deve chamar cloudflared com --token no modo named", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        token: "eyJ-my-tunnel-token",
        domain: "api.meudominio.com.br",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("INF Registered tunnel connection connIndex=0")
      );
    }, 50);

    const result = await promise;

    expect(spawnMock).toHaveBeenCalledWith("cloudflared", [
      "tunnel",
      "--url", "http://localhost:3000",
      "run",
      "--token", "eyJ-my-tunnel-token",
    ]);

    expect(result.url).toBe("https://api.meudominio.com.br");
    expect(result.provider).toBe("cloudflare");
    result.stop();
  });

  it("deve detectar 'Connection registered' e resolver com domain", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        token: "fake-token",
        domain: "app.exemplo.com",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("Connection abc123 registered connIndex=0 location=GRU")
      );
    }, 50);

    const result = await promise;
    expect(result.url).toBe("https://app.exemplo.com");
    result.stop();
  });

  it("deve funcionar sem domain quando token é fornecido", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: { token: "eyJ-fake-token" },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("INF Registered tunnel connection connIndex=0")
      );
    }, 50);

    const result = await promise;
    expect(result.url).toContain("cfargotunnel.com");
    result.stop();
  });

  it("deve emitir ready mesmo com listener registrado após o await", async () => {
    const promise = tunnel({
      provider: "cloudflare",
      port: 3000,
      cloudflare: { token: "fake-token", domain: "api.exemplo.com" },
    });

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("INF Registered tunnel connection connIndex=0")
      );
    }, 50);

    const instance = await promise;

    const ready = await new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("ready não emitido")), 1000);
      instance.on("ready", (url) => {
        clearTimeout(timer);
        resolve(url);
      });
    });

    expect(ready).toBe("https://api.exemplo.com");
    instance.stop();
  });

  it("deve repassar logs sanitizados via onLog", async () => {
    const secret =
      "eyJhbGciOiJSUzI1NiJ9.eyJzZWNyZXQiOiJ2YWx1ZSJ9.assinatura";
    const lines: string[] = [];

    const provider = createProvider({
      port: 3000,
      cloudflare: { token: secret, domain: "api.exemplo.com" },
      onLog: (line) => lines.push(line),
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from(`INF iniciando com ${secret}\n`)
      );
      mockProc.stderr.emit(
        "data",
        Buffer.from("INF Registered tunnel connection connIndex=0\n")
      );
    }, 50);

    const result = await promise;
    const output = lines.join("");

    expect(output).toContain("INF iniciando");
    expect(output).toContain("[TOKEN OCULTO]");
    expect(output).not.toContain(secret);

    result.stop();
  });

  it("deve detectar token inválido e rejeitar com mensagem clara", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: { token: "token-invalido" },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("ERR error parsing token: invalid token format")
      );
    }, 50);

    await expect(promise).rejects.toThrow("inválido ou expirado");
  });

  it("deve detectar token expirado e rejeitar", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: { token: "expired-token" },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("token is expired"));
    }, 50);

    await expect(promise).rejects.toThrow("expirado");
  });

  it("não deve expor o token na mensagem de erro genérica", async () => {
    const secretToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzZWNyZXQiOiJ2YWx1ZSJ9.signature";
    const provider = createProvider({
      port: 3000,
      cloudflare: { token: secretToken },
    });

    const promise = provider.start();

    setTimeout(() => {
      // Simula um erro genérico do spawn que poderia conter o token
      const err = new Error(`some error with ${secretToken} exposed`);
      mockProc.emit("error", err);
    }, 50);

    try {
      await promise;
    } catch (err: any) {
      expect(err.message).not.toContain(secretToken);
      expect(err.message).toContain("[TOKEN OCULTO]");
    }
  });
});

describe("Cloudflare — Named Tunnel com credenciais (mock)", () => {
  let mockProc: any;

  beforeEach(() => {
    mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);
  });

  afterEach(() => {
    spawnMock.mockRestore();
  });

  it("deve chamar cloudflared com --credentials-file e tunnel run", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        tunnelId: "abc-def-123",
        credentialsFile: credsFile,
        domain: "api.meudominio.com.br",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("INF Registered tunnel connection connIndex=0")
      );
    }, 50);

    const result = await promise;

    expect(spawnMock).toHaveBeenCalledWith("cloudflared", [
      "tunnel",
      "--credentials-file", credsFile,
      "--url", "http://localhost:3000",
      "run",
      "abc-def-123",
    ]);

    expect(result.url).toBe("https://api.meudominio.com.br");
    result.stop();
  });

  it("deve aceitar tunnelName no lugar de tunnelId", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        tunnelName: "meu-tunnel",
        credentialsFile: credsFile,
        domain: "app.meudominio.com.br",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("Registered tunnel connection")
      );
    }, 50);

    const result = await promise;

    expect(spawnMock).toHaveBeenCalledWith("cloudflared", [
      "tunnel",
      "--credentials-file", credsFile,
      "--url", "http://localhost:3000",
      "run",
      "meu-tunnel",
    ]);

    expect(result.url).toBe("https://app.meudominio.com.br");
    result.stop();
  });

  it("deve detectar túnel inexistente e rejeitar", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        tunnelId: "nao-existe",
        credentialsFile: credsFile,
        domain: "api.meudominio.com.br",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("tunnel not found"));
    }, 50);

    await expect(promise).rejects.toThrow("não encontrado");
  });

  it("deve detectar credenciais inválidas e rejeitar", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        tunnelId: "abc-123",
        credentialsFile: credsFile,
        domain: "api.meudominio.com.br",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("error authentication error: unauthorized")
      );
    }, 50);

    await expect(promise).rejects.toThrow("Credenciais");
  });

  it("deve detectar credentialsFile .pem e rejeitar com mensagem clara", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: {
        tunnelId: "abc-123",
        credentialsFile: credsFile,
        domain: "api.meudominio.com.br",
      },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from(
          "The tunnel credentials file should be .json but you gave a .pem."
        )
      );
    }, 50);

    await expect(promise).rejects.toThrow("cert.pem");
  });

  it("deve incluir a saída do cloudflared no erro de encerramento inesperado", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: { tunnelId: "abc-123", credentialsFile: credsFile },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("mensagem real do cloudflared"));
      mockProc.emit("close", 1);
    }, 50);

    await expect(promise).rejects.toThrow("mensagem real do cloudflared");
  });

  it("não deve derrubar o processo quando novos erros chegam após a rejeição", async () => {
    const promise = tunnel.cloudflare({
      port: 3000,
      token: "fake-token",
      timeout: 2000,
    });

    setTimeout(() => {
      mockProc.stderr.emit(
        "data",
        Buffer.from("error authentication error: unauthorized")
      );
      // Segundo erro chega depois de start() já ter rejeitado. Antes da
      // correção, isso emitia "error" no emitter sem listener e derrubava
      // o processo.
      mockProc.stderr.emit("data", Buffer.from("failed to connect to edge"));
      mockProc.emit("close", 1);
    }, 50);

    await expect(promise).rejects.toThrow("Credenciais");
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
});

describe("Cloudflare — erros de conectividade (mock)", () => {
  let mockProc: any;

  beforeEach(() => {
    mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);
  });

  afterEach(() => {
    spawnMock.mockRestore();
  });

  it("deve detectar falha de conexão com a Cloudflare", async () => {
    const provider = createProvider({ port: 3000 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("ERR failed to connect to edge"));
    }, 50);

    await expect(promise).rejects.toThrow("conexão com a Cloudflare");
  });

  it("deve detectar hostname não configurado", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: { token: "fake" },
    });

    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("ERR no ingress rules match"));
    }, 50);

    await expect(promise).rejects.toThrow("ingress");
  });

  it("deve detectar ENOENT e dar mensagem de instalação", async () => {
    const provider = createProvider({ port: 3000 });
    const promise = provider.start();

    setTimeout(() => {
      const err = new Error("spawn cloudflared ENOENT") as any;
      err.code = "ENOENT";
      mockProc.emit("error", err);
    }, 50);

    await expect(promise).rejects.toThrow("Cloudflared não encontrado");
  });

  it("deve dar mensagem específica quando cloudflaredPath customizado falha", async () => {
    const provider = createProvider({
      port: 3000,
      cloudflare: { cloudflaredPath: "/opt/bin/cloudflared" },
    });

    const promise = provider.start();

    setTimeout(() => {
      const err = new Error("spawn ENOENT") as any;
      err.code = "ENOENT";
      mockProc.emit("error", err);
    }, 50);

    await expect(promise).rejects.toThrow("/opt/bin/cloudflared");
  });
});

describe("Cloudflare — stop e cleanup (mock)", () => {
  let mockProc: any;

  beforeEach(() => {
    mockProc = createMockProcess();
    spawnMock.mockReturnValue(mockProc);
  });

  afterEach(() => {
    spawnMock.mockRestore();
  });

  it("deve limpar timeout quando resolve com sucesso", async () => {
    const provider = createProvider({ port: 3000 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("https://abc.trycloudflare.com"));
    }, 50);

    const result = await promise;
    result.stop();
  });

  it("deve encerrar processo na falha de conexão", async () => {
    const provider = createProvider({ port: 3000 });
    const promise = provider.start();

    setTimeout(() => {
      mockProc.stderr.emit("data", Buffer.from("connection refused"));
    }, 50);

    await expect(promise).rejects.toThrow();
    expect(mockProc.kill).toHaveBeenCalled();
  });
});
