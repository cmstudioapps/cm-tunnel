import { EventEmitter } from "events";
import { TunnelResult } from "./Provider.js";
export interface TunnelOptions {
    provider: string;
    port: number;
}
export interface TunnelInstance extends TunnelResult, EventEmitter {
    on(event: "ready", listener: (url: string) => void): this;
    on(event: "close", listener: () => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: string | symbol, listener: (...args: any[]) => void): this;
}
export declare function createTunnel(options: TunnelOptions): Promise<TunnelInstance>;
