import { Provider, TunnelResult } from "../Provider.js";
export default class LocalTunnelProvider extends Provider {
    private tunnel;
    constructor(port: number);
    start(): Promise<TunnelResult>;
    stop(): void;
}
