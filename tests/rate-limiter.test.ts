import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import http from "http";
import { createServer, Server } from "http";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import bancoz from "bancoz";
import {
  RateLimiter,
  pathMatchesRoute,
  normalizeRoute,
  normalizeIp,
  resolveClientIp,
} from "../src/RateLimiter.js";

let bancozDir: string;

beforeAll(() => {
  bancozDir = mkdtempSync(join(tmpdir(), "cm-tunnel-bancoz-"));
  bancoz.path(bancozDir);
});

afterAll(() => {
  bancoz.path(null);
  rmSync(bancozDir, { recursive: true, force: true });
});

beforeEach(async () => {
  // Estado limpo entre testes (mesmo arquivo do bancoz).
  try {
    const all = await bancoz.ler("ratelimit");
    if (all && typeof all === "object") {
      for (const key of Object.keys(all)) {
        await bancoz.deletar("ratelimit", key);
      }
    }
  } catch {
    // arquivo ainda não existe
  }
});

function startTarget(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as import("net").AddressInfo;
      resolve({ server, port: address.port });
    });
  });
}

function request(
  port: number,
  pathname: string,
  headers: Record<string, string> = {},
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: pathname, headers },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => resolve({ status: res.statusCode || 0, body }));
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("normalizeRoute", () => {
  it("garante barra inicial e remove barra final", () => {
    expect(normalizeRoute("api/")).toBe("/api");
    expect(normalizeRoute("/api/")).toBe("/api");
    expect(normalizeRoute("api")).toBe("/api");
    expect(normalizeRoute("/")).toBe("/");
    expect(normalizeRoute("/api?x=1")).toBe("/api");
  });
});

describe("pathMatchesRoute", () => {
  it("não confunde /api com /api2", () => {
    expect(pathMatchesRoute("/api2", "/api")).toBe(false);
    expect(pathMatchesRoute("/api-v2", "/api")).toBe(false);
    expect(pathMatchesRoute("/apix/users", "/api")).toBe(false);
  });

  it("casa a rota exata, subrotas e query string", () => {
    expect(pathMatchesRoute("/api", "/api")).toBe(true);
    expect(pathMatchesRoute("/api?foo=bar", "/api")).toBe(true);
    expect(pathMatchesRoute("/api/users/1", "/api")).toBe(true);
  });

  it("normaliza barras finais nas rotas configuradas", () => {
    expect(pathMatchesRoute("/api/users", "/api/")).toBe(true);
  });

  it("raiz casa qualquer caminho", () => {
    expect(pathMatchesRoute("/qualquer/coisa", "/")).toBe(true);
  });
});

describe("normalizeIp", () => {
  it("aceita IPv4 e IPv6", () => {
    expect(normalizeIp("203.0.113.7")).toBe("203.0.113.7");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8::1");
  });

  it("remove porta e colchetes", () => {
    expect(normalizeIp("203.0.113.7:443")).toBe("203.0.113.7");
    expect(normalizeIp("[2001:db8::1]:443")).toBe("2001:db8::1");
    expect(normalizeIp("[2001:db8::1]")).toBe("2001:db8::1");
  });

  it("rejeita valores que não são IP", () => {
    expect(normalizeIp("nao-e-ip")).toBeNull();
    expect(normalizeIp("<script>")).toBeNull();
    expect(normalizeIp("")).toBeNull();
    expect(normalizeIp(undefined)).toBeNull();
  });
});

describe("resolveClientIp", () => {
  it("usa o último valor de x-forwarded-for por padrão", () => {
    const ip = resolveClientIp(
      { "x-forwarded-for": "9.9.9.9, 203.0.113.5" },
      "127.0.0.1",
      undefined,
    );
    expect(ip).toBe("203.0.113.5");
  });

  it("ignora cf-connecting-ip quando o cabeçalho confiável é x-forwarded-for", () => {
    const ip = resolveClientIp(
      {
        "cf-connecting-ip": "9.9.9.9",
        "x-forwarded-for": "203.0.113.5",
      },
      "127.0.0.1",
      { header: "x-forwarded-for", strategy: "last" },
    );
    expect(ip).toBe("203.0.113.5");
  });

  it("confia em cf-connecting-ip quando configurado", () => {
    const ip = resolveClientIp(
      {
        "cf-connecting-ip": "203.0.113.9",
        "x-forwarded-for": "9.9.9.9",
      },
      "127.0.0.1",
      { header: "cf-connecting-ip", strategy: "first" },
    );
    expect(ip).toBe("203.0.113.9");
  });

  it("cai para o socket quando o valor é inválido", () => {
    const ip = resolveClientIp(
      { "x-forwarded-for": "not-an-ip" },
      "127.0.0.1",
      undefined,
    );
    expect(ip).toBe("127.0.0.1");
  });

  it("usa só o socket quando clientIp = false", () => {
    const ip = resolveClientIp(
      { "x-forwarded-for": "203.0.113.5" },
      "127.0.0.1",
      false,
    );
    expect(ip).toBe("127.0.0.1");
  });
});

describe("RateLimiter", () => {
  it("bloqueia após exceder o limite global", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, { maxRequestsPerMinute: 2 });
    const port = await limiter.start();
    const headers = { "x-forwarded-for": "198.51.100.10" };

    try {
      expect((await request(port, "/", headers)).status).toBe(200);
      expect((await request(port, "/", headers)).status).toBe(200);

      const blocked = await request(port, "/", headers);
      expect(blocked.status).toBe(429);
      expect(blocked.body).toContain("Limite Excedido");

      const stillBlocked = await request(port, "/", headers);
      expect(stillBlocked.status).toBe(429);
      expect(stillBlocked.body).toContain("Bloqueado");
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("aplica limite apenas nas rotas configuradas", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, {
      maxRequestsPerMinute: 1,
      routes: ["/api"],
    });
    const port = await limiter.start();
    const headers = { "x-forwarded-for": "198.51.100.11" };

    try {
      // Rota pública nunca é limitada.
      for (let i = 0; i < 5; i++) {
        expect((await request(port, "/public/index.html", headers)).status).toBe(200);
      }

      // /api2 não deve ser afetado pela regra de /api.
      for (let i = 0; i < 5; i++) {
        expect((await request(port, "/api2", headers)).status).toBe(200);
      }

      // /api é limitado.
      expect((await request(port, "/api/users", headers)).status).toBe(200);
      const blocked = await request(port, "/api/users", headers);
      expect(blocked.status).toBe(429);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("isola o contador por IP", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, { maxRequestsPerMinute: 1 });
    const port = await limiter.start();

    try {
      const first = { "x-forwarded-for": "198.51.100.1" };
      const second = { "x-forwarded-for": "198.51.100.2" };

      expect((await request(port, "/", first)).status).toBe(200);
      expect((await request(port, "/", first)).status).toBe(429);
      // Outro IP continua livre.
      expect((await request(port, "/", second)).status).toBe(200);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("não deixa o primeiro valor de x-forwarded-for burlar o limite", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, { maxRequestsPerMinute: 1 });
    const port = await limiter.start();

    try {
      // O atacante forja o início da lista, mas o proxy anexa o IP real no fim.
      const spoofed1 = { "x-forwarded-for": "1.2.3.4, 203.0.113.50" };
      const spoofed2 = { "x-forwarded-for": "5.6.7.8, 203.0.113.50" };

      expect((await request(port, "/", spoofed1)).status).toBe(200);
      expect((await request(port, "/", spoofed2)).status).toBe(429);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("ignora cf-connecting-ip forjado quando o provedor não é Cloudflare", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, {
      maxRequestsPerMinute: 1,
      clientIp: { header: "x-forwarded-for", strategy: "last" },
    });
    const port = await limiter.start();

    try {
      const first = {
        "cf-connecting-ip": "1.1.1.1",
        "x-forwarded-for": "203.0.113.60",
      };
      const second = {
        "cf-connecting-ip": "2.2.2.2",
        "x-forwarded-for": "203.0.113.60",
      };

      expect((await request(port, "/", first)).status).toBe(200);
      expect((await request(port, "/", second)).status).toBe(429);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("confia em cf-connecting-ip quando configurado (Cloudflare)", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, {
      maxRequestsPerMinute: 1,
      clientIp: { header: "cf-connecting-ip", strategy: "first" },
    });
    const port = await limiter.start();

    try {
      const first = {
        "cf-connecting-ip": "203.0.113.70",
        "x-forwarded-for": "1.1.1.1",
      };
      const second = {
        "cf-connecting-ip": "203.0.113.70",
        "x-forwarded-for": "2.2.2.2",
      };

      expect((await request(port, "/", first)).status).toBe(200);
      expect((await request(port, "/", second)).status).toBe(429);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("usa só o socket quando clientIp = false", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, {
      maxRequestsPerMinute: 1,
      clientIp: false,
    });
    const port = await limiter.start();

    try {
      const first = { "x-forwarded-for": "203.0.113.80" };
      const second = { "x-forwarded-for": "203.0.113.81" };

      expect((await request(port, "/", first)).status).toBe(200);
      // Cabeçalhos diferentes não criam contadores diferentes.
      expect((await request(port, "/", second)).status).toBe(429);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });

  it("não perde incrementos com requisições simultâneas", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, { maxRequestsPerMinute: 4 });
    const port = await limiter.start();
    const headers = { "x-forwarded-for": "203.0.113.90" };

    try {
      const results = await Promise.all(
        Array.from({ length: 12 }, () => request(port, "/", headers)),
      );

      const allowed = results.filter((r) => r.status === 200).length;
      const blocked = results.filter((r) => r.status === 429).length;

      expect(allowed).toBe(4);
      expect(blocked).toBe(8);
    } finally {
      limiter.stop();
      target.server.close();
    }
  });
});

describe("RateLimiter.cleanupExpired", () => {
  it("remove entradas expiradas e preserva as ativas", async () => {
    const now = Date.now();

    await bancoz.criar("ratelimit", "expirado", {
      count: 5,
      windowStart: now - 120_000,
    });
    await bancoz.criar("ratelimit", "bloqueio_vencido", {
      count: 5,
      windowStart: now - 120_000,
      blockedUntil: now - 1_000,
    });
    await bancoz.criar("ratelimit", "janela_nova", {
      count: 1,
      windowStart: now - 1_000,
    });
    await bancoz.criar("ratelimit", "bloqueado_agora", {
      count: 5,
      windowStart: now - 120_000,
      blockedUntil: now + 60_000,
    });

    const limiter = new RateLimiter(1, true);
    const removed = await limiter.cleanupExpired(now);

    expect(removed).toBe(2);

    const remaining = (await bancoz.ler("ratelimit")) as Record<string, unknown>;
    expect(remaining).toHaveProperty("janela_nova");
    expect(remaining).toHaveProperty("bloqueado_agora");
    expect(remaining).not.toHaveProperty("expirado");
    expect(remaining).not.toHaveProperty("bloqueio_vencido");
  });

  it("não falha quando a tabela não existe", async () => {
    const limiter = new RateLimiter(1, true);
    // A tabela foi limpa no beforeEach, mas o arquivo existe vazio.
    await expect(limiter.cleanupExpired()).resolves.toBeTypeOf("number");
  });
});
