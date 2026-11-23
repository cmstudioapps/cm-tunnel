import { Provider, ProviderOptions, TunnelResult } from '../Provider.js';
export default class NgrokProvider extends Provider {
    private url;
    private listener;
    constructor(options: ProviderOptions);
    start(): Promise<TunnelResult>;
    stop(): void;
}
