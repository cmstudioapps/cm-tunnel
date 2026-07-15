import { Provider, TunnelResult } from "../Provider.js";
export default class CloudflareProvider extends Provider {
    private cp;
    private urlRegex;
    constructor(port: number);
    start(): Promise<TunnelResult>;
    stop(): void;
}
