import http from 'http';
import net from 'node:net';
import httpProxy from 'http-proxy';
import bancoz from 'bancoz';

/** Cabeçalho confiável usado para descobrir o IP do cliente. */
export interface ClientIpConfig {
  /** Nome do cabeçalho (ex.: `cf-connecting-ip`, `x-forwarded-for`). */
  header: string;
  /**
   * Qual valor usar quando o cabeçalho traz uma lista separada por vírgula.
   * `last` é o correto atrás de proxies que anexam o IP do par ao final.
   */
  strategy?: 'first' | 'last';
}

export interface RateLimitOptions {
  maxRequestsPerMinute: number;
  routes?: string[];
  /**
   * Cabeçalho confiável para identificar o cliente.
   * - omitido: `x-forwarded-for` (último valor)
   * - `false`: ignora cabeçalhos e usa o socket (todos atrás do túnel
   *   compartilham o mesmo IP — use só se souber o que está fazendo)
   */
  clientIp?: ClientIpConfig | false;
}

/** Tabela do bancoz usada para persistir os contadores. */
const TABLE = 'ratelimit';
/** Tamanho da janela de contagem. */
const WINDOW_MS = 60_000;
/** Tempo de bloqueio após exceder o limite. */
const BLOCK_MS = 60_000;
/** Intervalo entre limpezas de chaves expiradas. */
const CLEANUP_INTERVAL_MS = 5 * 60_000;

/** Default seguro: o proxy (túnel) anexa o IP do cliente ao final da lista. */
const DEFAULT_CLIENT_IP: ClientIpConfig = {
  header: 'x-forwarded-for',
  strategy: 'last',
};

export function resolveClientIp(
  headers: http.IncomingHttpHeaders,
  remoteAddress: string | undefined,
  config: ClientIpConfig | false | undefined,
): string {
  if (config !== false) {
    const cfg = config ?? DEFAULT_CLIENT_IP;
    const raw = headers[cfg.header.toLowerCase()];
    if (raw) {
      const values = String(raw)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      if (values.length > 0) {
        const value =
          cfg.strategy === 'first' ? values[0] : values[values.length - 1];
        const ip = normalizeIp(value);
        if (ip) return ip;
      }
    }
  }

  return normalizeIp(remoteAddress) ?? 'unknown';
}

/**
 * Normaliza e valida um IP. Retorna `null` para valores inválidos
 * (evita que um cabeçalho forjado vire chave arbitrária).
 */
export function normalizeIp(value: string | undefined | null): string | null {
  if (!value) return null;

  let candidate = value.trim().replace(/^"|"$/g, '');

  // IPv4 com porta: 203.0.113.7:1234
  const ipv4WithPort = candidate.match(/^(\d{1,3}(?:\.\d{1,3}){3}):\d+$/);
  if (ipv4WithPort) candidate = ipv4WithPort[1];

  // IPv6 entre colchetes: [2001:db8::1] ou [2001:db8::1]:443
  const bracketed = candidate.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketed) candidate = bracketed[1];

  return net.isIP(candidate) ? candidate : null;
}

/**
 * Normaliza uma rota de configuração: garante barra inicial e remove
 * barra final (exceto para a raiz `/`).
 */
export function normalizeRoute(route: string): string {
  let normalized = (route || '/').split('?')[0].trim();
  if (!normalized.startsWith('/')) normalized = `/${normalized}`;
  if (normalized.length > 1 && normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1);
  }
  return normalized;
}

/**
 * Verifica se `url` pertence à rota `route` comparando segmentos.
 * Evita que `/api` case com `/api2`.
 */
export function pathMatchesRoute(url: string, route: string): boolean {
  const path = (url || '/').split('?')[0] || '/';
  const base = normalizeRoute(route);
  if (base === '/') return true;
  return path === base || path.startsWith(`${base}/`);
}

interface RateLimitEntry {
  count?: number;
  windowStart?: number;
  blockedUntil?: number;
}

type ConsumeResult =
  | { allowed: true }
  | { allowed: false; message: string };

export class RateLimiter {
  private server: http.Server | null = null;
  private proxy: httpProxy | null = null;
  private port: number = 0;
  private isGlobal: boolean;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private clientIp: ClientIpConfig | false | undefined;
  /**
   * Fila por chave. O bancoz trava cada operação, mas ler e escrever são
   * operações distintas; sem serializar, requisições simultâneas do mesmo IP
   * podem ler o mesmo contador e perder incrementos.
   */
  private locks = new Map<string, Promise<void>>();

  constructor(
    private targetPort: number,
    private options: RateLimitOptions | true
  ) {
    this.isGlobal = options === true || !options.routes || options.routes.length === 0;
    this.clientIp = options === true ? undefined : options.clientIp;
  }

  public async start(): Promise<number> {
    this.proxy = httpProxy.createProxyServer({
      target: `http://localhost:${this.targetPort}`,
      ws: true
    });

    this.proxy.on('error', (err, req, res) => {
      if (res && (res as http.ServerResponse).writeHead) {
         const resp = res as http.ServerResponse;
         if (!resp.headersSent) {
             resp.writeHead(502);
             resp.end('Bad Gateway');
         }
      }
    });

    this.server = http.createServer(async (req, res) => {
      try {
        const url = req.url || '/';
        let shouldApplyLimit = this.isGlobal;

        if (!shouldApplyLimit && typeof this.options === 'object' && this.options.routes) {
          shouldApplyLimit = this.options.routes.some((route) =>
            pathMatchesRoute(url, route)
          );
        }

        if (shouldApplyLimit) {
           const ip = resolveClientIp(
             req.headers,
             req.socket.remoteAddress,
             this.clientIp,
           );

           const maxReqs = typeof this.options === 'object' ? this.options.maxRequestsPerMinute : 100;

           // Sanitizar chave para o bancoz.
           const key = ip.replace(/[^a-zA-Z0-9_-]/g, '_');
           const result = await this.withKeyLock(key, () =>
             this.consume(key, maxReqs),
           );

           if (!result.allowed) {
              res.writeHead(429, { 'Content-Type': 'text/plain' });
              return res.end(result.message);
           }
        }

        // Repassar a requisição
        this.proxy?.web(req, res);
      } catch(err) {
         console.error('Erro no proxy interno:', err);
         if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Proxy Error');
         }
      }
    });

    this.server.on('upgrade', (req, socket, head) => {
      this.proxy?.ws(req, socket, head);
    });

    return new Promise((resolve, reject) => {
      this.server!.listen(0, '127.0.0.1', () => {
        const address = this.server!.address() as import('net').AddressInfo;
        this.port = address.port;
        // Limpeza periódica; unref() evita segurar o processo aberto.
        this.cleanupTimer = setInterval(() => {
          void this.cleanupExpired();
        }, CLEANUP_INTERVAL_MS);
        this.cleanupTimer.unref?.();
        resolve(this.port);
      });
      this.server!.on('error', reject);
    });
  }

  /**
   * Serializa operações por chave para que leitura + incremento sejam
   * atômicos dentro deste processo.
   */
  private async withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const previous = this.locks.get(key) ?? Promise.resolve();
    let release!: () => void;
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });

    this.locks.set(key, current);
    await previous;

    try {
      return await fn();
    } finally {
      release();
      if (this.locks.get(key) === current) {
        this.locks.delete(key);
      }
    }
  }

  /** Lê, incrementa e (se preciso) bloqueia, tudo sob a mesma chave. */
  private async consume(key: string, maxReqs: number): Promise<ConsumeResult> {
    let data: RateLimitEntry = {};
    try {
      data = (await bancoz.ler(TABLE, key)) || {};
    } catch {
      // Se não existe, ignora e cria
    }

    const now = Date.now();

    if (data.blockedUntil && data.blockedUntil > now) {
      return {
        allowed: false,
        message: 'Too Many Requests. IP Bloqueado Temporariamente.',
      };
    }

    if (!data.count || !data.windowStart || now - data.windowStart > WINDOW_MS) {
      await bancoz.criar(TABLE, key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    const newCount = data.count + 1;
    if (newCount > maxReqs) {
      await bancoz.atualizar(TABLE, key, { blockedUntil: now + BLOCK_MS });
      return {
        allowed: false,
        message: 'Too Many Requests. Limite Excedido.',
      };
    }

    await bancoz.atualizar(TABLE, key, { count: newCount });
    return { allowed: true };
  }

  /**
   * Remove entradas cuja janela e bloqueio já expiraram.
   * Retorna a quantidade de chaves removidas.
   */
  public async cleanupExpired(now: number = Date.now()): Promise<number> {
    let entries: Record<string, RateLimitEntry> | null = null;
    try {
      entries = (await bancoz.ler(TABLE)) as Record<string, RateLimitEntry> | null;
    } catch {
      // Arquivo ainda não existe ou bancoz indisponível: nada a limpar.
      return 0;
    }

    if (!entries || typeof entries !== 'object') return 0;

    let removed = 0;
    for (const key of Object.keys(entries)) {
      const deleted = await this.withKeyLock(key, async () => {
        // Reconfere dentro do lock para não apagar uma entrada que acabou
        // de receber atividade.
        let current: RateLimitEntry | null = null;
        try {
          current = (await bancoz.ler(TABLE, key)) as RateLimitEntry | null;
        } catch {
          return false;
        }
        if (!this.isExpired(current, now)) return false;

        try {
          await bancoz.deletar(TABLE, key);
          return true;
        } catch {
          // Chave pode ter sido removida concorrentemente; segue adiante.
          return false;
        }
      });

      if (deleted) removed++;
    }
    return removed;
  }

  private isExpired(entry: RateLimitEntry | null | undefined, now: number): boolean {
    if (!entry || typeof entry !== 'object') return true;
    const windowStart = typeof entry.windowStart === 'number' ? entry.windowStart : 0;
    const blockedUntil = typeof entry.blockedUntil === 'number' ? entry.blockedUntil : 0;
    const windowExpired = now - windowStart > WINDOW_MS;
    const blockExpired = blockedUntil <= now;
    return windowExpired && blockExpired;
  }

  public stop() {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    if (this.proxy) {
      this.proxy.close();
      this.proxy = null;
    }
    if (this.server) {
      this.server.close();
      this.server = null;
    }
    // Limpeza best-effort ao encerrar; não bloqueia o shutdown.
    void this.cleanupExpired();
  }
}
