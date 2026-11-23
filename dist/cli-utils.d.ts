import type { TunnelOptions } from "./Tunnel.js";
import type { ApiMode } from "./StaticServer.js";
export type Lang = "pt" | "en";
export type Mode = "site" | "api" | "both";
export type PublishMode = "quick" | "domain";
export type Command = "doctor" | "dashboard";
export type ProviderName = "cloudflare" | "localtunnel" | "ngrok";
export interface CliOptions {
    command?: Command;
    lang?: Lang;
    help: boolean;
    version: boolean;
    yes: boolean;
    dryRun: boolean;
    logs: boolean;
    mode?: Mode;
    public?: string;
    api?: string;
    apiMode?: ApiMode;
    apiEntry?: string;
    apiPrefix?: string;
    target?: number;
    port?: number;
    domain?: string;
    token?: string;
    /** Provedor do túnel (padrão: cloudflare) */
    provider?: ProviderName;
    /** Subdomínio fixo para localtunnel */
    subdomain?: string;
    /** Domínio completo já registrado no ngrok (ex.: meuapp.ngrok.app) */
    ngrokDomain?: string;
    quick: boolean;
    save: boolean;
}
export interface Plan {
    mode: Mode;
    public?: string;
    api?: string;
    /** handlers (padrão) ou server (Express/Fastify/http normal) */
    apiMode?: ApiMode;
    /** Arquivo de entrada quando apiMode = "server" */
    apiEntry?: string;
    apiPrefix: string;
    publish: PublishMode;
    domain?: string;
    /** Provedor do túnel escolhido */
    provider?: ProviderName;
    /** Subdomínio fixo (localtunnel) */
    subdomain?: string;
    /** Domínio completo registrado no ngrok */
    ngrokDomain?: string;
    /** Porta de um servidor que já está rodando (modo proxy). */
    target?: number;
    /** Porta do servidor interno (modo pastas + domínio). */
    port?: number;
}
export interface Strings {
    needTty: string;
    cloudflaredMissing: string;
    whatPublish: string;
    modeSite: string;
    modeApi: string;
    modeBoth: string;
    modeServer: string;
    publicPath: string;
    apiPath: string;
    apiModePrompt: string;
    apiModeHandlers: string;
    apiModeServer: string;
    apiEntryPrompt: string;
    apiEntryInvalid: (entry: string) => string;
    serverPortPrompt: string;
    serverNotRunning: (port: number) => string;
    publishHow: string;
    publishQuick: string;
    publishDomain: string;
    domainPrompt: string;
    tokenPrompt: string;
    portPrompt: string;
    createFolder: (dir: string) => string;
    folderNotDir: (dir: string) => string;
    createdFolder: (dir: string) => string;
    invalidDomain: string;
    invalidPort: string;
    portInUse: (port: number) => string;
    missingToken: string;
    summaryTitle: string;
    summaryPublishQuickWith: (provider: string) => string;
    providerQuickOnly: (provider: string) => string;
    ngrokTokenMissing: string;
    ngrokSubdomainIgnored: string;
    summaryNgrokDomain: (domain: string) => string;
    summarySite: (dir: string) => string;
    summaryApi: (dir: string, prefix: string) => string;
    summaryApiServer: (dir: string, entry: string) => string;
    summaryServer: (port: number) => string;
    summaryPublishQuick: string;
    summaryPublishDomain: (domain: string) => string;
    summaryPort: (port: number) => string;
    confirm: string;
    cancelled: string;
    starting: string;
    tunnelUrl: (url: string) => string;
    siteServed: (dir: string) => string;
    apiServed: (dir: string, prefix: string) => string;
    domainHint: (domain: string, port: number) => string;
    pressCtrlC: string;
    useSaved: string;
    savedConfig: (file: string) => string;
    tokenSaved: string;
    dryRun: string;
    doctorTitle: string;
    doctorNodeOk: (version: string) => string;
    doctorNodeFail: (version: string) => string;
    doctorCloudflaredOk: (version: string) => string;
    doctorCloudflaredFail: string;
    doctorConfigOk: (summary: string) => string;
    doctorConfigMissing: string;
    doctorConfigInvalid: string;
    doctorTokenOk: (length: number) => string;
    doctorTokenMissing: string;
    doctorFolderOk: (dir: string) => string;
    doctorFolderMissing: (dir: string) => string;
    doctorApiEntryOk: (entry: string) => string;
    doctorApiEntryMissing: (entry: string) => string;
    doctorPortFree: (port: number) => string;
    doctorPortBusy: (port: number) => string;
    doctorTargetUp: (port: number) => string;
    doctorTargetDown: (port: number) => string;
    doctorDnsOk: (domain: string, address: string) => string;
    doctorDnsFail: (domain: string) => string;
    doctorHostnameInfo: (domain: string, port: number) => string;
    doctorSummary: (ok: number, warn: number, fail: number) => string;
    doctorAllGood: string;
    doctorHasErrors: string;
    dashboardTitle: string;
    dashboardStarting: string;
    dashboardOnline: string;
    dashboardStopped: string;
    dashboardUrl: (url: string) => string;
    dashboardModeSite: string;
    dashboardModeApi: string;
    dashboardModeApiServer: string;
    dashboardModeBoth: string;
    dashboardModeBothServer: string;
    dashboardModeTarget: (port: number) => string;
    dashboardPublishQuick: string;
    dashboardPublishQuickWith: (provider: string) => string;
    dashboardPublishDomain: (domain: string) => string;
    dashboardLocal: (value: string) => string;
    dashboardAwaitingLocal: string;
    dashboardLogs: string;
    dashboardWaitingLogs: string;
    dashboardCtrlC: string;
    dashboardNoTty: string;
    error: (message: string) => string;
}
export declare const STRINGS: Record<Lang, Strings>;
export declare const HELP: Record<Lang, string>;
export declare function detectLang(explicit?: string, env?: NodeJS.ProcessEnv): Lang;
export declare function parseCliArgs(argv: string[]): CliOptions;
export declare function isValidPort(port: number): boolean;
export declare function normalizeDomain(input: string): string;
export declare function isValidDomain(domain: string): boolean;
export declare function normalizePrefix(input?: string): string;
export declare function guessMode(publicExists: boolean, apiExists: boolean): Mode;
export declare function buildTunnelOptions(plan: Plan, token?: string, ngrokToken?: string): TunnelOptions;
