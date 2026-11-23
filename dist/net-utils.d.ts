/** Retorna true se a porta está livre para um novo servidor. */
export declare function isPortFree(port: number): Promise<boolean>;
/** Retorna true se há algo escutando na porta. */
export declare function isPortInUse(port: number): Promise<boolean>;
