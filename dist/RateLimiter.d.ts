import http from 'http';
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
export declare function resolveClientIp(headers: http.IncomingHttpHeaders, remoteAddress: string | undefined, config: ClientIpConfig | false | undefined): string;
/**
 * Normaliza e valida um IP. Retorna `null` para valores inválidos
 * (evita que um cabeçalho forjado vire chave arbitrária).
 */
export declare function normalizeIp(value: string | undefined | null): string | null;
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
    private clientIp;
    /**
     * Fila por chave. O bancoz trava cada operação, mas ler e escrever são
     * operações distintas; sem serializar, requisições simultâneas do mesmo IP
     * podem ler o mesmo contador e perder incrementos.
     */
    private locks;
    constructor(targetPort: number, options: RateLimitOptions | true);
    start(): Promise<number>;
    /**
     * Serializa operações por chave para que leitura + incremento sejam
     * atômicos dentro deste processo.
     */
    private withKeyLock;
    /** Lê, incrementa e (se preciso) bloqueia, tudo sob a mesma chave. */
    private consume;
    /**
     * Remove entradas cuja janela e bloqueio já expiraram.
     * Retorna a quantidade de chaves removidas.
     */
    cleanupExpired(now?: number): Promise<number>;
    private isExpired;
    stop(): void;
}
