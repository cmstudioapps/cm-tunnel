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
  ip = "203.0.113.10",
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, path: pathname, headers: { "cf-connecting-ip": ip } },
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

describe("RateLimiter", () => {
  it("bloqueia após exceder o limite global", async () => {
    const target = await startTarget();
    const limiter = new RateLimiter(target.port, { maxRequestsPerMinute: 2 });
    const port = await limiter.start();

    try {
      expect((await request(port, "/")).status).toBe(200);
      expect((await request(port, "/")).status).toBe(200);

      const blocked = await request(port, "/");
      expect(blocked.status).toBe(429);
      expect(blocked.body).toContain("Limite Excedido");

      const stillBlocked = await request(port, "/");
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

    try {
      // Rota pública nunca é limitada.
      for (let i = 0; i < 5; i++) {
        expect((await request(port, "/public/index.html")).status).toBe(200);
      }

      // /api2 não deve ser afetado pela regra de /api.
      for (let i = 0; i < 5; i++) {
        expect((await request(port, "/api2")).status).toBe(200);
      }

      // /api é limitado.
      expect((await request(port, "/api/users")).status).toBe(200);
      const blocked = await request(port, "/api/users");
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
      expect((await request(port, "/", "198.51.100.1")).status).toBe(200);
      expect((await request(port, "/", "198.51.100.1")).status).toBe(429);
      // Outro IP continua livre.
      expect((await request(port, "/", "198.51.100.2")).status).toBe(200);
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
