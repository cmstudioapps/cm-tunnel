#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import prompts from "prompts";
import tunnel from "./index.js";
import type { ApiMode } from "./StaticServer.js";
import { Dashboard } from "./dashboard.js";
import { runDoctor } from "./doctor.js";
import {
  CONFIG_FILE,
  loadConfig,
  loadDotEnv,
  saveConfig,
  saveTokenToEnv,
} from "./config.js";
import { isPortFree, isPortInUse } from "./net-utils.js";
import {
  HELP,
  STRINGS,
  buildTunnelOptions,
  detectLang,
  guessMode,
  isValidDomain,
  isValidPort,
  normalizeDomain,
  normalizePrefix,
  parseCliArgs,
  type Lang,
  type Plan,
  type ProviderName,
  type PublishMode,
  type Strings,
} from "./cli-utils.js";

const pkg = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
) as { version: string };

function langFromArgv(): string | undefined {
  const index = process.argv.indexOf("--lang");
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function starterHtml(lang: Lang): string {
  const language = lang === "pt" ? "pt-BR" : "en";
  const title = lang === "pt" ? "Meu site" : "My site";
  const text =
    lang === "pt"
      ? "Site publicado com cm-tunnel."
      : "Site published with cm-tunnel.";
  return `<!doctype html>
<html lang="${language}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body>
    <h1>${text}</h1>
  </body>
</html>
`;
}

const STARTER_API = `export default function handler(req, res) {
  res.json({ ok: true, method: req.method, time: new Date().toISOString() });
}
`;

const STARTER_API_SERVER = `import http from 'node:http';

const port = Number(process.env.PORT);

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, url: req.url }));
});

server.listen(port, '127.0.0.1');
`;

function onCancel(s: Strings): never {
  console.log(`\n${s.cancelled}`);
  process.exit(0);
}

async function askText(
  s: Strings,
  message: string,
  initial?: string,
  validate?: (value: string) => boolean | string,
): Promise<string> {
  const res = await prompts(
    { type: "text", name: "value", message, initial, validate },
    { onCancel: () => onCancel(s) },
  );
  return String(res.value ?? "").trim();
}

async function askPassword(s: Strings, message: string): Promise<string> {
  const res = await prompts(
    { type: "password", name: "value", message },
    { onCancel: () => onCancel(s) },
  );
  return String(res.value ?? "").trim();
}

async function askConfirm(
  s: Strings,
  message: string,
  initial: boolean,
): Promise<boolean> {
  const res = await prompts(
    { type: "confirm", name: "value", message, initial },
    { onCancel: () => onCancel(s) },
  );
  return !!res.value;
}

async function askSelect<T extends string>(
  s: Strings,
  message: string,
  choices: { title: string; value: T }[],
  initial: number,
): Promise<T> {
  const res = await prompts(
    { type: "select", name: "value", message, choices, initial },
    { onCancel: () => onCancel(s) },
  );
  return res.value as T;
}

async function askPort(
  s: Strings,
  message: string,
  initial: number,
): Promise<number> {
  const res = await prompts(
    {
      type: "number",
      name: "value",
      message,
      initial,
      min: 1,
      max: 65535,
      validate: (value: number) => isValidPort(Number(value)) || s.invalidPort,
    },
    { onCancel: () => onCancel(s) },
  );
  return Number(res.value);
}

async function ensureFolder(
  s: Strings,
  lang: Lang,
  dir: string | undefined,
  kind: "site" | "api",
  yes: boolean,
  dryRun: boolean,
  apiMode: ApiMode = "handlers",
): Promise<void> {
  if (!dir) return;
  if (dryRun) return;

  const abs = resolve(dir);
  if (existsSync(abs)) {
    if (!statSync(abs).isDirectory()) throw new Error(s.folderNotDir(dir));
    return;
  }

  const create = yes || (await askConfirm(s, s.createFolder(dir), true));
  if (!create) throw new Error(s.folderNotDir(dir));

  mkdirSync(abs, { recursive: true });
  if (kind === "site") {
    writeFileSync(join(abs, "index.html"), starterHtml(lang));
  } else if (apiMode === "server") {
    writeFileSync(join(abs, "index.js"), STARTER_API_SERVER);
  } else {
    writeFileSync(join(abs, "hello.js"), STARTER_API);
  }
  console.log(s.createdFolder(dir));
}

async function chooseFolder(
  s: Strings,
  kind: "site" | "api",
  explicit: string | undefined,
  savedPath: string | undefined,
  yes: boolean,
): Promise<string> {
  const fallback = kind === "site" ? "public" : "api";
  const chosen = explicit ?? savedPath;
  if (chosen) return chosen;

  // Se a pasta padrão já existe, usa direto sem perguntar.
  if (existsSync(resolve(fallback)) || yes) return fallback;

  return await askText(
    s,
    kind === "site" ? s.publicPath : s.apiPath,
    fallback,
    (value) => (value.trim() ? true : s.folderNotDir(value)),
  );
}

async function main(): Promise<void> {
  let opts;
  try {
    opts = parseCliArgs(process.argv.slice(2));
  } catch (err) {
    console.log(HELP[detectLang(langFromArgv())]);
    throw err;
  }

  const lang = detectLang(opts.lang);
  const s = STRINGS[lang];

  if (opts.help) {
    console.log(HELP[lang]);
    return;
  }
  if (opts.version) {
    console.log(`cm-tunnel ${pkg.version}`);
    return;
  }

  if (opts.command === "doctor") {
    process.exitCode = await runDoctor(lang);
    return;
  }

  if (!process.stdin.isTTY && !opts.yes) {
    throw new Error(s.needTty);
  }

  loadDotEnv();

  let saved = loadConfig();
  if (saved) {
    const useSaved = opts.yes || (await askConfirm(s, s.useSaved, true));
    if (!useSaved) saved = null;
  }

  const provider: ProviderName =
    opts.provider ?? saved?.provider ?? "cloudflare";
  const subdomain = opts.subdomain ?? saved?.subdomain;
  const ngrokToken =
    provider === "ngrok" ? process.env.NGROK_AUTHTOKEN || undefined : undefined;

  if (provider === "ngrok" && !ngrokToken) {
    console.warn(s.ngrokTokenMissing);
  }

  if (provider === "cloudflare") {
    const check = spawnSync("cloudflared", ["--version"], { stdio: "ignore" });
    if (check.error) {
      throw new Error(s.cloudflaredMissing);
    }
  }

  const defaultPublic = opts.public ?? saved?.public ?? "public";
  const defaultApi = opts.api ?? saved?.api ?? "api";
  const suggestedMode = guessMode(
    existsSync(resolve(defaultPublic)),
    existsSync(resolve(defaultApi)),
  );

  let mode: "site" | "api" | "both";
  let target: number | undefined;

  if (opts.target !== undefined) {
    target = opts.target;
    mode = opts.mode ?? saved?.mode ?? "both";
  } else if (saved?.target) {
    target = saved.target;
    mode = saved.mode;
  } else if (opts.mode) {
    mode = opts.mode;
  } else if (saved?.mode) {
    // Configuração salva aceita: não repergunta o modo.
    mode = saved.mode;
  } else if (opts.yes) {
    mode = suggestedMode;
  } else {
    const choice = await askSelect<"site" | "api" | "both" | "server">(
      s,
      s.whatPublish,
      [
        { title: s.modeSite, value: "site" },
        { title: s.modeApi, value: "api" },
        { title: s.modeBoth, value: "both" },
        { title: s.modeServer, value: "server" },
      ],
      ["site", "api", "both"].indexOf(suggestedMode),
    );

    if (choice === "server") {
      target = await askPort(s, s.serverPortPrompt, 3000);
      mode = "both";
    } else {
      mode = choice;
    }
  }

  if (target !== undefined && !isValidPort(target)) {
    throw new Error(s.invalidPort);
  }

  const publicPath = target || mode === "api"
    ? undefined
    : await chooseFolder(s, "site", opts.public, saved?.public, opts.yes);

  const apiPath = target || mode === "site"
    ? undefined
    : await chooseFolder(s, "api", opts.api, saved?.api, opts.yes);

  let apiMode: ApiMode | undefined;
  let apiEntry: string | undefined;

  if (!target && mode !== "site" && apiPath) {
    const detectedEntry = ["index.js", "server.js", "app.js"]
      .map((file) => join(apiPath, file))
      .find((file) => existsSync(resolve(file)));
    const suggestedApiMode: ApiMode = detectedEntry ? "server" : "handlers";

    apiMode =
      opts.apiMode ??
      saved?.apiMode ??
      (opts.yes
        ? suggestedApiMode
        : await askSelect<ApiMode>(
            s,
            s.apiModePrompt,
            [
              { title: s.apiModeHandlers, value: "handlers" },
              { title: s.apiModeServer, value: "server" },
            ],
            suggestedApiMode === "server" ? 1 : 0,
          ));

    if (apiMode === "server") {
      const defaultEntry =
        opts.apiEntry ??
        saved?.apiEntry ??
        detectedEntry ??
        join(apiPath, "index.js");

      apiEntry =
        opts.apiEntry ??
        saved?.apiEntry ??
        (opts.yes
          ? defaultEntry
          : await askText(s, s.apiEntryPrompt, defaultEntry));
    }
  }

  if (!target) {
    await ensureFolder(
      s,
      lang,
      publicPath,
      "site",
      opts.yes,
      opts.dryRun,
      apiMode,
    );
    await ensureFolder(
      s,
      lang,
      apiPath,
      "api",
      opts.yes,
      opts.dryRun,
      apiMode,
    );
  }

  if (
    apiMode === "server" &&
    apiEntry &&
    !opts.dryRun &&
    !existsSync(resolve(apiEntry))
  ) {
    throw new Error(s.apiEntryInvalid(apiEntry));
  }

  let publish: PublishMode;
  if (provider !== "cloudflare") {
    if (opts.domain || opts.token || saved?.publish === "domain") {
      console.warn(s.providerQuickOnly(provider));
    }
    publish = "quick";
  } else if (opts.quick) {
    publish = "quick";
  } else if (opts.domain || opts.token) {
    publish = "domain";
  } else if (saved?.publish) {
    publish = saved.publish;
  } else if (opts.yes) {
    publish = "quick";
  } else {
    publish = await askSelect<PublishMode>(
      s,
      s.publishHow,
      [
        { title: s.publishQuick, value: "quick" },
        { title: s.publishDomain, value: "domain" },
      ],
      0,
    );
  }

  let domain: string | undefined;
  let port: number | undefined;
  let token: string | undefined;

  if (publish === "domain") {
    const domainAnswer =
      opts.domain ??
      saved?.domain ??
      (opts.yes ? "" : await askText(s, s.domainPrompt, undefined, (value) =>
        isValidDomain(normalizeDomain(value)) || s.invalidDomain,
      ));

    domain = normalizeDomain(domainAnswer);
    if (!isValidDomain(domain)) {
      throw new Error(s.invalidDomain);
    }

    token = opts.token || process.env.CLOUDFLARE_TOKEN;
    let promptedToken = false;

    if (!token && !opts.dryRun) {
      if (opts.yes) throw new Error(s.missingToken);
      token = await askPassword(s, s.tokenPrompt);
      promptedToken = true;
      if (!token) throw new Error(s.missingToken);
    }

    if (target) {
      port = target;
      if (!opts.dryRun && !(await isPortInUse(target))) {
        console.warn(s.serverNotRunning(target));
      }
    } else {
      port =
        opts.port ??
        saved?.port ??
        (opts.yes ? 3000 : await askPort(s, s.portPrompt, 3000));

      if (!isValidPort(port)) {
        throw new Error(s.invalidPort);
      }

      if (!opts.dryRun && !(await isPortFree(port))) {
        throw new Error(s.portInUse(port));
      }
    }

    if (promptedToken && token && opts.save && !opts.dryRun) {
      saveTokenToEnv(token);
      console.log(s.tokenSaved);
    }
  }

  const plan: Plan = {
    mode,
    public: publicPath,
    api: apiPath,
    apiMode,
    apiEntry,
    apiPrefix: normalizePrefix(opts.apiPrefix ?? saved?.apiPrefix),
    publish,
    domain,
    provider,
    subdomain,
    target,
    port,
  };

  console.log(`\n${s.summaryTitle}`);
  if (target) {
    console.log(`  ${s.summaryServer(target)}`);
  } else {
    if (mode !== "api" && publicPath) {
      console.log(`  ${s.summarySite(publicPath)}`);
    }
    if (mode !== "site" && apiPath) {
      console.log(
        `  ${
          apiMode === "server"
            ? s.summaryApiServer(apiPath, apiEntry ?? "")
            : s.summaryApi(apiPath, plan.apiPrefix)
        }`,
      );
    }
  }
  console.log(
    `  ${
      publish === "quick"
        ? provider === "cloudflare"
          ? s.summaryPublishQuick
          : s.summaryPublishQuickWith(provider)
        : s.summaryPublishDomain(domain!)
    }`,
  );
  if (publish === "domain" && port && !target) {
    console.log(`  ${s.summaryPort(port)}`);
  }
  console.log();

  if (!opts.yes && !(await askConfirm(s, s.confirm, true))) {
    console.log(s.cancelled);
    return;
  }

  if (opts.dryRun) {
    console.log(s.dryRun);
    return;
  }

  const useDashboard = opts.command === "dashboard" && !!process.stdout.isTTY;
  const wantLogs = opts.logs || opts.command === "dashboard";
  const dashboard = useDashboard ? new Dashboard(lang, plan) : null;

  if (opts.command === "dashboard" && !process.stdout.isTTY) {
    console.log(s.dashboardNoTty);
  }

  const tunnelOptions = buildTunnelOptions(plan, token, ngrokToken);
  if (wantLogs) {
    const logSink = (chunk: string) => {
      if (dashboard) {
        dashboard.push(chunk);
      } else {
        process.stdout.write(chunk);
      }
    };

    tunnelOptions.onLog = logSink;
    if (tunnelOptions.serve) {
      tunnelOptions.serve.onLog = logSink;
    }
  }

  if (dashboard) {
    dashboard.start();
  } else {
    console.log(s.starting);
  }

  let t: Awaited<ReturnType<typeof tunnel>>;
  try {
    t = await tunnel(tunnelOptions);
  } catch (err) {
    dashboard?.stop();
    throw err;
  }

  if (dashboard) {
    dashboard.setLocalPort(t.port);
    dashboard.setUrl(t.url);
  } else {
    console.log(s.tunnelUrl(t.url));
    if (target) {
      console.log(`  ${s.summaryServer(target)}`);
    } else {
      if (mode !== "api" && publicPath) {
        console.log(`  ${s.siteServed(publicPath)}`);
      }
      if (mode !== "site" && apiPath) {
        console.log(
          `  ${
            apiMode === "server"
              ? s.summaryApiServer(apiPath, apiEntry ?? "")
              : s.apiServed(apiPath, plan.apiPrefix)
          }`,
        );
      }
    }
    if (publish === "domain" && domain && port) {
      console.log(`  ${s.domainHint(domain, port)}`);
    }
    console.log(s.pressCtrlC);
  }

  // Só salva a configuração depois que o túnel subiu com sucesso.
  if (opts.save) {
    saveConfig(plan);
    if (!dashboard) console.log(s.savedConfig(CONFIG_FILE));
  }

  const stop = () => {
    dashboard?.stop();
    t.stop();
    process.exit(0);
  };

  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((err) => {
  const lang = detectLang(langFromArgv());
  console.error(
    STRINGS[lang].error(err instanceof Error ? err.message : String(err)),
  );
  process.exit(1);
});
