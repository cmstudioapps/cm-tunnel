import http from 'http';
import httpProxy from 'http-proxy';
import bancoz from 'bancoz';
/** Tabela do bancoz usada para persistir os contadores. */
const TABLE = 'ratelimit';
/** Tamanho da janela de contagem. */
const WINDOW_MS = 60_000;
/** Tempo de bloqueio após exceder o limite. */
const BLOCK_MS = 60_000;
/** Intervalo entre limpezas de chaves expiradas. */
const CLEANUP_INTERVAL_MS = 5 * 60_000;
/**
 * Normaliza uma rota de configuração: garante barra inicial e remove
 * barra final (exceto para a raiz `/`).
 */
export function normalizeRoute(route) {
    let normalized = (route || '/').split('?')[0].trim();
    if (!normalized.startsWith('/'))
        normalized = `/${normalized}`;
    if (normalized.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
    }
    return normalized;
}
/**
 * Verifica se `url` pertence à rota `route` comparando segmentos.
 * Evita que `/api` case com `/api2`.
 */
export function pathMatchesRoute(url, route) {
    const path = (url || '/').split('?')[0] || '/';
    const base = normalizeRoute(route);
    if (base === '/')
        return true;
    return path === base || path.startsWith(`${base}/`);
}
export class RateLimiter {
    targetPort;
    options;
    server = null;
    proxy = null;
    port = 0;
    isGlobal;
    cleanupTimer = null;
    constructor(targetPort, options) {
        this.targetPort = targetPort;
        this.options = options;
        this.isGlobal = options === true || !options.routes || options.routes.length === 0;
    }
    async start() {
        this.proxy = httpProxy.createProxyServer({
            target: `http://localhost:${this.targetPort}`,
            ws: true
        });
        this.proxy.on('error', (err, req, res) => {
            if (res && res.writeHead) {
                const resp = res;
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
                    shouldApplyLimit = this.options.routes.some((route) => pathMatchesRoute(url, route));
                }
                if (shouldApplyLimit) {
                    const ip = req.headers['cf-connecting-ip'] ||
                        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
                        req.socket.remoteAddress || 'unknown';
                    const maxReqs = typeof this.options === 'object' ? this.options.maxRequestsPerMinute : 100;
                    // Lógica de Rate Limit com Bancoz
                    const key = ip.replace(/[^a-zA-Z0-9_-]/g, '_'); // Sanitizar chave para o bancoz
                    let data = {};
                    try {
                        data = (await bancoz.ler(TABLE, key)) || {};
                    }
                    catch (err) {
                        // Se não existe, ignora e cria
                    }
                    const now = Date.now();
                    if (data.blockedUntil && data.blockedUntil > now) {
                        res.writeHead(429, { 'Content-Type': 'text/plain' });
                        return res.end('Too Many Requests. IP Bloqueado Temporariamente.');
                    }
                    if (!data.count || !data.windowStart || (now - data.windowStart > WINDOW_MS)) {
                        // Nova janela de tempo
                        await bancoz.criar(TABLE, key, {
                            count: 1,
                            windowStart: now
                        });
                    }
                    else {
                        // Incrementa contador
                        const newCount = data.count + 1;
                        if (newCount > maxReqs) {
                            // Bloquear por 1 minuto
                            await bancoz.atualizar(TABLE, key, {
                                blockedUntil: now + BLOCK_MS
                            });
                            res.writeHead(429, { 'Content-Type': 'text/plain' });
                            return res.end('Too Many Requests. Limite Excedido.');
                        }
                        else {
                            await bancoz.atualizar(TABLE, key, {
                                count: newCount
                            });
                        }
                    }
                }
                // Repassar a requisição
                this.proxy?.web(req, res);
            }
            catch (err) {
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
            this.server.listen(0, '127.0.0.1', () => {
                const address = this.server.address();
                this.port = address.port;
                // Limpeza periódica; unref() evita segurar o processo aberto.
                this.cleanupTimer = setInterval(() => {
                    void this.cleanupExpired();
                }, CLEANUP_INTERVAL_MS);
                this.cleanupTimer.unref?.();
                resolve(this.port);
            });
            this.server.on('error', reject);
        });
    }
    /**
     * Remove entradas cuja janela e bloqueio já expiraram.
     * Retorna a quantidade de chaves removidas.
     */
    async cleanupExpired(now = Date.now()) {
        let entries = null;
        try {
            entries = (await bancoz.ler(TABLE));
        }
        catch {
            // Arquivo ainda não existe ou bancoz indisponível: nada a limpar.
            return 0;
        }
        if (!entries || typeof entries !== 'object')
            return 0;
        let removed = 0;
        for (const [key, entry] of Object.entries(entries)) {
            if (!this.isExpired(entry, now))
                continue;
            try {
                await bancoz.deletar(TABLE, key);
                removed++;
            }
            catch {
                // Chave pode ter sido removida concorrentemente; segue adiante.
            }
        }
        return removed;
    }
    isExpired(entry, now) {
        if (!entry || typeof entry !== 'object')
            return true;
        const windowStart = typeof entry.windowStart === 'number' ? entry.windowStart : 0;
        const blockedUntil = typeof entry.blockedUntil === 'number' ? entry.blockedUntil : 0;
        const windowExpired = now - windowStart > WINDOW_MS;
        const blockExpired = blockedUntil <= now;
        return windowExpired && blockExpired;
    }
    stop() {
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
