import http from 'node:http';

const port = Number(process.env.PORT);

const server = http.createServer((req, res) => {
  if (req.url === '/hello') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, url: req.url }));
    return;
  }

  if (req.url?.includes('/echo')) {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ url: req.url }));
    return;
  }

  res.statusCode = 404;
  res.end('api-404');
});

server.listen(port, '127.0.0.1');
