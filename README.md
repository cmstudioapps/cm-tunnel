# cm-tunnel

Exponha seu servidor HTTP local para a internet através de uma API extremamente simples. Suporta **Cloudflare** e **LocalTunnel**.

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
    provider: 'cloudflare', // ou 'localtunnel'
    port: 3000
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
```

## Objeto de Retorno

A função retorna uma Promise que resolve em um objeto `TunnelInstance` contendo:

- `provider` (string): O nome do provedor utilizado.
- `url` (string): A URL pública gerada pelo túnel.
- `port` (number): A porta local.
- `stop()` (function): Método para encerrar o túnel corretamente.
- `process` (any): Acesso ao processo interno (`ChildProcess` para cloudflare ou objeto do `localtunnel`).

O objeto retornado também é um `EventEmitter`, emitindo os eventos `ready`, `close` e `error`.

## Adicionando novos provedores

A arquitetura de `cm-tunnel` é modular. Para adicionar um novo provedor:
1. Crie um arquivo em `src/providers/[nome-do-provedor].ts`.
2. Exporte como default uma classe que estenda a classe `Provider`.
3. Implemente o método abstrato `start(): Promise<TunnelResult>`.
4. O núcleo carregará automaticamente o novo provedor quando chamado com `provider: '[nome-do-provedor]'`.

## Licença

MIT
