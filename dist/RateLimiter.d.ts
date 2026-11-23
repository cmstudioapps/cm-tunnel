export interface RateLimitOptions {
    maxRequestsPerMinute: number;
    routes?: string[];
}
/**
 * Normaliza uma rota de configuração: garante barra inicial e remove
 * barra final (exceto para a raiz `/`).
 */
export declare function normalizeRoute(route: string): string;
/**
 * Verifica se `url` pertence à rota `route` comparando segmentos.
 * Evita que `/api` case com `/api2`.
 */
export declare function pathMatchesRoute(url: string, route: string): boolean;
export declare class RateLimiter {
    private targetPort;
    private options;
    private server;
    private proxy;
    private port;
    private isGlobal;
    private cleanupTimer;
    constructor(targetPort: number, options: RateLimitOptions | true);
    start(): Promise<number>;
    /**
     * Remove entradas cuja janela e bloqueio já expiraram.
     * Retorna a quantidade de chaves removidas.
     */
    cleanupExpired(now?: number): Promise<number>;
    private isExpired;
    stop(): void;
}
