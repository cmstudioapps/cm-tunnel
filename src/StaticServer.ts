import http from 'http';
import fs from 'fs';
import path from 'path';

export interface ServeOptions {
  html?: string;
  directory?: string;
  port?: number;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.ico': 'image/x-icon',
};

export class StaticServer {
  private server: http.Server | null = null;
  public port: number = 0;
  public url: string = '';

  constructor(private options: ServeOptions) {}

  public start(): Promise<{ port: number; url: string; stop: () => void }> {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        if (this.options.html) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.options.html);
          return;
        }

        if (this.options.directory) {
          let filePath = path.join(this.options.directory, req.url === '/' ? 'index.html' : (req.url || ''));
          
          // Basic security check to prevent directory traversal
          if (!filePath.startsWith(path.resolve(this.options.directory))) {
             res.writeHead(403);
             return res.end('Forbidden');
          }

          fs.stat(filePath, (err, stats) => {
            if (err) {
              res.writeHead(404);
              return res.end('Not Found');
            }

            if (stats.isDirectory()) {
              filePath = path.join(filePath, 'index.html');
            }

            const ext = path.extname(filePath).toLowerCase();
            const contentType = MIME_TYPES[ext] || 'application/octet-stream';

            fs.readFile(filePath, (err, content) => {
              if (err) {
                res.writeHead(500);
                return res.end('Internal Server Error');
              }
              res.writeHead(200, { 'Content-Type': contentType });
              res.end(content);
            });
          });
          return;
        }

        res.writeHead(400);
        res.end('No serve options provided (html or directory).');
      });

      this.server.on('error', reject);

      const targetPort = this.options.port || 0;
      this.server.listen(targetPort, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address !== 'string') {
          this.port = address.port;
          this.url = `http://127.0.0.1:${this.port}`;
          resolve({
            port: this.port,
            url: this.url,
            stop: this.stop.bind(this)
          });
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  public stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

export async function serve(options: ServeOptions) {
  const server = new StaticServer(options);
  return await server.start();
}
