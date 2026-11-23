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
    /** Prefixo das rotas de API (padrão: `/api`) */
    apiPrefix?: string;
    port?: number;
}
export declare class StaticServer {
    private options;
    private server;
    private staticRoot;
    private apiRoot;
    private staticRealRoot;
    private apiRealRoot;
    private apiPrefix;
    private moduleCache;
    port: number;
    url: string;
    constructor(options: ServeOptions);
    private prepareRoots;
    start(): Promise<{
        port: number;
        url: string;
        stop: () => void;
    }>;
    private handle;
    private handleApi;
    private findApiFile;
    private loadHandler;
    private handleStatic;
    private sendHtml;
    private sendJson;
    stop(): void;
}
export declare function serve(options: ServeOptions): Promise<{
    port: number;
    url: string;
    stop: () => void;
}>;
