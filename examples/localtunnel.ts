import tunnel from "../src/index.js";

async function main() {
  try {
    const t = await tunnel.localtunnel({ port: 8080 });
    console.log(`LocalTunnel rodando em: ${t.url}`);

    t.on("close", () => {
      console.log("Túnel fechado.");
    });

    // Mantem aberto por 10 segundos
    setTimeout(() => {
      console.log("Fechando o túnel...");
      t.stop();
    }, 10000);
  } catch (err) {
    console.error(err);
  }
}

main();
