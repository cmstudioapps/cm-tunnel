export interface RateLimitOptions {
    maxRequestsPerMinute: number;
    routes?: string[];
}
export declare class RateLimiter {
    private targetPort;
    private options;
    private server;
    private proxy;
    private port;
    private isGlobal;
    constructor(targetPort: number, options: RateLimitOptions | true);
    start(): Promise<number>;
    stop(): void;
}
