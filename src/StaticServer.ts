import http from 'http';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { spawn, ChildProcess } from 'child_process';
import httpProxy from 'http-proxy';
import { findFreePort, isPortInUse } from './net-utils.js';

export type ApiMode = 'handlers' | 'server';

export interface ServeOptions {
  /** HTML fixo servido em qualquer rota não-API */
  html?: string;
  /** Pasta de arquivos estáticos (compatibilidade) */
  directory?: string;
  /** Pasta de arquivos estáticos (estilo Vercel). Tem prioridade sobre `directory` */
  public?: string;
  /**
   * Pasta com handlers de API. Os arquivos dessa pasta nunca são servidos
   * como estáticos; cada arquivo vira uma rota (`api/hello.js` → `/api/hello`).
   */
  api?: string;
  /**
   * Como a API funciona:
   * - `handlers` (padrão): cada arquivo em `api/` exporta uma função
   * - `server`: roda um servidor normal (Express, Fastify, http) a partir de `apiEntry`
   */
  apiMode?: ApiMode;
  /** Arquivo de entrada do servidor de API (padrão: `<api>/index.js`) */
  apiEntry?: string;
  /** Remove o prefixo da API antes de encaminhar para o servidor (padrão: true) */
  stripApiPrefix?: boolean;
  /** Timeout em ms para o servidor de API ficar pronto (padrão: 30000) */
  apiTimeout?: number;
  /** Prefixo das rotas de API (padrão: `/api`) */
  apiPrefix?: string;
  port?: number;
  /** Recebe logs do servidor de API quando apiMode = "server" */
  onLog?: (line: string) => void;
}

type DecoratedResponse = http.ServerResponse & {
  status?: (code: number) => DecoratedResponse;
  json?: (body: unknown) => DecoratedResponse;
  send?: (body: unknown) => DecoratedResponse;
};

type ApiHandler = (
  req: http.IncomingMessage,
  res: DecoratedResponse,
) => unknown | Promise<unknown>;

interface HandlerLookup {
  handler: ApiHandler | null;
  /** O módulo exporta algum handler, mas não para este método HTTP. */
  methodNotAllowed: boolean;
}

const API_EXTENSIONS = ['.js', '.mjs', '.cjs'];

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.pdf': 'application/pdf',
  '.wasm': 'application/wasm',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
};

/** Garante que `target` está dentro de `root` (sem escapar por `..`). */
function isInside(root: string, target: string): boolean {
  const rel = path.relative(root, target);
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel));
}

/** Decodifica e normaliza o pathname; retorna null se for inválido. */
function parsePathname(rawUrl: string): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0')) return null;
  return path.posix.normalize(pathname);
}

function hasDotSegment(relativePath: string): boolean {
  return relativePath
    .split(/[\\/]+/)
    .some((segment) => segment.startsWith('.'));
}

function decorateResponse(res: http.ServerResponse): DecoratedResponse {
  const decorated = res as DecoratedResponse;

  decorated.status = (code: number) => {
    res.statusCode = code;
    return decorated;
  };

  decorated.json = (body: unknown) => {
    if (!res.headersSent) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    res.end(JSON.stringify(body));
    return decorated;
  };

  decorated.send = (body: unknown) => {
    if (body !== null && typeof body === 'object') {
      return decorated.json!(body);
    }
    res.end(String(body));
    return decorated;
  };

  return decorated;
}

export class StaticServer {
  private server: http.Server | null = null;
  private staticRoot: string | null;
  private apiRoot: string | null;
  private staticRealRoot: string | null = null;
  private apiRealRoot: string | null = null;
  private apiPrefix: string;
  private apiMode: ApiMode;
  private apiEntry: string | null = null;
  private stripApiPrefix: boolean;
  private apiProcess: ChildProcess | null = null;
  private apiProxy: httpProxy | null = null;
  private apiPort: number | null = null;
  private stopping = false;
  private moduleCache = new Map<string, { mtimeMs: number; module: any }>();

  public port: number = 0;
  public url: string = '';

  constructor(private options: ServeOptions) {
    const publicDir = options.public ?? options.directory;
    this.staticRoot = publicDir ? path.resolve(publicDir) : null;
    this.apiRoot = options.api ? path.resolve(options.api) : null;

    let prefix = options.apiPrefix || '/api';
    if (!prefix.startsWith('/')) prefix = `/${prefix}`;
    this.apiPrefix = prefix.replace(/\/+$/, '') || '/api';

    this.apiMode = options.apiMode === 'server' ? 'server' : 'handlers';
    this.stripApiPrefix = options.stripApiPrefix !== false;

    if (this.apiMode === 'server') {
      this.apiEntry = options.apiEntry
        ? path.resolve(options.apiEntry)
        : this.apiRoot
          ? path.join(this.apiRoot, 'index.js')
          : null;
    }
  }

  private prepareRoots(): void {
    if (this.staticRoot) {
      if (!fs.existsSync(this.staticRoot) || !fs.statSync(this.staticRoot).isDirectory()) {
        throw new Error(`Pasta pública não encontrada: "${this.staticRoot}".`);
      }
      this.staticRealRoot = fs.realpathSync(this.staticRoot);
    }

    if (this.apiRoot) {
      if (!fs.existsSync(this.apiRoot) || !fs.statSync(this.apiRoot).isDirectory()) {
        throw new Error(`Pasta de API não encontrada: "${this.apiRoot}".`);
      }
      this.apiRealRoot = fs.realpathSync(this.apiRoot);
    }

    if (this.apiMode === 'server') {
      if (!this.apiEntry) {
        throw new Error('apiMode "server" requer a opção "api" ou "apiEntry".');
      }
      if (!fs.existsSync(this.apiEntry) || !fs.statSync(this.apiEntry).isFile()) {
        throw new Error(`Arquivo de entrada da API não encontrado: "${this.apiEntry}".`);
      }
    }
  }

  private async startApiServer(): Promise<void> {
    if (!this.apiEntry) {
      throw new Error('apiMode "server" requer um arquivo de entrada.');
    }

    const port = await findFreePort();
    this.apiPort = port;

    const child = spawn(process.execPath, [this.apiEntry], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PORT: String(port),
        CM_TUNNEL_API_PORT: String(port),
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.apiProcess = child;
    let output = '';
    let exited = false;

    const forward = (data: Buffer) => {
      const text = data.toString();
      output = `${output}${text}`.slice(-4000);
      this.options.onLog?.(text);
    };

    child.stdout?.on('data', forward);
    child.stderr?.on('data', forward);
    child.once('exit', (code, signal) => {
      exited = true;
      if (!this.stopping) {
        console.error(
          `[cm-tunnel] A API encerrou inesperadamente (${code ?? signal}).`,
        );
      }
    });

    const timeoutMs = this.options.apiTimeout ?? 30000;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (exited) {
        this.stopApiServer();
        throw new Error(
          `API encerrou antes de ficar pronta.\n${output}`.trim(),
        );
      }

      if (await isPortInUse(port)) {
        this.apiProxy = httpProxy.createProxyServer({
          target: `http://127.0.0.1:${port}`,
          ws: true,
        });

        this.apiProxy.on('error', (_err, _req, res) => {
          const response = res as http.ServerResponse | undefined;
          if (response && typeof response.writeHead === 'function' && !response.headersSent) {
            response.writeHead(502, {
              'Content-Type': 'application/json; charset=utf-8',
            });
            response.end(JSON.stringify({ error: 'Bad Gateway' }));
          }
        });

        return;
      }

      await new Promise((resolveWait) => setTimeout(resolveWait, 100));
    }

    this.stopApiServer();
    throw new Error(
      `API não ficou pronta em ${timeoutMs / 1000}s.\n${output}`.trim(),
    );
  }

  private stopApiServer(): void {
    this.stopping = true;

    if (this.apiProxy) {
      try {
        this.apiProxy.close();
      } catch {
        // ignora
      }
      this.apiProxy = null;
    }

    if (this.apiProcess) {
      try {
        this.apiProcess.kill();
      } catch {
        // ignora
      }
      this.apiProcess = null;
    }

    this.apiPort = null;
  }

  private rewriteApiUrl(url: string): string {
    if (!this.stripApiPrefix) return url;
    const rest = url.slice(this.apiPrefix.length);
    return rest.startsWith('/') ? rest || '/' : `/${rest}`;
  }

  private handleApiServer(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): void {
    if (!this.apiProxy || !this.apiPort) {
      this.sendJson(res, 502, { error: 'API server not ready' });
      return;
    }

    req.url = this.rewriteApiUrl(req.url || '/');
    this.apiProxy.web(req, res);
  }

  public async start(): Promise<{ port: number; url: string; stop: () => void }> {
    this.prepareRoots();

    if (this.apiMode === 'server') {
      await this.startApiServer();
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handle(req, res).catch((err) => {
          console.error('[cm-tunnel] Erro ao processar requisição:', err);
          if (!res.headersSent) {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          }
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        });
      });

      this.server.on('upgrade', (req, socket, head) => {
        const url = req.url || '';
        const isApi =
          url === this.apiPrefix || url.startsWith(`${this.apiPrefix}/`);

        if (this.apiMode === 'server' && this.apiProxy && isApi) {
          req.url = this.rewriteApiUrl(url);
          this.apiProxy.ws(req, socket, head);
        } else {
          socket.destroy();
        }
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
            stop: this.stop.bind(this),
          });
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const pathname = parsePathname(req.url || '/');
    if (pathname === null) {
      this.sendJson(res, 400, { error: 'Bad Request' });
      return;
    }

    if (pathname === this.apiPrefix || pathname.startsWith(`${this.apiPrefix}/`)) {
      if (this.apiMode === 'server') {
        this.handleApiServer(req, res);
      } else if (this.apiRoot) {
        await this.handleApi(req, res, pathname);
      } else {
        // /api é reservado: nunca cai no estático, mesmo sem pasta de API configurada.
        this.sendJson(res, 404, { error: 'Not found' });
      }
      return;
    }

    await this.handleStatic(req, res, pathname);
  }

  private async handleApi(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
  ): Promise<void> {
    const method = (req.method || 'GET').toUpperCase();
    const relative = pathname
      .slice(this.apiPrefix.length)
      .replace(/^\/+|\/+$/g, '');

    const file = await this.findApiFile(relative);
    if (!file) {
      this.sendJson(res, 404, { error: 'Not found' });
      return;
    }

    let lookup: HandlerLookup;
    try {
      lookup = await this.loadHandler(file, method);
    } catch (err: any) {
      console.error(`[cm-tunnel] Falha ao carregar handler "${file}":`, err);
      this.sendJson(res, 500, { error: 'Invalid API handler' });
      return;
    }

    if (!lookup.handler) {
      if (lookup.methodNotAllowed) {
        res.writeHead(405, { Allow: 'GET, POST, PUT, PATCH, DELETE, OPTIONS' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
      } else {
        this.sendJson(res, 500, {
          error: `Handler de API inválido em "${path.relative(this.apiRoot!, file)}". ` +
            'Exporte uma função default (req, res) ou funções por método (GET, POST...).',
        });
      }
      return;
    }

    const handler = lookup.handler;
    const decorated = decorateResponse(res);

    try {
      const result = await handler(req, decorated);
      if (!res.writableEnded) {
        if (result !== undefined) {
          if (typeof result === 'string') {
            res.end(result);
          } else {
            decorated.json!(result);
          }
        } else {
          res.end();
        }
      }
    } catch (err: any) {
      console.error(`[cm-tunnel] Erro no handler de API "${file}":`, err);
      if (!res.headersSent) {
        decorated.status!(500).json!({ error: 'Internal Server Error' });
      } else {
        res.end();
      }
    }
  }

  private async findApiFile(relative: string): Promise<string | null> {
    const candidates = relative ? [relative, path.join(relative, 'index')] : ['index'];

    for (const candidate of candidates) {
      for (const extension of API_EXTENSIONS) {
        const file = path.resolve(this.apiRoot!, `${candidate}${extension}`);
        if (!isInside(this.apiRoot!, file)) continue;

        try {
          const stat = await fs.promises.stat(file);
          if (!stat.isFile()) continue;

          // Resolve symlinks e garante que o arquivo real continua dentro da pasta de API.
          const real = await fs.promises.realpath(file);
          if (!isInside(this.apiRealRoot!, real)) continue;

          return file;
        } catch {
          // Arquivo não existe, tenta o próximo candidato.
        }
      }
    }

    return null;
  }

  private async loadHandler(file: string, method: string): Promise<HandlerLookup> {
    const stat = await fs.promises.stat(file);
    let entry = this.moduleCache.get(file);

    if (!entry || entry.mtimeMs !== stat.mtimeMs) {
      // O query param com mtime invalida o cache do ESM quando o arquivo muda,
      // permitindo editar handlers sem reiniciar o processo.
      const href = `${pathToFileURL(file).href}?v=${stat.mtimeMs}`;
      // @vite-ignore mantém o import em runtime (funciona no Node e no Vitest).
      const module = await import(/* @vite-ignore */ href);
      entry = { mtimeMs: stat.mtimeMs, module };
      this.moduleCache.set(file, entry);
    }

    const mod = entry.module as any;

    // Export por método: export const GET = ..., export const POST = ...
    const byMethod = mod[method] ?? mod[method.toLowerCase()] ?? mod.all;
    if (typeof byMethod === 'function') {
      return { handler: byMethod, methodNotAllowed: false };
    }

    // Export default: export default function handler(req, res) {}
    const fallback = mod.default ?? mod;
    if (typeof fallback === 'function') {
      return { handler: fallback, methodNotAllowed: false };
    }

    if (fallback && typeof fallback === 'object') {
      const fn = fallback[method] ?? fallback[method.toLowerCase()] ?? fallback.all;
      if (typeof fn === 'function') {
        return { handler: fn, methodNotAllowed: false };
      }
    }

    const methodNames = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ALL'];
    const hasAnyHandler = methodNames.some((name) => {
      const lower = name.toLowerCase();
      return (
        typeof mod[name] === 'function' ||
        typeof mod[lower] === 'function' ||
        (fallback &&
          typeof fallback === 'object' &&
          (typeof fallback[name] === 'function' || typeof fallback[lower] === 'function'))
      );
    });

    return { handler: null, methodNotAllowed: hasAnyHandler };
  }

  private async handleStatic(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
  ): Promise<void> {
    const method = (req.method || 'GET').toUpperCase();

    if (this.options.html) {
      if (method !== 'GET' && method !== 'HEAD') {
        res.writeHead(405, { Allow: 'GET, HEAD' });
        res.end();
        return;
      }
      this.sendHtml(res, this.options.html, method === 'HEAD');
      return;
    }

    if (!this.staticRoot) {
      this.sendJson(res, 404, { error: 'Not found' });
      return;
    }

    if (method !== 'GET' && method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      res.end();
      return;
    }

    let relative = pathname.replace(/^\/+/, '');
    if (!relative || relative.endsWith('/')) {
      relative += 'index.html';
    }

    if (hasDotSegment(relative)) {
      this.sendJson(res, 404, { error: 'Not found' });
      return;
    }

    let file = path.resolve(this.staticRoot, relative);
    if (!isInside(this.staticRoot, file)) {
      this.sendJson(res, 403, { error: 'Forbidden' });
      return;
    }

    try {
      let stat = await fs.promises.stat(file);

      if (stat.isDirectory()) {
        file = path.join(file, 'index.html');
        stat = await fs.promises.stat(file);
      }

      if (!stat.isFile()) {
        this.sendJson(res, 404, { error: 'Not found' });
        return;
      }

      // Proteção extra: nunca servir nada que esteja dentro da pasta de API,
      // mesmo via symlink ou configuração equivocada (ex: public: '.').
      const real = await fs.promises.realpath(file);
      if (this.apiRealRoot && isInside(this.apiRealRoot, real)) {
        this.sendJson(res, 404, { error: 'Not found' });
        return;
      }
      if (this.staticRealRoot && !isInside(this.staticRealRoot, real)) {
        this.sendJson(res, 403, { error: 'Forbidden' });
        return;
      }

      const contentType = MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stat.size,
      });

      if (method === 'HEAD') {
        res.end();
        return;
      }

      const stream = fs.createReadStream(file);
      stream.on('error', () => {
        if (!res.writableEnded) res.end();
      });
      stream.pipe(res);
    } catch {
      this.sendJson(res, 404, { error: 'Not found' });
    }
  }

  private sendHtml(res: http.ServerResponse, html: string, headOnly: boolean): void {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(headOnly ? undefined : html);
  }

  private sendJson(res: http.ServerResponse, status: number, body: unknown): void {
    if (res.headersSent) {
      res.end();
      return;
    }
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(body));
  }

  public stop() {
    this.stopApiServer();
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
