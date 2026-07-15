import { EventEmitter } from "events";

export interface TunnelResult {
  provider: string;
  url: string;
  port: number;
  stop: () => void;
  process?: unknown;
}

export abstract class Provider extends EventEmitter {
  constructor(protected port: number) {
    super();
  }

  abstract start(): Promise<TunnelResult>;
}
