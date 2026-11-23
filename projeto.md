# Prompt

Crie uma biblioteca completa para Node.js chamada **cm-tunnel**, pronta para publicação no **NPM**.

## Objetivo

A biblioteca deve permitir expor um servidor HTTP local para a internet através de uma API extremamente simples.

Ela deve suportar múltiplos provedores de túnel, começando por:

* Cloudflare (obrigatório)
* LocalTunnel (obrigatório)

A arquitetura deve permitir adicionar novos provedores futuramente sem quebrar a API.

---

# Requisitos

## TypeScript

O projeto deve ser construído utilizando **TypeScript**.

Configure o `tsconfig.json` para gerar código compatível com ES Modules (`"type": "module"`) e Node.js moderno (>=18).
A biblioteca final deve fornecer os arquivos compilados em JavaScript junto com as tipagens (`.d.ts`).

---

## Compatibilidade

* Node.js >=18
* Linux
* Windows
* macOS

---

## Estrutura

```
cm-tunnel/
│
├── index.js
├── package.json
├── README.md
├── LICENSE
├── src/
│   ├── Tunnel.js
│   ├── Provider.js
│   │
│   └── providers/
│        ├── cloudflare.js
│        └── localtunnel.js
│
└── examples/
    ├── cloudflare.js
    ├── localtunnel.js
    └── express.js
```

Arquitetura modular.

Cada provedor deve ser independente.

---

# API

A biblioteca deve funcionar das seguintes formas.

## Forma principal

```js
import tunnel from "cm-tunnel";

const url = await tunnel({
    provider: "cloudflare",
    port: 3000
});

console.log(url);
```

---

Também:

```js
await tunnel({
    provider: "localtunnel",
    port: 3000
});
```

---

## API simplificada

```js
await tunnel.cloudflare({
    port:3000
});
```

e

```js
await tunnel.localtunnel({
    port:3000
});
```

---

# Retorno

Retornar um objeto:

```js
{
    provider:"cloudflare",
    url:"https://xxxxx.trycloudflare.com",
    port:3000,
    stop(){},
    process
}
```

O método stop() deve finalizar corretamente o túnel.

---

# Eventos

Permitir:

```js
const t = await tunnel(...);

t.on("ready", url=>{

});

t.on("close", ()=>{

});

t.on("error", err=>{

});
```

Usar EventEmitter.

---

# Cloudflare

Utilizar o executável **cloudflared**.

Se não estiver instalado:

* detectar automaticamente
* informar erro amigável
* explicar como instalar

Nunca falhar silenciosamente.

Capturar automaticamente a URL gerada pelo cloudflared.

---

# LocalTunnel

Usar a biblioteca oficial.

Capturar corretamente:

* URL
* erros
* encerramento

---

# Recursos

Permitir:

```js
await tunnel({
    provider:"cloudflare",
    port:3000
});
```

```js
await tunnel({
    provider:"localtunnel",
    port:3000
});
```

---

No futuro deve ser possível criar novos provedores apenas adicionando um arquivo dentro de:

```
src/providers
```

sem alterar o restante do projeto.

---

# Tratamento de erros

Criar mensagens amigáveis.

Exemplos:

```
Porta inválida.

Provider inexistente.

Cloudflared não encontrado.

Falha ao iniciar o túnel.

A porta não possui nenhum servidor ativo.
```

Nunca lançar erros confusos do Node.

---

# Qualidade

* Código limpo
* Bem comentado
* Modular
* Sem duplicação
* Fácil manutenção

---

# README

Gerar um README profissional contendo:

* instalação
* exemplos
* API
* retorno
* eventos
* como adicionar provedores
* exemplos completos
* FAQ

---

# package.json

Preparar para publicação.

Incluir:

* exports
* module
* keywords
* homepage
* repository
* bugs
* license
* files
* engines
* scripts

---

# Scripts

```
npm test

npm run lint

npm run format
```

Mesmo que inicialmente sejam básicos.

---

# Licença

MIT.

---

# Objetivo final

Entregar um projeto completo, organizado e pronto para:

```bash
npm publish
```

sem arquivos de exemplo incompletos, sem TODOs, sem código fictício e sem dependências desnecessárias. A biblioteca deve estar funcional, com implementação real dos provedores Cloudflare e LocalTunnel, seguindo boas práticas de desenvolvimento para bibliotecas Node.js.

