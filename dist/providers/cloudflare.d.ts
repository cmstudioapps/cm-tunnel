import { Provider, ProviderOptions, TunnelResult } from "../Provider.js";
export type CloudflareMode = "quick" | "named";
export interface CloudflareOptions {
    /** Modo do túnel: "quick" (padrão) ou "named". Inferido automaticamente se token, tunnelId ou tunnelName forem fornecidos. */
    mode?: CloudflareMode;
    /** Domínio personalizado associado ao túnel (ex: "api.meudominio.com.br"). O DNS deve estar previamente configurado na Cloudflare. */
    domain?: string;
    /** ID do túnel Cloudflare previamente criado */
    tunnelId?: string;
    /** Nome do túnel Cloudflare (alternativa ao tunnelId) */
    tunnelName?: string;
    /** Token de autenticação do túnel (obtido na dashboard ou via `cloudflared tunnel token <TUNNEL>`). Recomendado usar variável de ambiente. */
    token?: string;
    /** Caminho para o arquivo de credenciais JSON do túnel (alternativa ao token) */
    credentialsFile?: string;
    /** Caminho para o executável cloudflared (se não estiver no PATH) */
    cloudflaredPath?: string;
    /** Timeout em ms para aguardar a inicialização (padrão: 30000) */
    timeout?: number;
    /** Protocolo da URL retornada (padrão: "https") */
    protocol?: string;
}
interface CloudflareProviderOptions extends ProviderOptions {
    cloudflare?: CloudflareOptions;
}
/**
 * Valida o arquivo de credenciais do túnel Cloudflare.
 *
 * O cloudflared exige o JSON gerado por `cloudflared tunnel create`.
 * O cert.pem gerado por `cloudflared tunnel login` serve apenas para
 * gerenciar túneis (criar, listar, apagar) e não pode ser usado no `run`.
 */
export declare function validateCredentialsFile(file: string): void;
export default class CloudflareProvider extends Provider {
    private cp;
    private urlRegex;
    private cloudflareOpts;
    private mode;
    /** Últimas linhas emitidas pelo cloudflared, usadas para enriquecer erros. */
    private lastOutput;
    constructor(options: CloudflareProviderOptions);
    /**
     * Determina o modo efetivo com base nas opções fornecidas.
     */
    private resolveMode;
    private get executable();
    private get timeoutMs();
    private get protocol();
    /**
     * Valida as opções antes de iniciar, lançando erros claros e específicos.
     */
    private validateOptions;
    /**
     * Monta os argumentos do cloudflared conforme o modo e método de autenticação.
     *
     * Quick Tunnel:
     *   cloudflared tunnel --url http://localhost:PORT
     *
     * Named Tunnel com token:
     *   cloudflared tunnel --url http://localhost:PORT run --token <TOKEN>
     *
     * Named Tunnel com credenciais:
     *   cloudflared tunnel --credentials-file <FILE> --url http://localhost:PORT run <TUNNEL_ID|NAME>
     */
    private buildArgs;
    /**
     * Constrói a URL pública do túnel named.
     */
    private buildNamedUrl;
    start(): Promise<TunnelResult>;
    stop(): void;
}
export {};
