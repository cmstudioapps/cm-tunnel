# cm-tunnel

Exponha seu servidor HTTP local para a internet através de uma API extremamente simples. Suporta **Cloudflare**, **LocalTunnel** e **Ngrok**.

## Instalação

```bash
npm install cm-tunnel
```

## Requisitos


- Node.js >= 18
- Para usar o provedor do Cloudflare, o executável `cloudflared` deve estar instalado no sistema e disponível no `PATH`. Caso não esteja, a biblioteca emitirá um erro amigável.

## Uso

### API Principal

```javascript
import tunnel from 'cm-tunnel';

try {
  const t = await tunnel({
    provider: 'cloudflare', // 'cloudflare', 'localtunnel' ou 'ngrok'
    port: 3000,
    subdomain: 'meu-app-unico', // Opcional (para localtunnel e ngrok)
    authtoken: 'token_aqui',    // Opcional (recomendado para ngrok)
    serve: {                    // Opcional: Servidor Estático Interno
      html: '<h1>Online!</h1>', // String HTML para servir
      // directory: './public'  // Alternativa: Serve uma pasta inteira
    },
    rateLimit: {                // Opcional: Bloqueia IPs por excesso de requisições
      maxRequestsPerMinute: 60,
      routes: ['/api/']         // Se vazio, aplica globalmente
    }
  });

  console.log('Túnel público:', t.url);

  t.on('ready', (url) => console.log('Pronto:', url));
  t.on('close', () => console.log('Túnel fechado'));
  t.on('error', (err) => console.error('Erro:', err));

} catch(err) {
  console.error(err.message);
}
```

### API Simplificada

```javascript
import tunnel from 'cm-tunnel';

// Usando cloudflare
const t1 = await tunnel.cloudflare({ port: 3000 });

// Usando localtunnel
const t2 = await tunnel.localtunnel({ port: 3000 });

// Usando ngrok
const t3 = await tunnel.ngrok({ port: 3000, authtoken: 'seu_token' });
```

### Cloudflare Quick Tunnel (padrão)

Cria um túnel temporário com URL aleatória `trycloudflare.com`. É o comportamento padrão — não precisa de nenhuma configuração extra.

```javascript
import tunnel from 'cm-tunnel';

const t = await tunnel.cloudflare({ port: 3000 });
console.log(t.url); // https://random-words.trycloudflare.com
```

### Cloudflare Named Tunnel (domínio personalizado)

Utiliza um túnel Cloudflare previamente criado e configurado para servir em um domínio próprio.

**Pré-requisitos:**

1. Instale o `cloudflared`: [Download](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Autentique: `cloudflared tunnel login`
3. Crie um túnel: `cloudflared tunnel create meu-tunnel`
4. Configure o DNS: `cloudflared tunnel route dns meu-tunnel api.meudominio.com.br`

**Uso com a API simplificada (recomendado):**

```javascript
import tunnel from 'cm-tunnel';

const t = await tunnel.cloudflare({
  port: 3000,
  domain: 'api.meudominio.com.br',
  tunnelId: 'ID_DO_TUNNEL',
});

console.log(t.url); // https://api.meudominio.com.br
```

**Uso com a API principal:**

```javascript
import tunnel from 'cm-tunnel';

const t = await tunnel({
  provider: 'cloudflare',
  port: 3000,
  cloudflare: {
    mode: 'named',
    domain: 'api.meudominio.com.br',
    tunnelId: 'ID_DO_TUNNEL',
    credentialsFile: '/home/user/.cloudflared/abc-123.json', // Opcional
  },
});

console.log(t.url); // https://api.meudominio.com.br
```

#### Opções do Cloudflare

| Opção | Tipo | Padrão | Descrição |
|-------|------|--------|-----------|
| `mode` | `'quick' \| 'named'` | `'quick'` | Modo do túnel. Inferido automaticamente se `domain` ou `tunnelId` forem fornecidos. |
| `domain` | `string` | — | Domínio personalizado (obrigatório para named tunnels). |
| `tunnelId` | `string` | — | ID do túnel Cloudflare (obrigatório para named tunnels, alternativa a `tunnelName`). |
| `tunnelName` | `string` | — | Nome do túnel Cloudflare (alternativa ao `tunnelId`). |
| `credentialsFile` | `string` | — | Caminho para o arquivo de credenciais `.json` do túnel. |
| `cloudflaredPath` | `string` | `'cloudflared'` | Caminho personalizado para o executável `cloudflared`. |
| `timeout` | `number` | `30000` | Timeout em milissegundos para aguardar a inicialização do túnel. |

> **Nota:** Na API simplificada (`tunnel.cloudflare()`), as opções podem ser passadas diretamente no mesmo objeto. Na API principal (`tunnel()`), devem ser passadas dentro da chave `cloudflare`.

### Servidor HTML/Estático Standalone (Sem Túnel)

Você também pode usar a nossa engine de servidor embutida apenas para testar páginas locais rapidamente, sem expô-las à internet (útil para desenvolvimento local):

```javascript
import tunnel from 'cm-tunnel';

const localServer = await tunnel.serve({
  html: '<h1>Teste Local</h1>',
  // directory: './public',
  port: 8080 // Opcional
});

console.log('Rodando localmente em:', localServer.url);
// localServer.stop() para encerrar
```

## Objeto de Retorno

A função retorna uma Promise que resolve em um objeto `TunnelInstance` contendo:

- `provider` (string): O nome do provedor utilizado.
- `url` (string): A URL pública gerada pelo túnel.
- `port` (number): A porta local.
- `stop()` (function): Método para encerrar o túnel corretamente.
- `process` (any): Acesso ao processo interno (`ChildProcess` para cloudflare ou objeto do `localtunnel`).

O objeto retornado também é um `EventEmitter`, emitindo os eventos `ready`, `close` e `error`.

## Tratamento de Erros

A biblioteca trata automaticamente os seguintes cenários:

- **`cloudflared` não instalado** — erro claro com link para download.
- **Porta local sem servidor** — detecta "connection refused" e emite erro.
- **Túnel não encontrado** — identifica IDs/nomes inválidos.
- **Credenciais ausentes/inválidas** — orienta a reconfigurar com `cloudflared tunnel login`.
- **Timeout na inicialização** — configurável via opção `timeout`.
- **Processo encerrado inesperadamente** — emite evento `close` e limpa recursos.
- **Caminho personalizado inválido** — erro específico quando `cloudflaredPath` não existe.

## Adicionando novos provedores

A arquitetura de `cm-tunnel` é modular. Para adicionar um novo provedor:
1. Crie um arquivo em `src/providers/[nome-do-provedor].ts`.
2. Exporte como default uma classe que estenda a classe `Provider`.
3. Implemente o método abstrato `start(): Promise<TunnelResult>`.
4. O núcleo carregará automaticamente o novo provedor quando chamado com `provider: '[nome-do-provedor]'`.

## Licença

MIT
