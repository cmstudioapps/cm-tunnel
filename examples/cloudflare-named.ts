import tunnel from "../src/index.js";

/**
 * Exemplo: Cloudflare Named Tunnel com domínio personalizado
 *
 * Pré-requisitos:
 * 1. Instalar cloudflared: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
 * 2. Autenticar: cloudflared tunnel login
 * 3. Criar um túnel: cloudflared tunnel create meu-tunnel
 * 4. Configurar o DNS: cloudflared tunnel route dns meu-tunnel api.meudominio.com.br
 */

async function main() {
  try {
    // Usando a API simplificada com opções inline
    const t = await tunnel.cloudflare({
      port: 3000,
      domain: "api.meudominio.com.br",
      tunnelId: "SEU_TUNNEL_ID_AQUI",
      // Opcionais:
      // credentialsFile: '/home/user/.cloudflared/abc-123.json',
      // cloudflaredPath: '/usr/local/bin/cloudflared',
      // timeout: 60000,
    });

    console.log(`Named Tunnel rodando em: ${t.url}`);
    // Output: Named Tunnel rodando em: https://api.meudominio.com.br

    t.on("ready", (url) => {
      console.log("Túnel pronto:", url);
    });

    t.on("close", () => {
      console.log("Túnel fechado.");
    });

    t.on("error", (err) => {
      console.error("Erro no túnel:", err.message);
    });

    // Para encerrar:
    // t.stop();
  } catch (err) {
    console.error((err as Error).message);
  }
}

main();
