import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { fileURLToPath } from "url";
import { join } from "path";
import { writeFileSync, rmSync } from "fs";
import http from "http";
import tunnel from "../src/index.js";

const publicDir = fileURLToPath(new URL("./fixtures/public", import.meta.url));
const apiDir = fileURLToPath(new URL("./fixtures/api", import.meta.url));
const apiServerDir = fileURLToPath(
  new URL("./fixtures/api-server", import.meta.url),
);
const dotEnvFixture = join(publicDir, ".env");

beforeAll(() => {
  writeFileSync(dotEnvFixture, "SEGREDO\n");
});

afterAll(() => {
  rmSync(dotEnvFixture, { force: true });
});

interface Response {
  status: number;
  body: string;
  headers: http.IncomingHttpHeaders;
}

function request(
  baseUrl: string,
  pathname: string,
  options: http.RequestOptions = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      `${baseUrl}${pathname}`,
      options,
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () =>
          resolve({
            status: res.statusCode || 0,
            body,
            headers: res.headers,
          }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });
}

async function withServer<T>(
  options: Parameters<typeof tunnel.serve>[0],
  fn: (server: Awaited<ReturnType<typeof tunnel.serve>>) => Promise<T>,
): Promise<T> {
  const server = await tunnel.serve(options);
  try {
    return await fn(server);
  } finally {
    server.stop();
  }
}

describe("StaticServer", () => {
  it("deve rodar localmente sem tunel e responder com HTML", async () => {
    const server = await tunnel.serve({
      html: "<h1>Teste Local</h1>",
    });

    expect(server.url).toContain("http://127.0.0.1:");
    expect(server.port).toBeGreaterThan(0);

    const response = await request(server.url, "/");
    expect(response.body).toBe("<h1>Teste Local</h1>");

    server.stop();
  });

  it("deve servir a pasta public na raiz", async () => {
    await withServer({ public: publicDir }, async (server) => {
      const index = await request(server.url, "/");
      expect(index.status).toBe(200);
      expect(index.body).toContain("Página pública");
      expect(index.headers["content-type"]).toContain("text/html");

      const asset = await request(server.url, "/assets/app.js");
      expect(asset.status).toBe(200);
      expect(asset.body).toContain("asset público");
      expect(asset.headers["content-type"]).toContain("text/javascript");
    });
  });

  it("deve executar handlers da pasta api", async () => {
    await withServer({ public: publicDir, api: apiDir }, async (server) => {
      const hello = await request(server.url, "/api/hello");
      expect(hello.status).toBe(200);
      expect(JSON.parse(hello.body)).toEqual({
        message: "hello",
        url: "/api/hello",
      });

      const echo = await request(server.url, "/api/echo");
      expect(JSON.parse(echo.body)).toEqual({ method: "GET" });
    });
  });

  it("deve suportar exports por método (GET/POST)", async () => {
    await withServer({ api: apiDir }, async (server) => {
      const get = await request(server.url, "/api/method");
      expect(JSON.parse(get.body)).toEqual({ method: "GET" });

      const post = await request(server.url, "/api/method", { method: "POST" });
      expect(JSON.parse(post.body)).toEqual({ method: "POST" });
    });
  });

  it("deve retornar 405 para método não suportado", async () => {
    await withServer({ api: apiDir }, async (server) => {
      const res = await request(server.url, "/api/method", { method: "PUT" });
      expect(res.status).toBe(405);
    });
  });

  it("deve resolver index.js em subpastas da api", async () => {
    await withServer({ api: apiDir }, async (server) => {
      const res = await request(server.url, "/api/nested");
      expect(res.status).toBe(200);
      expect(JSON.parse(res.body)).toEqual({ nested: true });
    });
  });

  it("deve retornar 404 para rota de api inexistente", async () => {
    await withServer({ api: apiDir }, async (server) => {
      const res = await request(server.url, "/api/nao-existe");
      expect(res.status).toBe(404);
    });
  });

  it("nunca deve servir o código da pasta api como estático", async () => {
    await withServer({ public: publicDir, api: apiDir }, async (server) => {
      const res = await request(server.url, "/api/secret.js");
      expect(res.status).toBe(404);
      expect(res.body).not.toContain("NUNCA DEVE SER SERVIDO");
    });
  });

  it("deve bloquear dotfiles", async () => {
    await withServer({ public: publicDir }, async (server) => {
      const res = await request(server.url, "/.env");
      expect(res.status).toBe(404);
      expect(res.body).not.toContain("SEGREDO");
    });
  });

  it("deve bloquear path traversal", async () => {
    await withServer({ public: publicDir }, async (server) => {
      const res = await request(server.url, "/..%2f..%2fetc%2fpasswd");
      expect(res.status).toBe(404);
    });
  });

  it("deve responder 500 quando o handler lança erro", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await withServer({ api: apiDir }, async (server) => {
        const res = await request(server.url, "/api/boom");
        expect(res.status).toBe(500);
      });
    } finally {
      spy.mockRestore();
    }
  });

  it("deve funcionar somente com a pasta api", async () => {
    await withServer({ api: apiDir }, async (server) => {
      const root = await request(server.url, "/");
      expect(root.status).toBe(404);

      const hello = await request(server.url, "/api/hello");
      expect(hello.status).toBe(200);
    });
  });

  it("deve funcionar somente com a pasta public", async () => {
    await withServer({ public: publicDir }, async (server) => {
      const index = await request(server.url, "/");
      expect(index.status).toBe(200);

      // /api é reservado e não cai no estático
      const api = await request(server.url, "/api/hello");
      expect(api.status).toBe(404);
    });
  });

  it("deve respeitar apiPrefix personalizado", async () => {
    await withServer({ api: apiDir, apiPrefix: "/v1" }, async (server) => {
      const v1 = await request(server.url, "/v1/hello");
      expect(v1.status).toBe(200);

      const api = await request(server.url, "/api/hello");
      expect(api.status).toBe(404);
    });
  });
});

describe("StaticServer — API em modo server", () => {
  it("deve rodar um servidor normal e proxiar /api", async () => {
    await withServer(
      { public: publicDir, api: apiServerDir, apiMode: "server" },
      async (server) => {
        const hello = await request(server.url, "/api/hello");
        expect(hello.status).toBe(200);
        expect(JSON.parse(hello.body)).toEqual({ ok: true, url: "/hello" });

        const index = await request(server.url, "/");
        expect(index.status).toBe(200);
        expect(index.body).toContain("Página pública");
      },
    );
  });

  it("deve manter o prefixo quando stripApiPrefix = false", async () => {
    await withServer(
      { api: apiServerDir, apiMode: "server", stripApiPrefix: false },
      async (server) => {
        const echo = await request(server.url, "/api/echo?x=1");
        expect(JSON.parse(echo.body)).toEqual({ url: "/api/echo?x=1" });
      },
    );
  });

  it("deve funcionar só com servidor de API", async () => {
    await withServer({ api: apiServerDir, apiMode: "server" }, async (server) => {
      const root = await request(server.url, "/");
      expect(root.status).toBe(404);

      const hello = await request(server.url, "/api/hello");
      expect(hello.status).toBe(200);
    });
  });

  it("deve rejeitar entry inexistente", async () => {
    await expect(
      tunnel.serve({
        api: apiServerDir,
        apiMode: "server",
        apiEntry: join(apiServerDir, "nao-existe.js"),
      }),
    ).rejects.toThrow("não encontrado");
  });

  it("deve rejeitar quando o app de API encerra", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        tunnel.serve({
          api: apiServerDir,
          apiMode: "server",
          apiEntry: join(apiServerDir, "bad.js"),
          apiTimeout: 2000,
        }),
      ).rejects.toThrow("API encerrou");
    } finally {
      spy.mockRestore();
    }
  });
});
