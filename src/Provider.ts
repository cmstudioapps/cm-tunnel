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

export abstract class Provider extends EventEmitter {
  protected port: number;
  constructor(protected options: ProviderOptions) {
    super();
    this.port = options.port;
  }

  abstract start(): Promise<TunnelResult>;
}
