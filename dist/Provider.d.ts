import { EventEmitter } from "events";
export interface TunnelResult {
    provider: string;
    url: string;
    port: number;
    stop: () => void;
    process?: unknown;
}
export declare abstract class Provider extends EventEmitter {
    protected port: number;
    constructor(port: number);
    abstract start(): Promise<TunnelResult>;
}
