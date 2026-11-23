import { EventEmitter } from "events";
export interface TunnelResult {
    provider: string;
    url: string;
    port: number;
    stop: () => void;
    process?: unknown;
}
export interface ProviderOptions {
    port: number;
    subdomain?: string;
    /**
     * Domínio completo já registrado (ngrok). Não use `subdomain` para ngrok:
     * o SDK espera um domínio/hostname completo.
     */
    domain?: string;
    authtoken?: string;
    [key: string]: any;
}
export declare abstract class Provider extends EventEmitter {
    protected options: ProviderOptions;
    protected port: number;
    constructor(options: ProviderOptions);
    abstract start(): Promise<TunnelResult>;
}
