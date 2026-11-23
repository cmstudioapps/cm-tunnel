import http from 'node:http';
import fs from 'node:fs';

const port = Number(process.env.PORT);
const marker = process.env.CM_TUNNEL_CRASH_MARKER;

// Marca a primeira execução para que apenas ela caia; as seguintes ficam de pé.
const firstRun = Boolean(marker) && !fs.existsSync(marker);
if (firstRun) fs.writeFileSync(marker, '1');

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ ok: true, url: req.url, restarted: !firstRun }));
});

server.listen(port, '127.0.0.1', () => {
  if (firstRun) {
    // Dá tempo do laço de prontidão detectar a porta antes de morrer.
    setTimeout(() => process.exit(1), 150);
  }
});
