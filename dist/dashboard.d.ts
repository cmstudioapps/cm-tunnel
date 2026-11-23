import { type Lang, type Plan } from './cli-utils.js';
export declare class Dashboard {
    private lang;
    private plan;
    private logs;
    private partial;
    private url;
    private localPort?;
    private status;
    private renderTimer;
    private readonly enabled;
    private readonly color;
    constructor(lang: Lang, plan: Plan);
    get isEnabled(): boolean;
    push(chunk: string): void;
    private scheduleRender;
    setUrl(url: string): void;
    setLocalPort(port: number): void;
    start(): void;
    stop(): void;
    private paint;
    private render;
}
