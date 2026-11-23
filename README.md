# cm-tunnel

**Publique um site e uma API em minutos — ou tunelar um servidor que já está rodando.**

Sem Express, sem configurar servidor: aponte as pastas `public` e `api` (ou uma porta existente), responda poucas perguntas e pronto.

- CLI interativo em **português e inglês**
- **Cloudflare Quick Tunnel** (URL na hora) ou **domínio próprio**
- Pasta `api/` roda no servidor e **nunca** é exposta como arquivo
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
- [Licença](#licença)

---

## Comece aqui (30 segundos)

**Pré-requisitos:**

```bash
node -v               # precisa ser >= 18.3
cloudflared --version # precisa existir no PATH
```

Se não tiver o `cloudflared`:
[instalar cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

**Rode:**

```bash
npx cm-tunnel
```

> O CLI faz parte da **v1.5.0+**. Se o `npx` baixar uma versão antiga, rode `npx cm-tunnel@1.5.0`.

O CLI pergunta:

```
? O que você quer publicar? ›
    Só site (arquivos estáticos)
    Só API (funções de servidor)
❯   Site + API
    Servidor já rodando (informar a porta)
? Como você quer publicar? ›
❯   URL temporária (trycloudflare.com) — sem configuração
    Domínio próprio (túnel Cloudflare)
```

> Se `public/` e `api/` não existirem, ele pergunta se pode criá-las com arquivos de exemplo.

No fim:

```
Resumo:
  Site:  public
  API:   api em /api
  Modo:  URL temporária (trycloudflare.com)

Túnel no ar: https://algum-nome-aleatorio.trycloudflare.com
Pressione Ctrl+C para encerrar.
```

As escolhas ficam salvas em `.cm-tunnel.json`. Na próxima vez é só:

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
- `cloudflared` instalado e disponível no `PATH`

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

Nesse modo o `cm-tunnel` **não** inicia servidor nem aplica rate limit próprio — ele só aponta o túnel para a porta informada. Se sua API já usa Express, é o caminho certo.

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

| Arquivo | Rota |
|---|---|
| `public/index.html` | `/` |
| `public/assets/app.js` | `/assets/app.js` |
| `api/hello.js` | `/api/hello` |
| `api/nested/index.js` | `/api/nested` |
| `api/index.js` | `/api` |

- `/api` é reservado: **nunca** cai no estático, mesmo que exista `public/api`.
- Funciona com só `public`, só `api`, ou com as duas.
- `apiPrefix` muda o prefixo padrão (`/api` → `/v1`, por exemplo).

---

## Handlers de API

Use `.js`, `.mjs` ou `.cjs`. TypeScript precisa ser compilado antes.

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
| `--api-prefix <prefixo>` | Prefixo da API (padrão: `/api`) |
| `--target <porta>` | Tunelar um servidor que já está rodando |
| `--port <porta>` | Porta do servidor interno (pastas + domínio) |
| `--domain <domínio>` | Domínio próprio |
| `--token <token>` | Token do túnel (ou use `CLOUDFLARE_TOKEN`/`.env`) |
| `--quick` | URL temporária, sem configuração |
| `--yes`, `-y` | Não perguntar (usa flags/padrões) |
| `--dry-run` | Mostra o plano, não cria nada e não inicia |
| `--logs`, `-l` | Mostra os logs do `cloudflared` (token oculto) |
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
```

**O que é salvo:**

| Arquivo | Conteúdo |
|---------|----------|
| `.cm-tunnel.json` | modo, pastas (ou porta), domínio (sem token) |
| `.env` | `CLOUDFLARE_TOKEN` (permissão `600`) |

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
! Public Hostname: confira no dashboard

Resumo: 6 ok, 1 aviso(s), 2 erro(s)
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
- últimas 10 linhas do `cloudflared`

`Ctrl+C` encerra o túnel e restaura o terminal. Se não houver TTY, cai automaticamente para logs em texto.

### `--logs` — logs sem painel

```bash
npx cm-tunnel --logs
```

Mostra a saída do `cloudflared` direto no terminal, sanitizada (o token nunca aparece).

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

O rate limit do modo pastas é aplicado por IP em `/api` (padrão: 60 req/min) quando há API. No modo `--target`, use o rate limit do seu próprio servidor.

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

- A CLI existe a partir da **1.5.0**:
  ```bash
  npx cm-tunnel@1.5.0
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

- O arquivo precisa estar em `api/` com extensão `.js`, `.mjs` ou `.cjs`.
- A rota segue o caminho do arquivo:
  - `api/hello.js` → `/api/hello`
  - `api/users/index.js` → `/api/users`
- O arquivo precisa exportar uma função:
  ```javascript
  export default function handler(req, res) { ... }
  ```
- Se mudou o prefixo, use o prefixo configurado (`/v1`, etc.).

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
Não. O `cm-tunnel` serve `public/` e executa `api/` sozinho. Se você já tem Express, use `--target <porta>`.

**Posso publicar só o site ou só a API?**
Sim. No CLI escolha “Só site” ou “Só API”, ou use `--mode site` / `--mode api`.

**O código da API fica visível para o cliente?**
Não. A pasta `api/` só é carregada no servidor. `/api` nunca é servido como arquivo estático.

**Funciona com TypeScript?**
Os handlers precisam estar em `.js`, `.mjs` ou `.cjs`. Compile o TypeScript antes.

**Como atualizo o site?**
Basta alterar os arquivos em `public/`. Handlers em `api/` recarregam sozinhos quando o arquivo muda.

**Como paro o túnel?**
`Ctrl+C`. O CLI encerra o `cloudflared` junto.

**Onde ficam as preferências?**
Em `.cm-tunnel.json`, na pasta onde você rodou o CLI. O token fica no `.env`.

**Funciona com pnpm/yarn/bun?**
Sim, desde que o binário `cloudflared` esteja no `PATH`. `npx` e `npm run` são os caminhos mais testados.

**Qual a diferença entre `--port` e `--target`?**
`--port` é a porta do servidor interno do `cm-tunnel` (modo pastas + domínio). `--target` é a porta de um servidor que **você** já está rodando.

---

## Desenvolvimento

```bash
npm install
npm test          # roda a suíte
npm run lint
npm run build     # gera dist/ e deixa dist/cli.js executável
```

Estrutura principal:

```text
src/
├── cli.ts           # executável do CLI
├── cli-utils.ts     # i18n, flags, plano
├── Tunnel.ts        # orquestração dos provedores
├── StaticServer.ts  # servidor de public + api
├── RateLimiter.ts   # rate limit por IP
└── providers/       # cloudflare, localtunnel, ngrok
```

---

## Licença

MIT
