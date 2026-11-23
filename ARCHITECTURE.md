# Arquitetura e manutenção — cm-tunnel

> Documento de manutenção. Explica como a lib/CLI funcionam por dentro, onde cada
> coisa fica, quais decisões não óbvias existem e qual é a dívida técnica conhecida.
>
> Versão de referência: a do `package.json`. Repo: https://github.com/cmstudioapps/cm-tunnel

---

## 1. Visão em 30 segundos

```
CLI (src/cli.ts)                 ou                 API programática (src/index.ts)
        │                                                   │
        └──────────────────────┬────────────────────────────┘
                               ▼
                    createTunnel (src/Tunnel.ts)
                               │
              ┌────────────────┼────────────────┐
              ▼                ▼                ▼
      StaticServer        RateLimiter       Provider
   (public/api/handlers)  (proxy + IP)   (cloudflare,
              │                │          localtunnel,
              └──────► porta ──┘          ngrok)
                               │
                               ▼
                          internet (Cloudflare etc.)
```

O fluxo de portas é importante:

1. Você informa uma porta (ou o `StaticServer` abre uma aleatória).
2. Se `serve` existe, o túnel aponta para o `StaticServer`.
3. Se `rateLimit` existe, o túnel aponta para o `RateLimiter`, que aponta para o alvo anterior.
4. O provider recebe sempre a **porta final** que ele deve tunelar.

---

## 2. Mapa de arquivos

### Código de produção (`src/`)

| Arquivo | Responsabilidade |
|---|---|
| `src/index.ts` | API pública: `tunnel()`, atalhos `cloudflare/localtunnel/ngrok/serve`, tipos exportados. |
| `src/Tunnel.ts` | Orquestração: valida Cloudflare, escolhe provider, sobe `serve`, aplica `rateLimit`, cria o provider e o `TunnelInstance`. |
| `src/StaticServer.ts` | Servidor HTTP local: estático (`public`/`directory`/`html`), API em **handlers**, API em **server mode** (spawn + proxy) e **supervisor** com restart/backoff. |
| `src/RateLimiter.ts` | Proxy HTTP/WS com limite por IP usando `bancoz`, match por segmento e limpeza periódica. |
| `src/Provider.ts` | Classe base `Provider extends EventEmitter` e tipos `ProviderOptions`/`TunnelResult`. |
| `src/providers/cloudflare.ts` | Spawn do `cloudflared`, modos quick/named, detecção de URL/erros, sanitização de token. |
| `src/providers/localtunnel.ts` | Provider LocalTunnel. |
| `src/providers/ngrok.ts` | Provider Ngrok. |
| `src/cli.ts` | Executável interativo: prompts, plan, start, logs/dashboard, sinais. |
| `src/cli-utils.ts` | Tipos (`Plan`, `CliOptions`, `ProviderName`), flags, i18n PT/EN, `buildTunnelOptions`, validações. |
| `src/config.ts` | `.env` e `.cm-tunnel.json`: carregar, salvar, token com `chmod 600`. |
| `src/doctor.ts` | `cm-tunnel doctor`: diagnóstico de ambiente/config/rede. |
| `src/dashboard.ts` | Painel TUI (ANSI) com status, URL e últimas linhas de log. |
| `src/net-utils.ts` | `findFreePort`, `isPortFree`, `isPortInUse`. |
| `src/bancoz.d.ts` | Tipagem mínima para o `bancoz`. |

### Testes e fixtures (`tests/`)

| Caminho | Cobre |
|---|---|
| `tests/tunnel.test.ts` | API pública, validações, Cloudflare quick/named com `child_process` mockado, `onLog`, `ready` após `await`, erros de saída, limpeza de recursos quando o provider falha. |
| `tests/serve.test.ts` | Estático, handlers, segurança (dotfiles/traversal), API em modo server, 405, timeout/erro de entry, restart com backoff e `stop()`. |
| `tests/cli.test.ts` | Flags, comandos, provedores, normalização de domínio/prefixo, `buildTunnelOptions`. |
| `tests/rate-limiter.test.ts` | Match por segmento, limite global/seletivo, isolamento por IP, `cleanupExpired`. |
| `tests/fixtures/public/` | Site e arquivo `public/api/secret.js` para provar que API nunca vira estático. |
| `tests/fixtures/api/` | Handlers de exemplo (`hello.js`, `echo.js`, `method.js`, `nested/index.js`, `boom.js`). |
| `tests/fixtures/api-server/` | App HTTP normal para o modo `apiMode: "server"`; `bad.js` morre antes de ficar pronto; `crash.js` cai após ficar pronto (testa o supervisor via `CM_TUNNEL_CRASH_MARKER`). |

### Build, publicação e config

| Caminho | Papel |
|---|---|
| `dist/` | Saída do `tsc`; **versionada** no Git e incluída no pacote npm. |
| `vitest.config.ts` | Exclui `node_modules`, `dist` e `.remote` da suíte. |
| `package.json` | `bin`, `files`, scripts, `prepublishOnly`, versão. |
| `.gitignore` | `node_modules`, `.env`, `.cm-tunnel.json`, `.remote`, `skills`, `*.tgz`. |
| `examples/` | Exemplos antigos de uso programático; **não** entram no `tsconfig` atual. |
| `projeto.md` | Notas antigas do projeto; versionado por decisão histórica. |
| `skills/` | Ferramenta local de editor; **ignorada** no Git. |

### Arquivos de runtime (no projeto do usuário)

| Arquivo | Conteúdo |
|---|---|
| `.cm-tunnel.json` | `mode`, `public`, `api`, `apiMode`, `apiEntry`, `apiPrefix`, `publish`, `domain`, `provider`, `subdomain`, `target`, `port`. **Sem token.** |
| `.env` | `CLOUDFLARE_TOKEN=...` (permissão `600`) e/ou `NGROK_AUTHTOKEN`. |
| `public/` | Site estático. |
| `api/` | Handlers **ou** app normal, dependendo de `apiMode`. |

---

## 3. Fluxo de `createTunnel` (`src/Tunnel.ts`)

1. Se **não** há `serve`, exige `port` válida. Com `serve`, a porta é opcional.
2. Exige `provider`.
3. `validateCloudflareOptions` roda **antes** de carregar o provider:
   - modo inferido como `named` se houver `token`, `domain`, `tunnelId`, `tunnelName` ou `credentialsFile`;
   - sem token exige `tunnelId`/`tunnelName` **e** `credentialsFile`;
   - token + `credentialsFile` juntos = erro;
   - `credentialsFile` precisa existir e ser `.json` (nunca `cert.pem`).
4. Provider é carregado por um **mapa explícito** (`providerLoaders`), não por `import()` com variável
   (Vite/test runners não resolvem import dinâmico com variável).
5. Se `serve`, sobe o `StaticServer` e a porta alvo vira a porta dele.
6. Se `rateLimit`, sobe o `RateLimiter` apontando para a porta alvo e a porta alvo vira a do proxy.
7. Instancia o provider com `{ ...options, port: targetPort }`.
8. Encaminha eventos:
   - `ready` é reemitido com `setImmediate` porque os providers emitem antes de `start()` resolver;
   - `error` só é reemitido depois de `started = true` (evita `Unhandled 'error' event` durante startup);
   - `close` para rate limiter e static server.
9. `TunnelInstance.port` retorna `options.port ?? servedPort ?? targetPort`.
10. `stop()` encerra rate limiter, static server e provider.
11. **Falha no provider** após `serve`/`rateLimit` terem subido: `cleanup()` encerra ambos antes de relançar o erro, evitando portas/processos órfãos.

---

## 4. Modos de operação

| Modo | Como entra | Quem serve o quê |
|---|---|---|
| `--target <porta>` | `TunnelOptions.port` | Você já roda o servidor; a lib só tunela. Sem `serve`, sem rate limit próprio. |
| Pastas + `handlers` (padrão) | `serve.public` + `serve.api` | `public/` estático; `api/*.js` vira rota. |
| Pastas + `server` | `serve.apiMode = "server"` + `apiEntry` | `public/` estático; `/api/*` vai para o processo do seu app. |
| Só site | `serve.public` | Estático apenas. |
| Só API | `serve.api` | Handlers ou server, conforme `apiMode`. |

---

## 5. `StaticServer` em detalhe

### 5.1 Campos e normalização

- `staticRoot = public ?? directory`.
- `apiRoot = api` (resolvido com `path.resolve`).
- `apiPrefix` normalizado para começar com `/` e sem barra final; fallback `/api`.
- `apiMode`: `"handlers"` (padrão) ou `"server"`.
- `stripApiPrefix`: padrão `true`.
- `apiEntry`: no modo server, `path.resolve(apiEntry)` ou `<api>/index.js`.
- `apiRestart`: padrão `true`; `apiRestartMaxAttempts`: padrão `5` (só modo server).

### 5.2 Segurança do estático

- `parsePathname` decodifica e normaliza; rejeita `\0`.
- `hasDotSegment` bloqueia `.env`, `.git`, etc.
- `path.resolve` + `isInside` bloqueiam traversal.
- `realpath` é aplicado ao arquivo e conferido contra `staticRealRoot`; symlink que escapa é bloqueado.
- Qualquer arquivo real dentro de `apiRealRoot` é bloqueado no estático.
- `/api` é reservado mesmo sem pasta de API.

### 5.3 Modo handlers

- Extensões: `.js`, `.mjs`, `.cjs`.
- Resolução:
  - `/api` → `api/index.js`
  - `/api/hello` → `api/hello.js` ou `api/hello/index.js`
- O módulo é importado com `?v=<mtime>` e `/* @vite-ignore */`, invalidando o cache quando o arquivo muda.
- Handler aceito:
  - `export default function (req, res)`
  - `export const GET/POST/...`
  - objeto default com métodos
- `res` ganha `status()`, `json()` e `send()`.
- Se o handler retorna objeto/string e não encerrou a resposta, a lib envia JSON/texto.
- Códigos: 404 sem arquivo, 405 método não suportado, 500 handler inválido/erro.
- Código da API nunca é servido como estático.

### 5.4 Modo server

Em `startApiServer` (delega para `spawnApiProcess`):

1. `findFreePort()` pega uma porta livre em `127.0.0.1`.
2. `spawn(process.execPath, [apiEntry], { cwd: process.cwd(), env: { ...process.env, PORT, CM_TUNNEL_API_PORT } })`.
3. Saída do app é repassada para `serve.onLog`.
4. A lib espera o app responder, consultando `isPortInUse(port)` a cada **100 ms**, até `apiTimeout` (padrão **30 s**).
5. Se o processo morrer antes: erro com `código/sinal`, saída e dica (`apiMode: "handlers"`).
6. Se ficar pronto: cria `http-proxy` para `http://127.0.0.1:<port>` com `ws: true` e liga o supervisor.
7. Em `/api/*`, o prefixo é removido por padrão (`/api/users` → `/users`).
8. Upgrade de WebSocket também é proxiado e reescrito.
9. `stop()` mata o processo, fecha o proxy e cancela reinícios pendentes.

**Supervisor (restart):**

- Se o processo morrer depois de pronto (`apiReady`), `teardownApi()` fecha o proxy e `scheduleApiRestart` agenda um novo spawn.
- Backoff: `500 ms × 2^(tentativa-1)`, teto de **30 s**.
- Após **5** tentativas consecutivas sem sucesso, desiste e loga que a API ficou fora do ar.
- Se a API fica **60 s** no ar, o contador de tentativas zera (`apiHealthyTimer`, `unref()`).
- Durante o restart, requisições `/api/*` respondem **502** até o novo processo estar pronto.
- `apiRestart: false` desativa; `apiRestartMaxAttempts` controla o limite.
- `stopping = true` (via `stop()`) sempre impede novos reinícios.

### 5.5 Estático

- `html` tem prioridade e responde qualquer rota não-API.
- Só `GET`/`HEAD`; outros métodos → 405.
- Diretório → `index.html`.
- MIME types definidos em `MIME_TYPES`.
- Arquivos são servidos por stream (`createReadStream`).
- `HEAD` responde sem body.

---

## 6. `RateLimiter`

- Sobe um `http.Server` em porta aleatória e um `http-proxy` para o alvo.
- **IP do cliente** (`resolveClientIp`):
  - `Tunnel.ts` injeta o cabeçalho confiável conforme o provedor: Cloudflare → `cf-connecting-ip`; localtunnel/ngrok → `x-forwarded-for` com `strategy: 'last'` (ignora o primeiro valor, que o cliente pode forjar).
  - O valor é validado com `net.isIP`; inválido cai para `socket.remoteAddress`.
  - `clientIp: false` usa só o socket; uma escolha explícita do usuário nunca é sobrescrita.
- Se `routes` vazio ou `true`: aplica globalmente. Caso contrário, `pathMatchesRoute(url, route)` compara **segmentos** (`/api` casa `/api` e `/api/x`, mas não `/api2`).
- Janela de 60 s; ao exceder `maxRequestsPerMinute`, bloqueia por 60 s (429).
- **Atomicidade:** ler e escrever no `bancoz` são operações separadas; `withKeyLock` serializa **por chave** para não perder incrementos sob concorrência. (Vale para um processo; múltiplos processos no mesmo `BANCO Z` ainda podem disputar.)
- Persistência via `bancoz` (chave sanitizada do IP, tabela `ratelimit`).
- `cleanupExpired()` remove entradas com janela e bloqueio vencidos; roda a cada **5 min** (`setInterval(...).unref()`) e no `stop()`. A remoção também é feita sob o lock e reconfere a entrada.
- WebSocket: `upgrade` é proxiado.
- Testes em `tests/rate-limiter.test.ts` (inclui concorrência e falsificação de IP).

---

## 7. Provider Cloudflare (`src/providers/cloudflare.ts`)

- Modo inferido: quick (sem auth) ou named (com token/credenciais).
- Argumentos:
  - quick: `tunnel --url http://localhost:PORT`
  - token: `tunnel --url ... run --token <TOKEN>`
  - JSON: `tunnel --credentials-file <file> --url ... run <id|nome>`
- Sucesso:
  - quick: regex de `https://<label>.trycloudflare.com`, ignorando `api.trycloudflare.com` (endpoint da API que aparece em erros);
  - named: `Registered tunnel connection`, `registered connIndex=` ou `Connection ... registered`.
- Erros detectados por substring (heurística frágil): connection refused, cert.pem, token inválido/expirado, credenciais, tunnel not found, rede, hostname/ingress.
- `lastOutput` guarda as últimas 4 KB para enriquecer o erro de encerramento.
- `sanitizeOutput` oculta o token e JWTs.
- `onLog` recebe a saída sanitizada.
- Timeout configurável; `stop()` mata o processo.

**Limitação:** detecção por substring depende da mensagem do `cloudflared`. Mudanças de texto podem quebrar a detecção.

---

## 8. CLI (`src/cli.ts` + `src/cli-utils.ts`)

### 8.1 Ordem do `main`

1. `parseCliArgs` (`node:util parseArgs`), com comandos `doctor`/`dashboard`.
2. `--help`, `--version`.
3. `doctor` roda e encerra (não exige TTY).
4. Exige TTY se não for `--yes`.
5. `loadDotEnv` + `loadConfig`.
6. Resolve o provedor: `--provider` > `.cm-tunnel.json` > `cloudflare`.
7. Se existe config, pergunta se quer usá-la; `--yes` aceita direto.
8. Só verifica `cloudflared --version` quando o provedor é `cloudflare`.
9. Define modo/fonte:
   - `--target` → servidor existente;
   - pastas + `site/api/both`;
   - `--yes` auto-detecta pastas existentes.
10. Define pastas (`public`/`api`), pergunta só se não existirem.
11. Define `apiMode` (handlers/server) e `apiEntry` quando server.
12. Cria pastas com starter (`index.html`, `hello.js` ou `index.js` de servidor).
13. Define publish (quick/domain), domínio, token e porta.
    - Provedor ≠ `cloudflare` sempre usa URL temporária; `--domain`/`--token` apenas avisam.
    - Token Cloudflare: `--token` → `CLOUDFLARE_TOKEN` → `.env` → prompt.
    - ngrok: `NGROK_AUTHTOKEN`; domínio completo via `--ngrok-domain` (o SDK ignora `subdomain`).
    - `--subdomain` só é usado por localtunnel.
    - Token digitado é salvo em `.env` com `chmod 600` (se `--save`).
    - Porta em domínio: checa se está livre (pastas) ou se o servidor responde (`target`).
14. Imprime resumo e confirma.
15. `--dry-run` encerra sem criar nada/salvar.
16. `dashboard`/`--logs` configuram o sink de logs.
17. `tunnel(...)` sobe o túnel.
18. **Só depois do sucesso** salva `.cm-tunnel.json`.
19. `SIGINT`/`SIGTERM` encerram dashboard, túnel e app de API.

### 8.2 Precedência de configuração

```
provedor: --provider > .cm-tunnel.json > cloudflare
flags CLI > .cm-tunnel.json (se aceito) > detecção/defaults
token: --token > CLOUDFLARE_TOKEN > .env > prompt
token ngrok: NGROK_AUTHTOKEN
```

### 8.3 Strings e ajuda

- `STRINGS` e `HELP` ficam em `src/cli-utils.ts`.
- Idioma: `--lang pt|en`, `CM_TUNNEL_LANG`, `LC_ALL`/`LANG`; fallback `en`.
- O CLI usa `prompts` (CJS) para select/text/password/confirm/number.

---

## 9. `doctor` e `dashboard`

### doctor (`src/doctor.ts`)

Verifica Node, `cloudflared` (somente se o provedor for Cloudflare), config, token (quando domínio), pastas/entry, porta livre ou servidor ativo, DNS e lembra do Public Hostname. Falhas → exit code 1.

**Não verifica:** validade real do token, Public Hostname no dashboard, ingress rules. Isso exige API token de conta (não o token do túnel).

### dashboard (`src/dashboard.ts`)

- Só ativa com `stdout.isTTY`; caso contrário o CLI cai para logs em texto.
- Guarda as últimas 10 linhas, com debounce de 100 ms.
- Tela limpa com ANSI (`\x1b[2J\x1b[H`), esconde/mostra cursor.
- Mostra status, URL, modo, publicação, porta local e logs.
- Não tem scroll, resize complexo ou histórico.

---

## 10. Config e segredos

`.cm-tunnel.json` (exemplo):

```json
{
  "mode": "both",
  "public": "public",
  "api": "api",
  "apiMode": "handlers",
  "apiEntry": "api/index.js",
  "apiPrefix": "/api",
  "publish": "domain",
  "domain": "escola.caiomultiversando.com.br",
  "provider": "cloudflare",
  "port": 3000
}
```

- `target` substitui `public`/`api` (modo servidor existente).
- `apiMode`/`apiEntry` só fazem sentido sem `target`.
- `provider` ausente é tratado como `cloudflare` (retrocompatível).
- `subdomain` só é usado por `localtunnel`.
- `ngrokDomain` (domínio completo) só é usado por `ngrok`.
- `.env` guarda `CLOUDFLARE_TOKEN` e/ou `NGROK_AUTHTOKEN`; nunca vão para o JSON.
- Token em texto puro no `.env` (proteção por permissão `600`).

---

## 11. Segurança — garantias e limites

Garantias:

- `/api` nunca cai no estático.
- Dotfiles e `../` bloqueados.
- Symlink que escapa de `public` ou entra em `api` é bloqueado.
- Código de `api/` nunca é servido como arquivo.
- Token do `cloudflared` é sanitizado nos logs.
- Token não é gravado no `.cm-tunnel.json`.

Limites:

- Logs do **seu** app de API são repassados sem sanitização.
- Rate limit é por processo/IP e depende do `bancoz`.
- `doctor` não consegue validar Public Hostname/ingress.
- Domínio próprio ainda exige configuração manual no dashboard.

---

## 12. Testes

- **127 testes** (33 CLI, 22 serve, 49 tunnel, 23 rate-limiter).
- `vitest.config.ts` exclui `.remote` (clone temporário de manutenção).
- `child_process` é mockado nos testes de provider; não há teste real contra o `cloudflared`.
- Fixtures de API em `tests/fixtures/api` e `tests/fixtures/api-server`.
- `crash.js` usa `CM_TUNNEL_CRASH_MARKER` para cair só na primeira execução; o teste espera o log de restart.
- `tests/fixtures/public/.env` é criado em `beforeAll` e removido em `afterAll` (não versionado).
- `rate-limiter.test.ts` usa um diretório temporário do `bancoz` (`bancoz.path(tmp)`).

Lacunas de teste:

- Sem teste E2E com Cloudflare real (depende de rede/conta).
- Sem teste automatizado de TTY/CLI interativo (prompts).
- Sem teste de Windows.
- Sem teste de `doctor`/`dashboard` (só validação manual).

---

## 13. Build, publicação e GitHub

- Build: `tsc` para `dist/`, depois `chmod 755 dist/cli.js`.
- `bin`: `cm-tunnel → dist/cli.js`.
- `files`: `dist`, `README.md`, `LICENSE`. **Não precisa de `.npmignore`** (allowlist vence).
- `prepublishOnly`: lint → testes → `check:self` → build.
- `check:self` falha se:
  - `dependencies["cm-tunnel"]` existir (self-dependency);
  - `node_modules/cm-tunnel` existir (cópia aninhada).

### Checklist de release

```bash
git status                    # limpo
npm run prepublishOnly        # lint + 127 testes + check:self + build
npm pack --dry-run            # confira 31 arquivos, sem tests/src/.env
npm version patch             # quando aplicável
npx --yes npm@11 publish      # npm 9.2 travava no fluxo web de 2FA
git push origin main
npm view cm-tunnel version    # confirme a versão publicada
```

> **Incidente histórico:** uma vez rodaram `npm install cm-tunnel` dentro da própria
> pasta do projeto. Isso criou `"cm-tunnel": "^1.5.0"` nas dependências e uma cópia
> em `node_modules/cm-tunnel`. O guard `check:self` existe para impedir que volte.
> A 1.7.0 publicada ainda contém esse erro; a 1.7.1+ corrige.
>
> **Incidente 1.8.0:** a 1.8.0 foi publicada antes dos fixes de concorrência/IP no
> RateLimiter, do `domain` no ngrok e do log do supervisor. Como o npm não permite
> republicar a mesma versão, a **1.8.1** é a versão correta a instalar.

---

## 14. Dívida técnica conhecida

### P0 — resolver antes de divulgar

| Item | Onde | Impacto | Sugestão |
|---|---|---|---|
| 1.7.0 publicada com self-dependency | `package.json` | Instala cópia aninhada desnecessária | Corrigido na 1.7.1+ (`check:self`) |
| Sem CI | GitHub | Regressões passam | Action rodando lint/test/build/check:self |
| Fluxo de publish manual e frágil | npm 9.2 | Trava no web auth | Usar npm 11 ou token granular com bypass 2FA |

### P1 — limitações que usuários vão encontrar

| Item | Onde | Impacto | Sugestão |
|---|---|---|---|
| `apiPrefix` não pode ser `/` | `cli-utils.normalizePrefix`, `StaticServer` | Não serve API no root de um subdomínio em modo pastas | Permitir `/` ou mapear host → backend |
| Sem múltiplos backends/hostnames por processo | `Tunnel.ts`/`StaticServer` | Precisa de um túnel por porta | Mapa `routes: [{prefix|host, target}]` |
| Sem flags `stripApiPrefix`/`apiTimeout` | `cli-utils` | Ajuste só via código | Expor flags |
| Logs da API sem sanitização | `StaticServer` | Segredos no log do app aparecem | Filtros configuráveis |
| Detecção de erro do Cloudflare por substring | `providers/cloudflare.ts` | Quebra se o `cloudflared` mudar texto | Preferir exit codes/JSON/log estruturado |
| `doctor` não valida token/Public Hostname | `doctor.ts` | Falso “ok” | API token de conta opcional |

### P2 — melhorias e manutenção

| Item | Onde | Impacto |
|---|---|---|
| TypeScript não roda direto | `StaticServer`/CLI | Handler/entry precisam ser `.js` |
| Dashboard básico | `dashboard.ts` | Sem scroll/resize |
| `dist/` versionado | Git | Diffs grandes; decisão consciente para uso via git |
| `examples/` fora do `tsconfig` | `tsconfig.json` | Podem ficar desatualizados |
| Sem changelog/tags | Git | Histórico de versões fraco |
| `prompts` CJS | `cli.ts` | Dependência legada |
| Windows não testado | — | Caminhos/binários podem falhar |
| `projeto.md`/`skills` | repo | Housekeeping |

---

## 15. Como estender

### Nova flag no CLI

1. Adicione em `parseCliArgs` (`cli-utils.ts`).
2. Adicione ao tipo `CliOptions`.
3. Use em `cli.ts` (precedência: flag > config > default).
4. Adicione em `HELP` e na tabela do README.
5. Se virar parte do plano, adicione em `Plan` e `buildTunnelOptions`.
6. Teste em `tests/cli.test.ts`.

### Novo provider

1. Crie `src/providers/novo.ts` exportando default uma classe que estende `Provider`.
2. Implemente `start(): Promise<TunnelResult>`.
3. Registre em `providerLoaders` (`Tunnel.ts`).
4. Adicione o nome em `ProviderName` e em `parseCliArgs`/`HELP`/README (validação de `--provider`).
5. Ajuste `buildTunnelOptions` se o provider exigir opções próprias (ex.: `authtoken`).
6. Adicione testes com `child_process`/lib mockados.
7. Documente no README.

### Novo modo de API

1. Estenda `ServeOptions`/`ApiMode` em `StaticServer.ts`.
2. Trate em `handle()` e no ciclo de vida (`start`/`stop`).
3. Adicione em `Plan`/`buildTunnelOptions` se o CLI precisar.
4. Crie fixtures e testes em `tests/serve.test.ts`.
5. Atualize `doctor`, `dashboard`, README e ARCHITECTURE.

### Release

Siga o checklist da seção 13. Nunca rode `npm install cm-tunnel` dentro deste repo.

---

## 16. Mapa de erros comuns

| Erro | Causa provável | Onde olhar |
|---|---|---|
| `API encerrou antes de ficar pronta (código 0)` | Entry não chama `listen(process.env.PORT)`; é handler | `StaticServer.startApiServer`, config `apiMode` |
| `A API encerrou inesperadamente: código N` | App caiu depois de pronto; supervisor vai reiniciar | `StaticServer.scheduleApiRestart`, `--logs` |
| `Limite de 5 reinícios atingido` | App morre repetidamente no boot | corrigir o app ou `apiRestartMaxAttempts` |
| `API não ficou pronta em 30s` | App não escuta na porta injetada / demora | `apiTimeout`, `PORT`, `--logs` |
| `Port X is already in use` | Porta do servidor interno ocupada | `cli.ts` (`isPortFree`), `--port` |
| `The tunnel credentials file should be .json...` | Passou `cert.pem` em `credentialsFile` | `validateCredentialsFile` |
| `Token do túnel Cloudflare inválido/expirado` | Token revogado/expirado | `providers/cloudflare.ts`, `.env` |
| Domínio 1033/502/NXDOMAIN | DNS pending ou Public Hostname ausente | `doctor`, dashboard Cloudflare |
| `npx cm-tunnel` não acha comando | Versão antiga/publicação | `package.json bin`, npm |
| 404 na API | Rota/arquivo/prefixo/environment errado | `StaticServer.handleApi`, `apiPrefix` |
| 502 no modo server | App morreu ou não está escutando | `startApiServer`, `--logs` |
| ngrok recusa o domínio | `--subdomain` (ignorado) ou domínio não registrado no ngrok | use `--ngrok-domain <dominio.ngrok.app>` |
| Publish npm travando | 2FA `auth-and-writes` + web auth do npm 9 | use `npm@11`/`--otp` (não é bug do código) |

---

## 17. Decisões não óbvias (e por quê)

- **Mapa explícito de providers** em vez de `import()` com variável: Vite/test runners não resolvem; também melhora tree-shaking.
- **`ready` com `setImmediate`**: providers emitem antes de `start()` resolver; sem isso, listeners registrados após `await` perdem o evento.
- **Guard de `error` antes de `started`**: reemitir cedo derrubava o processo com `Unhandled 'error' event`.
- **Config só após sucesso**: evita sobrescrever uma config boa com um modo que falhou.
- **`/api` reservado sempre**: consistência e proteção contra expor `public/api`.
- **`apiPrefix` não aceita `/`**: hoje o fallback é `/api`; limitação documentada.
- **`files` no package.json**: allowlist mais segura que `.npmignore`; o tarball tem 31 arquivos.
- **`dist/` versionado**: decisão consciente para uso via Git; o publish também o inclui.
- **`check:self`**: incidente real de self-dependency; bloqueia no `prepublishOnly`.
- **Match por segmento no rate limit**: `startsWith` casava `/api2` com `/api`; agora compara `/api` e `/api/...`.
- **IP confiável por provedor**: confiar em `cf-connecting-ip` fora da Cloudflare (ou no primeiro `x-forwarded-for`) permitia falsificação; cada provedor define o cabeçalho e a estratégia.
- **Lock por chave no rate limit**: `bancoz` trava cada operação, mas leitura e escrita são separadas; sem serializar por chave, requisições simultâneas do mesmo IP perdiam incrementos.
- **ngrok usa `domain`**: o SDK marca `subdomain` como unused e espera um domínio completo; `--subdomain` ficou restrito ao localtunnel.
- **Limpeza periódica do bancoz**: sem TTL nativo, então `cleanupExpired()` varre a tabela e apaga entradas vencidas (5 min + no `stop()`).
- **Supervisor com backoff e teto de saúde**: 5 tentativas, 500 ms → 30 s; 60 s no ar zera o contador para não desistir de quedas esporádicas ao longo do dia.
- **Provedor no CLI**: `localtunnel`/`ngrok` não têm domínio próprio; o CLI força URL temporária em vez de falhar tarde no provider.
- **npm 11 no publish**: o npm 9.2 travava após o web auth de 2FA.
- **Token nunca no JSON**: `.env` com `600`; `doctor` só verifica presença, não validade.
