import { EventEmitter } from "events";
export async function createTunnel(options) {
    if (!options.port || isNaN(options.port)) {
        throw new Error("Porta inválida.");
    }
    if (!options.provider) {
        throw new Error("Provider inexistente.");
    }
    const providerName = options.provider.toLowerCase();
    let ProviderClass;
    try {
        // Dynamic import to load the provider dynamically based on name
        const module = await import(`./providers/${providerName}.js`);
        ProviderClass = module.default;
    }
    catch (err) {
        if (err.code === "ERR_MODULE_NOT_FOUND" ||
            err.message.includes("Cannot find module") ||
            err.message.includes("Unknown variable dynamic import")) {
            throw new Error(`Provider inexistente: "${providerName}".`);
        }
        throw err;
    }
    const providerInstance = new ProviderClass(options.port);
    // We wrap the result in an EventEmitter to match the required API
    const emitter = new EventEmitter();
    providerInstance.on("ready", (url) => emitter.emit("ready", url));
    providerInstance.on("close", () => emitter.emit("close"));
    providerInstance.on("error", (err) => emitter.emit("error", err));
    try {
        const result = await providerInstance.start();
        // Assign properties from result to the emitter instance to conform to TunnelInstance
        Object.assign(emitter, {
            provider: result.provider,
            url: result.url,
            port: result.port,
            stop: result.stop,
            process: result.process,
        });
        return emitter;
    }
    catch (err) {
        throw new Error(`Falha ao iniciar o túnel: ${err.message}`);
    }
}
