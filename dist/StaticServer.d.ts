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
export declare class StaticServer {
    private options;
    private server;
    private staticRoot;
    private apiRoot;
    private staticRealRoot;
    private apiRealRoot;
    private apiPrefix;
    private apiMode;
    private apiEntry;
    private stripApiPrefix;
    private apiProcess;
    private apiProxy;
    private apiPort;
    private stopping;
    private moduleCache;
    port: number;
    url: string;
    constructor(options: ServeOptions);
    private prepareRoots;
    private startApiServer;
    private stopApiServer;
    private rewriteApiUrl;
    private handleApiServer;
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
