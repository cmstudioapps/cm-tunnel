# cm-tunnel

**Publique um site e uma API em minutos — ou tunelar um servidor que já está rodando.**

Sem Express, sem configurar servidor: aponte as pastas `public` e `api` (ou uma porta existente), responda poucas perguntas e pronto.

- CLI interativo em **português e inglês**
- **Cloudflare** (quick ou domínio próprio), **localtunnel** e **ngrok**
- Pasta `api/` roda no servidor e **nunca** é exposta como arquivo
- Reinício automático da API (modo `server`) com backoff
- Funciona com Node.js puro, sem framework

---

## Índice

- [Comece aqui (30 segundos)](#comece-aqui-30-segundos)
- [O que você quer publicar?](#o-que-você-quer-publicar)
- [Instalação e requisitos](#instalação-e-requisitos)
- [Publicar pastas (estilo Vercel)](#publicar-pastas-estilo-vercel)
- [Tunelar um servidor que já existe](#tunelar-um-servidor-que-já-existe)
- [Quick tunnel ou domínio próprio?](#quick-tunnel-ou-domínio-próprio)
- [Onde fica o token?](#onde-fica-o-token)
- [Estrutura de pastas e rotas](#estrutura-de-pastas-e-rotas)
- [Handlers de API](#handlers-de-api)
- [Referência do CLI](#referência-do-cli)
- [Comandos: doctor, dashboard e logs](#comandos-doctor-dashboard-e-logs)
- [API programática](#api-programática)
- [Segurança](#segurança)
- [Problemas comuns](#problemas-comuns)
- [FAQ](#faq)
- [Desenvolvimento](#desenvolvimento)
- [Arquitetura e dívida técnica](https://github.com/cmstudioapps/cm-tunnel/blob/main/ARCHITECTURE.md)
- [Licença](#licença)

---

## Comece aqui (30 segundos)

**Pré-requisitos:**

```bash
node -v               # precisa ser >= 18.3
```

Para o provedor **Cloudflare** (padrão), o `cloudflared` também precisa existir no PATH:

```bash
cloudflared --version
```

Se não tiver o `cloudflared`:
[instalar cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

> Usando `--provider localtunnel` ou `--provider ngrok`, o `cloudflared` não é necessário.

**Rode:**

```bash
npx cm-tunnel
```

> O CLI existe desde a **1.5.0**. `doctor`, `dashboard` e `apiMode: server` exigem a **1.7.0+**. Se o `npx` baixar uma versão antiga, use `npx cm-tunnel@latest` (ou `@1.7.0`).

O CLI pergunta:

```
? O que você quer publicar? ›
    Só site (arquivos estáticos)
    Só API (funções de servidor)
❯   Site + API
    Servidor já rodando (informar a porta)
? Como sua API funciona? ›
    Funções por arquivo (handlers)
❯   Servidor normal (Express, Fastify, Node)
? Arquivo de entrada da API › api/index.js
? Como você quer publicar? ›
❯   URL temporária (trycloudflare.com) — sem configuração
    Domínio próprio (túnel Cloudflare)
```

> As perguntas de pasta, `apiMode` e `apiEntry` só aparecem quando fazem sentido. Se `public/` e `api/` não existirem, ele oferece criar com arquivos de exemplo (`index.html`, `hello.js` ou um `index.js` de servidor).

No fim:

```
Resumo:
  Site:  public
  API:   api em /api
  Modo:  URL temporária (trycloudflare.com)

Túnel no ar: https://algum-nome-aleatorio.trycloudflare.com
Pressione Ctrl+C para encerrar.
```

As escolhas são salvas em `.cm-tunnel.json` **depois que o túnel sobe com sucesso**. Na próxima vez é só:

```bash
npx cm-tunnel
# ou, sem nenhuma pergunta:
npx cm-tunnel --yes
```

---

## O que você quer publicar?

| Cenário | Comando |
|---|---|
| Site + API em pastas | `npx cm-tunnel` → **Site + API** |
| Só site estático | `npx cm-tunnel` → **Só site** |
| Só API | `npx cm-tunnel` → **Só API** |
| Meu Express já roda na porta 3000 | `npx cm-tunnel --yes --quick --target 3000` |
| Minha API é um Express normal dentro de `api/` | `npx cm-tunnel --yes --quick --api-mode server` |
| Testar rápido, sem configurar nada | `npx cm-tunnel --yes --quick` |
| Domínio próprio | `npx cm-tunnel --domain api.meudominio.com.br` |

---

## Instalação e requisitos

**CLI (sem instalar nada):**

```bash
npx cm-tunnel
```

**Local no projeto:**

```bash
npm install cm-tunnel
npx cm-tunnel
```

**Global (opcional):**

```bash
npm install -g cm-tunnel
cm-tunnel
```

**Requisitos:**

- Node.js **>= 18.3**
- `cloudflared` **somente** se você usar o provedor Cloudflare (o padrão). Com `--provider localtunnel` ou `--provider ngrok`, ele não é necessário.

**Por que `npx` funciona sem entrar em `node_modules`?**

O npm cria um atalho em `node_modules/.bin/cm-tunnel`. O `npx` procura nele automaticamente. O `npm run deploy` também adiciona esse diretório ao `PATH`. Só dá “command not found” se você digitar `cm-tunnel` puro no shell sem instalar globalmente — nesse caso use `npx cm-tunnel`.

---

## Publicar pastas (estilo Vercel)

Você precisa apenas de duas pastas:

```text
meu-projeto/
├── public/
│   ├── index.html
│   └── assets/
│       └── app.js
├── api/
│   ├── hello.js
│   └── users/
│       └── index.js
├── .env                # CLOUDFLARE_TOKEN (não versionar)
└── .cm-tunnel.json     # gerado pelo CLI
```

E rodar:

```bash
npx cm-tunnel
```

O CLI detecta `public/` e `api/` existentes e nem pergunta os caminhos. Se não existirem, ele oferece criar com arquivos de exemplo.

**Equivalente em código:**

```javascript
import tunnel from 'cm-tunnel';

const t = await tunnel({
  provider: 'cloudflare',
  serve: {
    public: './public',
    api: './api',
  },
});

console.log(t.url);
```

Se quiser apenas site ou apenas API, use só uma das opções:

```javascript
serve: { public: './public' } // só site
serve: { api: './api' }       // só API
```

### API em modo servidor (Express, Fastify ou `http`)

Se sua pasta `api/` é uma aplicação normal — e não funções por arquivo — use `apiMode: "server"`.

```text
api/
└── index.js   # app.listen(process.env.PORT)
```

```bash
npx cm-tunnel --yes --quick --api-mode server
```

No modo interativo, o CLI pergunta:

```
? Como sua API funciona? ›
    Funções por arquivo (handlers)
❯   Servidor normal (Express, Fastify, Node)
? Arquivo de entrada da API › api/index.js
```

O que a lib faz:

- injeta `PORT` e inicia `node api/index.js`
- serve `public/` normalmente
- encaminha `/api/*` para o app, removendo o prefixo
- espera o app responder antes de subir o túnel
- reinicia o app automaticamente se ele cair (backoff de 500 ms a 30 s, até 5 tentativas; zera após 60 s no ar)
- encerra o app no `Ctrl+C`

Exemplo de `api/index.js`:

```javascript
import express from 'express';

const app = express();

app.get('/hello', (req, res) => {
  res.json({ ok: true });
});

app.listen(process.env.PORT);
```

Com o padrão `stripApiPrefix: true`:

```text
GET /api/hello  →  app recebe /hello
GET /api/users  →  app recebe /users
```

> O app precisa escutar em `process.env.PORT`. Se ele já usa uma porta fixa, use o modo `--target <porta>`.

Se a API cair depois de subir, o supervisor reinicia o processo automaticamente. Desative com `apiRestart: false` (ou `apiRestartMaxAttempts: 0`) e ajuste as tentativas com `apiRestartMaxAttempts`.

**Equivalente em código:**

```javascript
const t = await tunnel({
  provider: 'cloudflare',
  serve: {
    public: './public',
    api: './api',
    apiMode: 'server',
    apiEntry: './api/index.js',
    // stripApiPrefix: false, // mantém /api no app
  },
});
```

---

## Tunelar um servidor que já existe

Se você já tem um servidor rodando (Express, Fastify, `http`, etc.) na porta 3000:

```bash
npx cm-tunnel --yes --quick --target 3000
```

Ou, no modo interativo, escolha:

```
? O que você quer publicar? ›
❯   Servidor já rodando (informar a porta)
? Porta em que seu servidor já está rodando › 3000
```

Nesse modo o `cm-tunnel` **não** inicia servidor nem aplica rate limit próprio — ele só aponta o túnel para a porta informada. Use quando você já roda o processo e quer controle total dele.

**Equivalente em código:**

```javascript
import tunnel from 'cm-tunnel';

const t = await tunnel({
  provider: 'cloudflare',
  port: 3000,
});

console.log(t.url);
```

---

## Quick tunnel ou domínio próprio?

| | Quick tunnel | Domínio próprio |
|---|---|---|
| **URL** | `https://algo-aleatorio.trycloudflare.com` | `https://api.seudominio.com.br` |
| **Configuração** | nenhuma | token + Public Hostname + DNS |
| **Estável entre reinícios** | não | sim |
| **Indicado para** | testes, demos, uso rápido | produção, API pública |
| **Ativa no CLI** | `--quick` | `--domain seu.dominio.com` |

### Provedores de túnel

| Provedor | Flag | Domínio próprio | Observações |
|---|---|---|---|
| Cloudflare | `--provider cloudflare` (padrão) | sim (`--domain`) | Requer `cloudflared` |
| localtunnel | `--provider localtunnel` | não | Aceita `--subdomain` (nome curto) |
| ngrok | `--provider ngrok` | domínio registrado no ngrok | `NGROK_AUTHTOKEN` + `--ngrok-domain` |

```bash
# localtunnel com subdomínio fixo (nome curto)
npx cm-tunnel --yes --provider localtunnel --subdomain meuapp

# ngrok (token em NGROK_AUTHTOKEN)
npx cm-tunnel --yes --provider ngrok

# ngrok com domínio completo já registrado no painel do ngrok
npx cm-tunnel --yes --provider ngrok --ngrok-domain meuapp.ngrok.app
```

> `localtunnel` e `ngrok` não usam domínio próprio da Cloudflare. Se você pedir `--domain`, o CLI avisa e usa URL temporária.
>
> `--subdomain` vale **só** para localtunnel. O ngrok espera um domínio completo em `--ngrok-domain` — o SDK dele ignora `subdomain`.

### Domínio próprio: checklist

1. O domínio precisa estar na Cloudflare com a zona **Active** (nameservers da Cloudflare no Registro.br).
2. O túnel precisa existir no dashboard (Zero Trust → Networks → Tunnels).
3. Configure o **Public Hostname** do túnel:

   ```text
   api.seudominio.com.br  →  http://localhost:3000
   ```

4. Passe o domínio e o token no CLI:

   ```bash
   npx cm-tunnel --domain api.seudominio.com.br
   ```

> A porta do passo 3 precisa ser a mesma que o CLI usa. No modo pastas + domínio, o CLI usa a porta informada (`--port`, padrão `3000`). No modo `--target`, é a porta do seu servidor.

---

## Onde fica o token?

**Pelo dashboard (recomendado):**

1. Cloudflare Zero Trust → **Networks → Tunnels**
2. Clique no seu túnel
3. **Configure → Install connector**
4. Copie o valor depois de `--token`

**Pela CLI (requer `cloudflared tunnel login` antes):**

```bash
cloudflared tunnel token <nome-ou-id-do-tunel>
```

**Onde guardar:**

- Variável de ambiente:
  ```bash
  export CLOUDFLARE_TOKEN='eyJ...'
  ```
- Ou no `.env` do projeto:
  ```bash
  CLOUDFLARE_TOKEN=eyJ...
  ```
  O CLI carrega `.env` automaticamente e, se você digitar o token no prompt, salva com permissão `600`.

> O token **nunca** vai para `.cm-tunnel.json`. Não faça commit do `.env`.

---

## Estrutura de pastas e rotas

No modo `handlers` (padrão):

| Arquivo | Rota |
|---|---|
| `public/index.html` | `/` |
| `public/assets/app.js` | `/assets/app.js` |
| `api/hello.js` | `/api/hello` |
| `api/nested/index.js` | `/api/nested` |
| `api/index.js` | `/api` |

- `/api` é reservado: **nunca** cai no estático, mesmo que exista `public/api`.
- No modo `apiMode: "server"`, tudo em `/api/*` é encaminhado para o seu app (com o prefixo removido por padrão).
- Funciona com só `public`, só `api`, ou com as duas.
- `apiPrefix` muda o prefixo padrão (`/api` → `/v1`, por exemplo).

---

## Handlers de API

No modo `handlers` (padrão), use `.js`, `.mjs` ou `.cjs`. TypeScript precisa ser compilado antes.

**Função default (qualquer método):**

```javascript
// api/hello.js
export default function handler(req, res) {
  res.status(200).json({ ok: true, url: req.url });
}
```

**Funções por método:**

```javascript
// api/users.js
export const GET = (req, res) => res.json({ users: [] });
export const POST = (req, res) => res.status(201).json({ created: true });
```

**Retornando direto:**

```javascript
// api/status.js
export default () => ({ ok: true });
```

Helpers disponíveis no `res`: `res.status()`, `res.json()` e `res.send()` (estilo Vercel/Express).

Editar um handler recarrega automaticamente na próxima requisição, sem reiniciar o processo.

---

## Referência do CLI

```text
npx cm-tunnel [opções]
```

| Flag | Descrição |
|------|-----------|
| `--mode site\|api\|both` | O que publicar (pastas) |
| `--public <pasta>` | Pasta do site (padrão: `public`) |
| `--api <pasta>` | Pasta da API (padrão: `api`) |
| `--api-mode handlers\|server` | API por arquivo (`handlers`) ou servidor normal (`server`) |
| `--api-entry <arquivo>` | Entrypoint no modo server (detectado ou `<api>/index.js`) |
| `--api-prefix <prefixo>` | Prefixo da API (padrão: `/api`) |
| `--target <porta>` | Tunelar um servidor que já está rodando |
| `--port <porta>` | Porta do servidor interno (pastas + domínio) |
| `--provider <nome>` | `cloudflare` (padrão), `localtunnel` ou `ngrok` |
| `--subdomain <nome>` | Subdomínio fixo (somente `localtunnel`) |
| `--ngrok-domain <domínio>` | Domínio completo já registrado no ngrok |
| `--domain <domínio>` | Domínio próprio (somente Cloudflare) |
| `--token <token>` | Token do túnel (ou use `CLOUDFLARE_TOKEN`/`.env`) |
| `--quick` | URL temporária, sem configuração |
| `--yes`, `-y` | Não perguntar (usa flags/padrões) |
| `--dry-run` | Mostra o plano, não cria nada e não inicia |
| `--logs`, `-l` | Mostra logs do `cloudflared` e do servidor de API (no modo `server`) |
| `--no-save` | Não salva `.cm-tunnel.json` nem o token |
| `--lang pt\|en` | Idioma (padrão: detecta pelo `LANG`) |
| `-h`, `--help` | Ajuda |
| `-v`, `--version` | Versão |

**Exemplos:**

```bash
# pastas, URL temporária
npx cm-tunnel --yes --quick --public public --api api

# servidor existente na 3000
npx cm-tunnel --yes --quick --target 3000

# domínio próprio (token via .env)
npx cm-tunnel --yes --domain api.meudominio.com.br --port 3000

# só API, prefixo /v1
npx cm-tunnel --yes --mode api --api api --api-prefix /v1

# conferir o plano sem iniciar
npx cm-tunnel --dry-run

# inglês
npx cm-tunnel --lang en

# sem Cloudflare (não precisa de cloudflared)
npx cm-tunnel --yes --provider localtunnel --subdomain meuapp
npx cm-tunnel --yes --provider ngrok
npx cm-tunnel --yes --provider ngrok --ngrok-domain meuapp.ngrok.app
```

**O que é salvo:**

| Arquivo | Conteúdo |
|---------|----------|
| `.cm-tunnel.json` | modo, pastas (ou porta), `apiMode`/`apiEntry`, provedor, subdomínio/domínio ngrok, domínio (sem token) |
| `.env` | `CLOUDFLARE_TOKEN` (permissão `600`) e/ou `NGROK_AUTHTOKEN` |

---

## Comandos: doctor, dashboard e logs

### `doctor` — diagnóstico completo

```bash
npx cm-tunnel doctor
```

Verifica:

- versão do Node
- `cloudflared` instalado
- `.cm-tunnel.json` válido
- token presente (quando usa domínio)
- pastas `public`/`api`
- entrypoint da API (quando `apiMode = "server"`)
- porta livre (ou servidor respondendo no modo `--target`)
- DNS do domínio
- lembrete do Public Hostname

Exemplo de saída:

```text
cm-tunnel doctor

✔ Node.js 20.19.2: ok
✔ cloudflared: cloudflared version 2026.11.1
✔ Configuração: mode=both, publish=domain, domain=escola.exemplo.com, port=3000
✔ Token: presente (184 caracteres)
✔ Pasta public: ok
✔ Pasta api: ok
✔ Porta 3000: livre
✖ DNS escola.exemplo.com: não resolve
! Public Hostname: confira no dashboard (escola.exemplo.com -> http://localhost:3000)

Resumo: 7 ok, 1 aviso(s), 1 erro(s)
Corrija os itens com ✖ antes de publicar.
```

Sai com código `1` se houver erro.

### `dashboard` — painel com logs ao vivo

```bash
npx cm-tunnel dashboard
```

Mostra em tela cheia:

- status (iniciando / online / parado)
- URL pública
- modo (site, API, site + API ou servidor)
- porta local
- últimas 10 linhas do `cloudflared` e do servidor de API (no modo `server`)

`Ctrl+C` encerra o túnel e restaura o terminal. Se não houver TTY, cai automaticamente para logs em texto.

### `--logs` — logs sem painel

```bash
npx cm-tunnel --logs
```

Mostra a saída do `cloudflared` e do servidor de API direto no terminal. A saída do `cloudflared` é sanitizada (token oculto); os logs do seu app são repassados como estão — evite imprimir segredos neles.

---

## API programática

### Publicar pastas

```javascript
import tunnel from 'cm-tunnel';

const t = await tunnel({
  provider: 'cloudflare',
  serve: {
    public: './public',
    api: './api',
    // apiPrefix: '/v1',
  },
  rateLimit: {
    maxRequestsPerMinute: 60,
    routes: ['/api'],
  },
  cloudflare: {
    mode: 'named',
    domain: 'api.meudominio.com.br',
    token: process.env.CLOUDFLARE_TOKEN,
  },
});

console.log(t.url);

t.on('ready', (url) => console.log('Pronto:', url));
t.on('close', () => console.log('Túnel fechado'));
t.on('error', (err) => console.error('Erro:', err.message));
```

### Servidor existente

```javascript
const t = await tunnel({
  provider: 'cloudflare',
  port: 3000,
  cloudflare: {
    mode: 'named',
    domain: 'api.meudominio.com.br',
    token: process.env.CLOUDFLARE_TOKEN,
  },
});
```

### Simplificada

```javascript
const t1 = await tunnel.cloudflare({ port: 3000 });
const t2 = await tunnel.localtunnel({ port: 3000 });
const t3 = await tunnel.ngrok({ port: 3000, authtoken: 'seu_token' });
```

### Servidor local sem túnel

Útil para testar `public`/`api` sem expor nada:

```javascript
const local = await tunnel.serve({
  public: './public',
  api: './api',
});

console.log(local.url); // http://127.0.0.1:<porta>
// local.stop()
```

### Opções do Cloudflare

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `mode` | `'quick' \| 'named'` | `'quick'` | Inferido como `named` se `token`, `domain`, `tunnelId`, `tunnelName` ou `credentialsFile` forem fornecidos |
| `domain` | `string` | — | Domínio retornado em `t.url` (configure o Public Hostname no dashboard) |
| `tunnelId` | `string` | — | ID do túnel; necessário apenas sem token (com `credentialsFile`) |
| `tunnelName` | `string` | — | Nome do túnel (alternativa ao `tunnelId`) |
| `token` | `string` | — | Token do túnel (dashboard ou `cloudflared tunnel token`) |
| `credentialsFile` | `string` | — | Arquivo `.json` gerado por `cloudflared tunnel create` |
| `protocol` | `string` | `'https'` | Protocolo usado em `t.url` |
| `cloudflaredPath` | `string` | `'cloudflared'` | Caminho do executável |
| `timeout` | `number` | `30000` | Timeout de inicialização em ms |

### Opções de `serve`

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `public` | `string` | — | Pasta de arquivos estáticos |
| `directory` | `string` | — | Alias legado de `public` |
| `api` | `string` | — | Pasta com handlers; nunca é servida como estático |
| `apiMode` | `'handlers' \| 'server'` | `'handlers'` | `handlers` = um arquivo por rota; `server` = app normal (Express/Fastify/http) |
| `apiEntry` | `string` | `<api>/index.js` | Arquivo de entrada no modo `server` |
| `stripApiPrefix` | `boolean` | `true` | Remove `/api` antes de encaminhar ao servidor |
| `apiTimeout` | `number` | `30000` | Tempo para o servidor ficar pronto |
| `apiRestart` | `boolean` | `true` | Reinicia a API se o processo cair (modo `server`) |
| `apiRestartMaxAttempts` | `number` | `5` | Tentativas consecutivas antes de desistir |
| `onLog` | `(line: string) => void` | — | Recebe logs do servidor de API |
| `apiPrefix` | `string` | `'/api'` | Prefixo das rotas de API |
| `html` | `string` | — | HTML fixo para rotas não-API (prioridade sobre `public`) |
| `port` | `number` | aleatória | Porta local do servidor interno |

### Objeto de retorno

| Campo | Descrição |
|-------|-----------|
| `provider` | Nome do provedor |
| `url` | URL pública |
| `port` | Porta local (do servidor interno quando `serve` é usado) |
| `stop()` | Encerra o túnel e limpa recursos |
| `process` | Objeto interno do provedor (depende do provedor) |

O retorno também é um `EventEmitter` com `ready`, `close` e `error`. O `ready` é reemitido após `start()` resolver, então pode ser escutado depois do `await`.

---

## Segurança

O modo pastas já protege por padrão:

- `/api` é reservado e nunca cai no estático.
- Arquivos da pasta `api/` só rodam no servidor; o cliente não consegue baixá-los.
- Dotfiles (`.env`, `.git`) são bloqueados.
- Path traversal (`../`) é bloqueado.
- Symlinks que apontem para fora de `public/` (ou para dentro de `api/`) são bloqueados.
- O token não vai para `.cm-tunnel.json`; o `.env` é criado com permissão `600`.

O rate limit do modo pastas é aplicado por IP em `/api` (padrão: 60 req/min) quando há API. O IP vem do cabeçalho confiável do provedor: `cf-connecting-ip` na Cloudflare e o **último** valor de `x-forwarded-for` em localtunnel/ngrok (o primeiro valor é ignorado para não permitir falsificação). No modo `--target`, use o rate limit do seu próprio servidor.

---

## Problemas comuns

> **Antes de tudo:** rode `npx cm-tunnel doctor`. Ele mostra Node, `cloudflared`, configuração, pastas, porta, token e DNS de uma vez.

### `cloudflared: command not found`

Instale o `cloudflared` e garanta que ele está no `PATH`:
[Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

---

### `The tunnel credentials file should be .json but you gave a .pem`

Você passou o `cert.pem` em `credentialsFile`. O `cert.pem` serve para **gerenciar** túneis, não para executá-los.

Use uma das opções:

```bash
# token (recomendado para túneis do dashboard)
cloudflared tunnel token <nome-ou-id>

# ou credenciais JSON de um túnel criado localmente
cloudflared tunnel create meu-tunnel
# gera ~/.cloudflared/<id>.json
```

---

### Domínio abre com erro 1033, 502 ou NXDOMAIN

Verifique nesta ordem:

1. **DNS ativo na Cloudflare?** O domínio precisa usar os nameservers da Cloudflare.
2. **Public Hostname configurado?** Zero Trust → Tunnels → seu túnel → Public Hostname.
3. **O serviço aponta para a porta certa?** Ex.: `http://localhost:3000`.
4. **O túnel está rodando?** O CLI imprime `Túnel no ar: ...`.

Enquanto a zona estiver `pending` na Cloudflare, nada resolve publicamente.

---

### `Port 3000 is already in use`

- Modo pastas: escolha outra porta:
  ```bash
  npx cm-tunnel --port 3001
  ```
  (e atualize o Public Hostname para `http://localhost:3001`)
- Modo servidor existente: use `--target 3000`; aí a porta é do seu servidor, o CLI não tenta ocupá-la.

---

### `npx cm-tunnel` diz que o comando não existe ou abre uma versão antiga

- O CLI existe desde a **1.5.0**; `doctor`, `dashboard` e `apiMode: server` exigem **1.7.0+**.
  ```bash
  npx cm-tunnel@latest --version
  ```
- Confirme a versão:
  ```bash
  npx cm-tunnel --version
  ```

---

### `cm-tunnel: command not found`

`cm-tunnel` puro só existe se instalado globalmente. Use:

```bash
npx cm-tunnel
```

ou adicione um script no `package.json`:

```json
{
  "scripts": {
    "deploy": "cm-tunnel"
  }
}
```

```bash
npm run deploy
```

---

### A API responde 404

No modo `handlers`:

- O arquivo precisa estar em `api/` com extensão `.js`, `.mjs` ou `.cjs`.
- A rota segue o caminho do arquivo:
  - `api/hello.js` → `/api/hello`
  - `api/users/index.js` → `/api/users`
- O arquivo precisa exportar uma função:
  ```javascript
  export default function handler(req, res) { ... }
  ```
- Se mudou o prefixo, use o prefixo configurado (`/v1`, etc.).

No modo `server`, o 404 vem do **seu** app — confira as rotas dele e se o prefixo `/api` está sendo removido (`stripApiPrefix`).

---

### A API em modo server não sobe (502 ou timeout)

- **`API encerrou antes de ficar pronta (código 0)`**: o entry não abriu servidor. Ele precisa chamar `app.listen(process.env.PORT)`. Se o arquivo exporta só uma função `(req, res)`, use `apiMode: "handlers"` / `--api-mode handlers`.
- O app precisa escutar em **`process.env.PORT`** — a lib injeta a porta.
- O `apiEntry` precisa existir (padrão: `api/index.js`).
- Rode com `--logs` para ver a saída do seu app.
- Se o app demorar, aumente `apiTimeout` (padrão: 30s).
- Se o app usa uma porta fixa, use `--target <porta>` em vez de `apiMode: "server"`.

---

### Minha pasta `api` está sendo servida como estático

Isso não acontece com o `serve`/CLI. Mas se você usa Express, garanta que `express.static('public')` não aponte para uma pasta que contenha a `api`, e registre `/api` antes do estático.

---

### O token parou de funcionar

Gere de novo:

```bash
cloudflared tunnel token <nome-ou-id>
```

Ou no dashboard: **Configure → Refresh token**. Atualize o `.env`.

---

## FAQ

**Preciso de Express?**
Não. Você pode usar handlers por arquivo, apontar `apiMode: "server"` para um app Express/Fastify seu, ou rodar o app você mesmo e usar `--target <porta>`.

**Posso publicar só o site ou só a API?**
Sim. No CLI escolha “Só site” ou “Só API”, ou use `--mode site` / `--mode api`.

**O código da API fica visível para o cliente?**
Não. A pasta `api/` só é carregada no servidor. `/api` nunca é servido como arquivo estático.

**Funciona com TypeScript?**
Os handlers e o entry do modo `server` precisam ser JavaScript executável (`.js`, `.mjs` ou `.cjs`). Compile o TypeScript antes.

**Como atualizo o site?**
Basta alterar os arquivos em `public/`. No modo `handlers`, os arquivos em `api/` recarregam sozinhos quando mudam. No modo `server`, o seu processo decide (reinicie se ele não tiver hot reload).

**Como paro o túnel?**
`Ctrl+C`. O CLI encerra o `cloudflared` e, no modo `server`, também encerra o processo da API.

**Onde ficam as preferências?**
Em `.cm-tunnel.json`, na pasta onde você rodou o CLI. O token fica no `.env`.

**Funciona com pnpm/yarn/bun?**
Sim, desde que o binário `cloudflared` esteja no `PATH`. `npx` e `npm run` são os caminhos mais testados.

**Qual a diferença entre `--port` e `--target`?**
`--port` é a porta do servidor interno do `cm-tunnel` (modo pastas + domínio). `--target` é a porta de um servidor que **você** já está rodando.

---

## Desenvolvimento

> Arquitetura interna, fluxos, decisões e dívida técnica: [ARCHITECTURE.md](https://github.com/cmstudioapps/cm-tunnel/blob/main/ARCHITECTURE.md)

```bash
npm install
npm test          # roda a suíte
npm run lint
npm run build     # gera dist/ e deixa dist/cli.js executável
npm run check:self # impede self-dependency e node_modules/cm-tunnel
```

Estrutura principal:

```text
src/
├── cli.ts           # executável do CLI
├── cli-utils.ts     # i18n, flags, plano
├── config.ts        # .env e .cm-tunnel.json
├── net-utils.ts     # portas livres/em uso
├── doctor.ts        # diagnóstico
├── dashboard.ts     # painel TUI
├── Tunnel.ts        # orquestração dos provedores
├── StaticServer.ts  # static + handlers + proxy para api server
├── RateLimiter.ts   # rate limit por IP
└── providers/       # cloudflare, localtunnel, ngrok
```

---

## Licença

MIT
