import { Provider, ProviderOptions, TunnelResult } from "../Provider.js";
export default class LocalTunnelProvider extends Provider {
    private tunnel;
    constructor(options: ProviderOptions);
    start(): Promise<TunnelResult>;
    stop(): void;
}
