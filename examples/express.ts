import http from "http";
import tunnel from "../src/index.js";

const PORT = 3000;

// Servidor local simples
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Ola do cm-tunnel!\n");
});

server.listen(PORT, async () => {
  console.log(`Servidor local rodando na porta ${PORT}`);

  try {
    const t = await tunnel({ provider: "cloudflare", port: PORT });
    console.log(`Túnel público disponível em: ${t.url}`);

    t.on("error", (err) => {
      console.error("Erro no túnel:", err);
    });
  } catch (err) {
    console.error("Falha ao iniciar o túnel:", err);
  }
});
