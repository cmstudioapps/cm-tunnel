import { describe, it, expect } from "vitest";
import {
  buildTunnelOptions,
  detectLang,
  guessMode,
  isValidDomain,
  normalizeDomain,
  normalizePrefix,
  parseCliArgs,
  type Plan,
} from "../src/cli-utils.js";

describe("CLI — i18n", () => {
  it("detecta português pelo LANG", () => {
    expect(detectLang(undefined, { LANG: "pt_BR.UTF-8" })).toBe("pt");
  });

  it("detecta inglês por padrão", () => {
    expect(detectLang(undefined, {})).toBe("en");
  });

  it("flag explícita vence o ambiente", () => {
    expect(detectLang("en", { LANG: "pt_BR.UTF-8" })).toBe("en");
  });
});

describe("CLI — parse de flags", () => {
  it("lê as opções principais", () => {
    const opts = parseCliArgs([
      "--yes",
      "--quick",
      "--public",
      "site",
      "--api",
      "server",
      "--lang",
      "pt",
      "--no-save",
    ]);

    expect(opts.yes).toBe(true);
    expect(opts.quick).toBe(true);
    expect(opts.public).toBe("site");
    expect(opts.api).toBe("server");
    expect(opts.lang).toBe("pt");
    expect(opts.save).toBe(false);
  });

  it("aceita modo e porta", () => {
    const opts = parseCliArgs(["--mode", "both", "--port", "8080"]);
    expect(opts.mode).toBe("both");
    expect(opts.port).toBe(8080);
  });

  it("aceita --target para servidor já rodando", () => {
    const opts = parseCliArgs(["--target", "4000"]);
    expect(opts.target).toBe(4000);
  });

  it("rejeita --target inválido", () => {
    expect(() => parseCliArgs(["--target", "0"])).toThrow("Invalid --target");
  });

  it("rejeita modo inválido", () => {
    expect(() => parseCliArgs(["--mode", "nada"])).toThrow("Invalid --mode");
  });

  it("rejeita porta inválida", () => {
    expect(() => parseCliArgs(["--port", "70000"])).toThrow("Invalid --port");
  });

  it("reconhece os comandos doctor e dashboard", () => {
    expect(parseCliArgs(["doctor"]).command).toBe("doctor");
    expect(parseCliArgs(["dashboard"]).command).toBe("dashboard");
  });

  it("rejeita comando desconhecido", () => {
    expect(() => parseCliArgs(["nada"])).toThrow("Unknown command");
  });

  it("aceita --logs e --verbose", () => {
    expect(parseCliArgs(["--logs"]).logs).toBe(true);
    expect(parseCliArgs(["--verbose"]).logs).toBe(true);
  });

  it("aceita --api-mode e --api-entry", () => {
    const opts = parseCliArgs([
      "--api-mode",
      "server",
      "--api-entry",
      "api/index.js",
    ]);
    expect(opts.apiMode).toBe("server");
    expect(opts.apiEntry).toBe("api/index.js");
  });

  it("rejeita --api-mode inválido", () => {
    expect(() => parseCliArgs(["--api-mode", "nada"])).toThrow(
      "Invalid --api-mode",
    );
  });

  it("aceita --provider e --subdomain", () => {
    const opts = parseCliArgs([
      "--provider",
      "ngrok",
      "--subdomain",
      "meuapp",
    ]);
    expect(opts.provider).toBe("ngrok");
    expect(opts.subdomain).toBe("meuapp");
  });

  it("rejeita --provider inválido", () => {
    expect(() => parseCliArgs(["--provider", "vercel"])).toThrow(
      "Invalid --provider",
    );
  });
});

describe("CLI — normalização", () => {
  it("remove protocolo e barra do domínio", () => {
    expect(normalizeDomain(" https://api.exemplo.com/ ")).toBe("api.exemplo.com");
  });

  it("valida domínio", () => {
    expect(isValidDomain("api.exemplo.com")).toBe(true);
    expect(isValidDomain("localhost")).toBe(false);
    expect(isValidDomain("sem espaco.com")).toBe(false);
  });

  it("normaliza prefixo da API", () => {
    expect(normalizePrefix()).toBe("/api");
    expect(normalizePrefix("v1/")).toBe("/v1");
    expect(normalizePrefix("/v2/")).toBe("/v2");
  });
});

describe("CLI — detecção de modo", () => {
  it("detecta site, api ou ambos", () => {
    expect(guessMode(true, false)).toBe("site");
    expect(guessMode(false, true)).toBe("api");
    expect(guessMode(true, true)).toBe("both");
    expect(guessMode(false, false)).toBe("both");
  });
});

describe("CLI — opções do túnel", () => {
  const base: Plan = {
    mode: "both",
    public: "public",
    api: "api",
    apiPrefix: "/api",
    publish: "quick",
  };

  it("monta modo quick com site + API", () => {
    const options = buildTunnelOptions(base);

    expect(options.provider).toBe("cloudflare");
    expect(options.serve).toEqual({
      public: "public",
      api: "api",
      apiPrefix: "/api",
    });
    expect(options.rateLimit).toEqual({
      maxRequestsPerMinute: 60,
      routes: ["/api"],
    });
    expect(options.cloudflare).toEqual({ mode: "quick" });
  });

  it("não cria API nem rate limit no modo site", () => {
    const options = buildTunnelOptions({ ...base, mode: "site" });
    expect(options.serve).toEqual({ public: "public", apiPrefix: "/api" });
    expect(options.rateLimit).toBeUndefined();
  });

  it("não cria site no modo api", () => {
    const options = buildTunnelOptions({ ...base, mode: "api" });
    expect(options.serve).toEqual({ api: "api", apiPrefix: "/api" });
  });

  it("monta domínio com porta fixa", () => {
    const options = buildTunnelOptions(
      {
        ...base,
        mode: "api",
        publish: "domain",
        domain: "api.exemplo.com",
        port: 3000,
      },
      "token-123",
    );

    expect(options.serve).toEqual({
      api: "api",
      apiPrefix: "/api",
      port: 3000,
    });
    expect(options.cloudflare).toEqual({
      mode: "named",
      domain: "api.exemplo.com",
      token: "token-123",
    });
  });

  it("monta modo servidor existente sem serve nem rate limit", () => {
    const options = buildTunnelOptions({
      ...base,
      publish: "quick",
      target: 4000,
    });

    expect(options).toEqual({
      provider: "cloudflare",
      port: 4000,
      cloudflare: { mode: "quick" },
    });
  });

  it("monta servidor existente com domínio", () => {
    const options = buildTunnelOptions(
      {
        ...base,
        publish: "domain",
        domain: "api.exemplo.com",
        target: 4000,
      },
      "token-123",
    );

    expect(options.port).toBe(4000);
    expect(options.serve).toBeUndefined();
    expect(options.rateLimit).toBeUndefined();
    expect(options.cloudflare).toEqual({
      mode: "named",
      domain: "api.exemplo.com",
      token: "token-123",
    });
  });

  it("monta API em modo server", () => {
    const options = buildTunnelOptions({
      ...base,
      apiMode: "server",
      apiEntry: "api/index.js",
      publish: "quick",
    });

    expect(options.serve).toEqual({
      public: "public",
      api: "api",
      apiMode: "server",
      apiEntry: "api/index.js",
      apiPrefix: "/api",
    });
  });

  it("usa cloudflare por padrão quando o provedor não é informado", () => {
    const options = buildTunnelOptions(base);
    expect(options.provider).toBe("cloudflare");
    expect(options.cloudflare).toEqual({ mode: "quick" });
  });

  it("monta ngrok com authtoken e subdomínio", () => {
    const options = buildTunnelOptions(
      { ...base, provider: "ngrok", subdomain: "meuapp" },
      undefined,
      "ngrok-token",
    );

    expect(options.provider).toBe("ngrok");
    expect(options.subdomain).toBe("meuapp");
    expect(options.authtoken).toBe("ngrok-token");
    expect(options.cloudflare).toBeUndefined();
    expect(options.serve).toEqual({
      public: "public",
      api: "api",
      apiPrefix: "/api",
    });
  });

  it("monta localtunnel sem credenciais da Cloudflare", () => {
    const options = buildTunnelOptions({
      ...base,
      provider: "localtunnel",
      publish: "quick",
    });

    expect(options.provider).toBe("localtunnel");
    expect(options.cloudflare).toBeUndefined();
    expect(options.subdomain).toBeUndefined();
    expect(options.authtoken).toBeUndefined();
    expect(options.rateLimit).toEqual({
      maxRequestsPerMinute: 60,
      routes: ["/api"],
    });
  });

  it("monta provedor não-cloudflare em modo servidor existente", () => {
    const options = buildTunnelOptions({
      ...base,
      provider: "localtunnel",
      publish: "quick",
      target: 4000,
    });

    expect(options).toEqual({ provider: "localtunnel", port: 4000 });
  });
});
