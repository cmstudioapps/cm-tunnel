import { type Plan } from './cli-utils.js';
export declare const CONFIG_FILE = ".cm-tunnel.json";
/** Carrega `.env` do diretório atual (com fallback para Node < 20.12). */
export declare function loadDotEnv(): void;
export declare function loadConfig(): Plan | null;
export declare function saveConfig(plan: Plan): void;
export declare function saveTokenToEnv(token: string): void;
