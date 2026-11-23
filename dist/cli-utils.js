import { parseArgs } from "node:util";
export const STRINGS = {
    pt: {
        needTty: "Este terminal não é interativo. Use as flags (ex: --yes --quick --public public --api api) ou rode em um terminal normal.",
        cloudflaredMissing: "cloudflared não encontrado no PATH. Instale em: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
        whatPublish: "O que você quer publicar?",
        modeSite: "Só site (arquivos estáticos)",
        modeApi: "Só API (funções de servidor)",
        modeBoth: "Site + API",
        modeServer: "Servidor já rodando (informar a porta)",
        publicPath: "Pasta do site",
        apiPath: "Pasta da API",
        apiModePrompt: "Como sua API funciona?",
        apiModeHandlers: "Funções por arquivo (handlers)",
        apiModeServer: "Servidor normal (Express, Fastify, Node)",
        apiEntryPrompt: "Arquivo de entrada da API",
        apiEntryInvalid: (entry) => `Arquivo de entrada inválido: ${entry}`,
        serverPortPrompt: "Porta em que seu servidor já está rodando",
        serverNotRunning: (port) => `Aviso: nada parece estar escutando na porta ${port} ainda.`,
        publishHow: "Como você quer publicar?",
        publishQuick: "URL temporária (trycloudflare.com) — sem configuração",
        publishDomain: "Domínio próprio (túnel Cloudflare)",
        domainPrompt: "Domínio (ex: api.meudominio.com.br)",
        tokenPrompt: "Token do túnel (não aparece na tela)",
        portPrompt: "Porta local que o túnel vai apontar",
        createFolder: (dir) => `A pasta "${dir}" não existe. Criar com um arquivo de exemplo?`,
        folderNotDir: (dir) => `Pasta inválida: "${dir}".`,
        createdFolder: (dir) => `Pasta criada: ${dir}`,
        invalidDomain: "Domínio inválido.",
        invalidPort: "Porta inválida (use um número entre 1 e 65535).",
        portInUse: (port) => `A porta ${port} já está em uso. Escolha outra com --port.`,
        missingToken: "Token ausente. Defina CLOUDFLARE_TOKEN, use --token ou rode de forma interativa.",
        summaryTitle: "Resumo:",
        summaryPublishQuickWith: (provider) => `Modo:  URL temporária (${provider})`,
        providerQuickOnly: (provider) => `${provider} não suporta domínio próprio; usando URL temporária.`,
        ngrokTokenMissing: "Aviso: NGROK_AUTHTOKEN não definido. O ngrok pode exigir um authtoken (https://dashboard.ngrok.com/get-started/your-authtoken).",
        ngrokSubdomainIgnored: "Aviso: --subdomain só vale para localtunnel. Para ngrok use --ngrok-domain <dominio-registrado> (ex.: meuapp.ngrok.app).",
        summaryNgrokDomain: (domain) => `Domínio ngrok: ${domain}`,
        summarySite: (dir) => `Site:  ${dir}`,
        summaryApi: (dir, prefix) => `API:   ${dir} em ${prefix}`,
        summaryApiServer: (dir, entry) => `API:   ${dir} (servidor: ${entry})`,
        summaryServer: (port) => `Servidor: http://localhost:${port}`,
        summaryPublishQuick: "Modo:  URL temporária (trycloudflare.com)",
        summaryPublishDomain: (domain) => `Modo:  Domínio próprio (${domain})`,
        summaryPort: (port) => `Porta: ${port}`,
        confirm: "Tudo certo? Publicar agora",
        cancelled: "Cancelado.",
        starting: "Iniciando o túnel...",
        tunnelUrl: (url) => `\nTúnel no ar: ${url}`,
        siteServed: (dir) => `Site servido de ${dir}`,
        apiServed: (dir, prefix) => `API servida de ${dir} em ${prefix}`,
        domainHint: (domain, port) => `No dashboard da Cloudflare, o Public Hostname ${domain} deve apontar para http://localhost:${port}.`,
        pressCtrlC: "Pressione Ctrl+C para encerrar.",
        useSaved: "Configuração encontrada em .cm-tunnel.json. Usar?",
        savedConfig: (file) => `Configuração salva em ${file}`,
        tokenSaved: "Token salvo em .env",
        dryRun: "Dry-run: nada foi iniciado.",
        doctorTitle: "cm-tunnel doctor",
        doctorNodeOk: (version) => `Node.js ${version}: ok`,
        doctorNodeFail: (version) => `Node.js ${version}: precisa ser >= 18.3`,
        doctorCloudflaredOk: (version) => `cloudflared: ${version}`,
        doctorCloudflaredFail: "cloudflared não encontrado no PATH. Instale antes de publicar.",
        doctorConfigOk: (summary) => `Configuração: ${summary}`,
        doctorConfigMissing: "Nenhum .cm-tunnel.json encontrado. Rode cm-tunnel para criar.",
        doctorConfigInvalid: ".cm-tunnel.json inválido. Apague ou rode cm-tunnel de novo.",
        doctorTokenOk: (length) => `Token: presente (${length} caracteres)`,
        doctorTokenMissing: "Token: ausente. Defina CLOUDFLARE_TOKEN no .env ou no ambiente.",
        doctorFolderOk: (dir) => `Pasta ${dir}: ok`,
        doctorFolderMissing: (dir) => `Pasta ${dir}: não encontrada`,
        doctorApiEntryOk: (entry) => `Entry da API: ${entry} ok`,
        doctorApiEntryMissing: (entry) => `Entry da API: ${entry} não encontrado`,
        doctorPortFree: (port) => `Porta ${port}: livre`,
        doctorPortBusy: (port) => `Porta ${port}: em uso (escolha outra com --port)`,
        doctorTargetUp: (port) => `Servidor em localhost:${port}: respondendo`,
        doctorTargetDown: (port) => `Servidor em localhost:${port}: não está escutando (suba seu servidor)`,
        doctorDnsOk: (domain, address) => `DNS ${domain}: resolve para ${address}`,
        doctorDnsFail: (domain) => `DNS ${domain}: não resolve. Verifique nameservers da Cloudflare e o Public Hostname.`,
        doctorHostnameInfo: (domain, port) => `Public Hostname: confira no dashboard (${domain} -> http://localhost:${port})`,
        doctorSummary: (ok, warn, fail) => `Resumo: ${ok} ok, ${warn} aviso(s), ${fail} erro(s)`,
        doctorAllGood: "Tudo certo para publicar.",
        doctorHasErrors: "Corrija os itens com ✖ antes de publicar.",
        dashboardTitle: "cm-tunnel",
        dashboardStarting: "iniciando",
        dashboardOnline: "online",
        dashboardStopped: "parado",
        dashboardUrl: (url) => `URL:   ${url}`,
        dashboardModeSite: "Site",
        dashboardModeApi: "API",
        dashboardModeApiServer: "API (servidor)",
        dashboardModeBoth: "Site + API",
        dashboardModeBothServer: "Site + API (servidor)",
        dashboardModeTarget: (port) => `Servidor http://localhost:${port}`,
        dashboardPublishQuick: "URL temporária",
        dashboardPublishQuickWith: (provider) => `URL temporária (${provider})`,
        dashboardPublishDomain: (domain) => `Domínio ${domain}`,
        dashboardLocal: (value) => `Local: ${value}`,
        dashboardAwaitingLocal: "Local: aguardando...",
        dashboardLogs: "Logs",
        dashboardWaitingLogs: "(aguardando logs...)",
        dashboardCtrlC: "Ctrl+C para encerrar",
        dashboardNoTty: "Sem terminal interativo: mostrando logs em texto em vez do painel.",
        error: (message) => `Erro: ${message}`,
    },
    en: {
        needTty: "This terminal is not interactive. Use flags (e.g. --yes --quick --public public --api api) or run it in a normal terminal.",
        cloudflaredMissing: "cloudflared not found in PATH. Install it from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/",
        whatPublish: "What do you want to publish?",
        modeSite: "Site only (static files)",
        modeApi: "API only (server functions)",
        modeBoth: "Site + API",
        modeServer: "Server already running (enter its port)",
        publicPath: "Site folder",
        apiPath: "API folder",
        apiModePrompt: "How does your API work?",
        apiModeHandlers: "File-based handlers",
        apiModeServer: "Regular server (Express, Fastify, Node)",
        apiEntryPrompt: "API entry file",
        apiEntryInvalid: (entry) => `Invalid entry file: ${entry}`,
        serverPortPrompt: "Port your server is already running on",
        serverNotRunning: (port) => `Warning: nothing seems to be listening on port ${port} yet.`,
        publishHow: "How do you want to publish?",
        publishQuick: "Temporary URL (trycloudflare.com) — no setup",
        publishDomain: "Custom domain (Cloudflare tunnel)",
        domainPrompt: "Domain (e.g. api.example.com)",
        tokenPrompt: "Tunnel token (hidden)",
        portPrompt: "Local port the tunnel should point to",
        createFolder: (dir) => `Folder "${dir}" does not exist. Create it with a sample file?`,
        folderNotDir: (dir) => `Invalid folder: "${dir}".`,
        createdFolder: (dir) => `Folder created: ${dir}`,
        invalidDomain: "Invalid domain.",
        invalidPort: "Invalid port (use a number between 1 and 65535).",
        portInUse: (port) => `Port ${port} is already in use. Choose another with --port.`,
        missingToken: "Missing token. Set CLOUDFLARE_TOKEN, pass --token, or run interactively.",
        summaryTitle: "Summary:",
        summaryPublishQuickWith: (provider) => `Mode:  Temporary URL (${provider})`,
        providerQuickOnly: (provider) => `${provider} does not support custom domains; using a temporary URL.`,
        ngrokTokenMissing: "Warning: NGROK_AUTHTOKEN is not set. ngrok may require an authtoken (https://dashboard.ngrok.com/get-started/your-authtoken).",
        ngrokSubdomainIgnored: "Warning: --subdomain only applies to localtunnel. For ngrok use --ngrok-domain <registered-domain> (e.g. myapp.ngrok.app).",
        summaryNgrokDomain: (domain) => `ngrok domain: ${domain}`,
        summarySite: (dir) => `Site:  ${dir}`,
        summaryApi: (dir, prefix) => `API:   ${dir} at ${prefix}`,
        summaryApiServer: (dir, entry) => `API:   ${dir} (server: ${entry})`,
        summaryServer: (port) => `Server: http://localhost:${port}`,
        summaryPublishQuick: "Mode:  Temporary URL (trycloudflare.com)",
        summaryPublishDomain: (domain) => `Mode:  Custom domain (${domain})`,
        summaryPort: (port) => `Port:  ${port}`,
        confirm: "Looks good? Publish now",
        cancelled: "Cancelled.",
        starting: "Starting tunnel...",
        tunnelUrl: (url) => `\nTunnel is live: ${url}`,
        siteServed: (dir) => `Site served from ${dir}`,
        apiServed: (dir, prefix) => `API served from ${dir} at ${prefix}`,
        domainHint: (domain, port) => `In the Cloudflare dashboard, the Public Hostname ${domain} must point to http://localhost:${port}.`,
        pressCtrlC: "Press Ctrl+C to stop.",
        useSaved: "Found .cm-tunnel.json. Use it?",
        savedConfig: (file) => `Config saved to ${file}`,
        tokenSaved: "Token saved to .env",
        dryRun: "Dry run: nothing was started.",
        doctorTitle: "cm-tunnel doctor",
        doctorNodeOk: (version) => `Node.js ${version}: ok`,
        doctorNodeFail: (version) => `Node.js ${version}: must be >= 18.3`,
        doctorCloudflaredOk: (version) => `cloudflared: ${version}`,
        doctorCloudflaredFail: "cloudflared not found in PATH. Install it before publishing.",
        doctorConfigOk: (summary) => `Config: ${summary}`,
        doctorConfigMissing: "No .cm-tunnel.json found. Run cm-tunnel to create one.",
        doctorConfigInvalid: ".cm-tunnel.json is invalid. Delete it or run cm-tunnel again.",
        doctorTokenOk: (length) => `Token: present (${length} characters)`,
        doctorTokenMissing: "Token: missing. Set CLOUDFLARE_TOKEN in .env or the environment.",
        doctorFolderOk: (dir) => `Folder ${dir}: ok`,
        doctorFolderMissing: (dir) => `Folder ${dir}: not found`,
        doctorApiEntryOk: (entry) => `API entry: ${entry} ok`,
        doctorApiEntryMissing: (entry) => `API entry: ${entry} not found`,
        doctorPortFree: (port) => `Port ${port}: free`,
        doctorPortBusy: (port) => `Port ${port}: in use (choose another with --port)`,
        doctorTargetUp: (port) => `Server at localhost:${port}: responding`,
        doctorTargetDown: (port) => `Server at localhost:${port}: not listening (start your server)`,
        doctorDnsOk: (domain, address) => `DNS ${domain}: resolves to ${address}`,
        doctorDnsFail: (domain) => `DNS ${domain}: does not resolve. Check Cloudflare nameservers and the Public Hostname.`,
        doctorHostnameInfo: (domain, port) => `Public Hostname: check the dashboard (${domain} -> http://localhost:${port})`,
        doctorSummary: (ok, warn, fail) => `Summary: ${ok} ok, ${warn} warning(s), ${fail} error(s)`,
        doctorAllGood: "Everything looks good to publish.",
        doctorHasErrors: "Fix the items marked ✖ before publishing.",
        dashboardTitle: "cm-tunnel",
        dashboardStarting: "starting",
        dashboardOnline: "online",
        dashboardStopped: "stopped",
        dashboardUrl: (url) => `URL:   ${url}`,
        dashboardModeSite: "Site",
        dashboardModeApi: "API",
        dashboardModeApiServer: "API (server)",
        dashboardModeBoth: "Site + API",
        dashboardModeBothServer: "Site + API (server)",
        dashboardModeTarget: (port) => `Server http://localhost:${port}`,
        dashboardPublishQuick: "Temporary URL",
        dashboardPublishQuickWith: (provider) => `Temporary URL (${provider})`,
        dashboardPublishDomain: (domain) => `Domain ${domain}`,
        dashboardLocal: (value) => `Local: ${value}`,
        dashboardAwaitingLocal: "Local: waiting...",
        dashboardLogs: "Logs",
        dashboardWaitingLogs: "(waiting for logs...)",
        dashboardCtrlC: "Ctrl+C to stop",
        dashboardNoTty: "No interactive terminal: showing plain logs instead of the panel.",
        error: (message) => `Error: ${message}`,
    },
};
export const HELP = {
    pt: `cm-tunnel — publique site (public) e API (api) em minutos

Uso:
  npx cm-tunnel                 # interativo
  npx cm-tunnel --yes --quick   # sem perguntas

Comandos:
  doctor                   Verifica ambiente, config, pastas, porta e DNS
  dashboard                Painel com URL, status e logs ao vivo

Opções:
  --mode site|api|both     O que publicar
  --public <pasta>         Pasta do site (padrão: public)
  --api <pasta>            Pasta da API (padrão: api)
  --api-mode handlers|server  Como a API funciona (padrão: handlers)
  --api-entry <arquivo>    Entrypoint no modo server (detectado ou <api>/index.js)
  --api-prefix <prefixo>   Prefixo da API (padrão: /api)
  --target <porta>         Tunelar um servidor que já está rodando
  --port <porta>           Porta local (modo pastas + domínio)
  --provider <nome>        cloudflare | localtunnel | ngrok (padrão: cloudflare)
  --subdomain <nome>       Subdomínio fixo (somente localtunnel)
  --ngrok-domain <dominio> Domínio completo registrado no ngrok
  --domain <dominio>       Domínio próprio (somente Cloudflare)
  --token <token>          Token do túnel Cloudflare
  --quick                  URL temporária, sem configuração
  --yes, -y                Não perguntar (usa flags/padrões)
  --dry-run                Mostra o plano e não inicia
  --logs, -l               Mostra logs do cloudflared e da API (modo server)
  --no-save                Não salvar .cm-tunnel.json
  --lang pt|en             Idioma
  -h, --help               Ajuda
  -v, --version            Versão`,
    en: `cm-tunnel — publish a site (public) and an API (api) in minutes

Usage:
  npx cm-tunnel                 # interactive
  npx cm-tunnel --yes --quick   # no questions

Commands:
  doctor                   Check environment, config, folders, port and DNS
  dashboard                Panel with URL, status and live logs

Options:
  --mode site|api|both     What to publish
  --public <folder>        Site folder (default: public)
  --api <folder>           API folder (default: api)
  --api-mode handlers|server  How the API works (default: handlers)
  --api-entry <file>       Entrypoint in server mode (detected or <api>/index.js)
  --api-prefix <prefix>    API prefix (default: /api)
  --target <port>          Tunnel an already running server
  --port <port>            Local port (folders + domain mode)
  --provider <name>        cloudflare | localtunnel | ngrok (default: cloudflare)
  --subdomain <name>       Fixed subdomain (localtunnel only)
  --ngrok-domain <domain>  Full domain registered with ngrok
  --domain <domain>        Custom domain (Cloudflare only)
  --token <token>          Cloudflare tunnel token
  --quick                  Temporary URL, no setup
  --yes, -y                Do not ask (use flags/defaults)
  --dry-run                Print the plan and do not start
  --logs, -l               Show cloudflared and API logs (server mode)
  --no-save                Do not save .cm-tunnel.json
  --lang pt|en             Language
  -h, --help               Help
  -v, --version            Version`,
};
export function detectLang(explicit, env = process.env) {
    if (explicit === "pt" || explicit === "en")
        return explicit;
    const raw = (env.CM_TUNNEL_LANG || env.LC_ALL || env.LANG || "").toLowerCase();
    return raw.startsWith("pt") ? "pt" : "en";
}
export function parseCliArgs(argv) {
    const { values, positionals } = parseArgs({
        args: argv,
        allowPositionals: true,
        options: {
            lang: { type: "string" },
            help: { type: "boolean", short: "h" },
            version: { type: "boolean", short: "v" },
            yes: { type: "boolean", short: "y" },
            "dry-run": { type: "boolean" },
            logs: { type: "boolean", short: "l" },
            verbose: { type: "boolean" },
            mode: { type: "string" },
            public: { type: "string" },
            api: { type: "string" },
            "api-mode": { type: "string" },
            "api-entry": { type: "string" },
            "api-prefix": { type: "string" },
            target: { type: "string" },
            port: { type: "string" },
            domain: { type: "string" },
            token: { type: "string" },
            provider: { type: "string" },
            subdomain: { type: "string" },
            "ngrok-domain": { type: "string" },
            quick: { type: "boolean" },
            "no-save": { type: "boolean" },
        },
    });
    const mode = values.mode;
    if (mode !== undefined && mode !== "site" && mode !== "api" && mode !== "both") {
        throw new Error(`Invalid --mode: "${mode}". Use site, api or both.`);
    }
    const port = values.port !== undefined ? Number(values.port) : undefined;
    if (port !== undefined && !isValidPort(port)) {
        throw new Error(`Invalid --port: "${values.port}".`);
    }
    const target = values.target !== undefined ? Number(values.target) : undefined;
    if (target !== undefined && !isValidPort(target)) {
        throw new Error(`Invalid --target: "${values.target}".`);
    }
    const lang = values.lang;
    if (lang !== undefined && lang !== "pt" && lang !== "en") {
        throw new Error(`Invalid --lang: "${lang}". Use pt or en.`);
    }
    const apiMode = values["api-mode"];
    if (apiMode !== undefined && apiMode !== "handlers" && apiMode !== "server") {
        throw new Error(`Invalid --api-mode: "${apiMode}". Use handlers or server.`);
    }
    const provider = values.provider;
    if (provider !== undefined &&
        provider !== "cloudflare" &&
        provider !== "localtunnel" &&
        provider !== "ngrok") {
        throw new Error(`Invalid --provider: "${provider}". Use cloudflare, localtunnel or ngrok.`);
    }
    const command = positionals[0];
    if (command !== undefined && command !== "doctor" && command !== "dashboard") {
        throw new Error(`Unknown command: "${command}". Use doctor or dashboard.`);
    }
    return {
        command: command,
        lang: lang,
        help: !!values.help,
        version: !!values.version,
        yes: !!values.yes,
        dryRun: !!values["dry-run"],
        logs: !!(values.logs || values.verbose),
        mode: mode,
        public: values.public,
        api: values.api,
        apiMode: apiMode,
        apiEntry: values["api-entry"],
        apiPrefix: values["api-prefix"],
        target,
        port,
        domain: values.domain,
        token: values.token,
        provider: provider,
        subdomain: values.subdomain,
        ngrokDomain: values["ngrok-domain"],
        quick: !!values.quick,
        save: !values["no-save"],
    };
}
export function isValidPort(port) {
    return Number.isInteger(port) && port >= 1 && port <= 65535;
}
export function normalizeDomain(input) {
    return input
        .trim()
        .replace(/^https?:\/\//i, "")
        .replace(/\/+$/, "");
}
export function isValidDomain(domain) {
    return /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/i.test(domain);
}
export function normalizePrefix(input) {
    let prefix = (input || "/api").trim();
    if (!prefix.startsWith("/"))
        prefix = `/${prefix}`;
    prefix = prefix.replace(/\/+$/, "");
    return prefix || "/api";
}
export function guessMode(publicExists, apiExists) {
    if (publicExists && !apiExists)
        return "site";
    if (!publicExists && apiExists)
        return "api";
    return "both";
}
export function buildTunnelOptions(plan, token, ngrokToken) {
    const provider = plan.provider ?? "cloudflare";
    const cloudflare = plan.publish === "quick"
        ? { mode: "quick" }
        : {
            mode: "named",
            domain: plan.domain,
            token,
        };
    const applyProviderOptions = (options) => {
        if (provider === "localtunnel" && plan.subdomain) {
            options.subdomain = plan.subdomain;
        }
        if (provider === "cloudflare") {
            options.cloudflare = cloudflare;
        }
        else if (provider === "ngrok") {
            if (ngrokToken)
                options.authtoken = ngrokToken;
            // ngrok espera domínio completo; `subdomain` é ignorado pelo SDK.
            if (plan.ngrokDomain)
                options.domain = plan.ngrokDomain;
        }
        return options;
    };
    // Modo servidor: apenas aponta o túnel para a porta já existente.
    if (plan.target) {
        return applyProviderOptions({ provider, port: plan.target });
    }
    const serve = {
        apiPrefix: plan.apiPrefix,
    };
    if (plan.mode !== "api")
        serve.public = plan.public;
    if (plan.mode !== "site")
        serve.api = plan.api;
    if (plan.mode !== "site" && plan.apiMode === "server") {
        serve.apiMode = "server";
        serve.apiEntry = plan.apiEntry;
    }
    if (plan.publish === "domain" && plan.port)
        serve.port = plan.port;
    const options = {
        provider,
        serve,
    };
    if (plan.mode !== "site") {
        options.rateLimit = {
            maxRequestsPerMinute: 60,
            routes: [plan.apiPrefix],
        };
    }
    return applyProviderOptions(options);
}
