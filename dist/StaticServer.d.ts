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
    /**
     * Reinicia a API automaticamente se o processo cair depois de ficar pronto
     * (padrão: true, apenas em `apiMode: "server"`).
     */
    apiRestart?: boolean;
    /** Máximo de tentativas consecutivas de reinício (padrão: 5) */
    apiRestartMaxAttempts?: number;
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
    private apiReady;
    private apiRestartEnabled;
    private apiRestartMaxAttempts;
    private apiRestartAttempts;
    private apiRestartTimer;
    private apiHealthyTimer;
    private moduleCache;
    port: number;
    url: string;
    constructor(options: ServeOptions);
    private prepareRoots;
    private createApiProxy;
    /**
     * Encerra apenas o processo/proxy da API, sem marcar o servidor como parado.
     * Usado durante reinícios automáticos.
     */
    private teardownApi;
    private logSupervisor;
    /**
     * Inicia o processo da API. Em reinícios, falhas não são fatais: o supervisor
     * agenda uma nova tentativa com backoff.
     */
    private startApiServer;
    private spawnApiProcess;
    /**
     * Zera o contador de tentativas quando a API se mantém saudável tempo
     * suficiente, para não desistir de reinícios pontuais ao longo do dia.
     */
    private scheduleApiHealthyReset;
    private scheduleApiRestart;
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
