import http from 'http';
import httpProxy from 'http-proxy';
import bancoz from 'bancoz';
export class RateLimiter {
    targetPort;
    options;
    server = null;
    proxy = null;
    port = 0;
    isGlobal;
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
                    shouldApplyLimit = this.options.routes.some(route => url.startsWith(route));
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
                        data = await bancoz.ler('ratelimit', key);
                    }
                    catch (err) {
                        // Se não existe, ignora e cria
                    }
                    const now = Date.now();
                    if (data && data.blockedUntil && data.blockedUntil > now) {
                        res.writeHead(429, { 'Content-Type': 'text/plain' });
                        return res.end('Too Many Requests. IP Bloqueado Temporariamente.');
                    }
                    if (!data || !data.count || !data.windowStart || (now - data.windowStart > 60000)) {
                        // Nova janela de tempo
                        await bancoz.criar('ratelimit', key, {
                            count: 1,
                            windowStart: now
                        });
                    }
                    else {
                        // Incrementa contador
                        const newCount = data.count + 1;
                        if (newCount > maxReqs) {
                            // Bloquear por 1 minuto
                            await bancoz.atualizar('ratelimit', key, {
                                blockedUntil: now + 60000
                            });
                            res.writeHead(429, { 'Content-Type': 'text/plain' });
                            return res.end('Too Many Requests. Limite Excedido.');
                        }
                        else {
                            await bancoz.atualizar('ratelimit', key, {
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
                resolve(this.port);
            });
            this.server.on('error', reject);
        });
    }
    stop() {
        if (this.proxy) {
            this.proxy.close();
            this.proxy = null;
        }
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}
