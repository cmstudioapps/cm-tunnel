import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizePrefix } from './cli-utils.js';
export const CONFIG_FILE = '.cm-tunnel.json';
/** Carrega `.env` do diretório atual (com fallback para Node < 20.12). */
export function loadDotEnv() {
    if (!existsSync('.env'))
        return;
    if (typeof process.loadEnvFile === 'function') {
        try {
            process.loadEnvFile('.env');
            return;
        }
        catch {
            // Cai no parser manual abaixo.
        }
    }
    try {
        const content = readFileSync(resolve('.env'), 'utf8');
        for (const raw of content.split(/\r?\n/)) {
            const line = raw.trim();
            if (!line || line.startsWith('#'))
                continue;
            const separator = line.indexOf('=');
            if (separator <= 0)
                continue;
            const key = line.slice(0, separator).trim();
            let value = line.slice(separator + 1).trim();
            if ((value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            if (!(key in process.env)) {
                process.env[key] = value;
            }
        }
    }
    catch {
        // .env inválido é ignorado; o usuário ainda pode usar variáveis de ambiente.
    }
}
export function loadConfig() {
    const file = resolve(CONFIG_FILE);
    if (!existsSync(file))
        return null;
    try {
        const data = JSON.parse(readFileSync(file, 'utf8'));
        if (data?.mode !== 'site' && data?.mode !== 'api' && data?.mode !== 'both') {
            return null;
        }
        if (data?.publish !== 'quick' && data?.publish !== 'domain') {
            return null;
        }
        return {
            mode: data.mode,
            public: typeof data.public === 'string' ? data.public : undefined,
            api: typeof data.api === 'string' ? data.api : undefined,
            apiPrefix: typeof data.apiPrefix === 'string' ? normalizePrefix(data.apiPrefix) : '/api',
            publish: data.publish,
            domain: typeof data.domain === 'string' ? data.domain : undefined,
            target: typeof data.target === 'number' ? data.target : undefined,
            port: typeof data.port === 'number' ? data.port : undefined,
        };
    }
    catch {
        return null;
    }
}
export function saveConfig(plan) {
    writeFileSync(resolve(CONFIG_FILE), `${JSON.stringify(plan, null, 2)}\n`);
}
export function saveTokenToEnv(token) {
    const file = resolve('.env');
    let content = existsSync(file) ? readFileSync(file, 'utf8') : '';
    const line = `CLOUDFLARE_TOKEN=${token}`;
    if (/^CLOUDFLARE_TOKEN=.*$/m.test(content)) {
        content = content.replace(/^CLOUDFLARE_TOKEN=.*$/m, line);
    }
    else {
        if (content && !content.endsWith('\n'))
            content += '\n';
        content += `${line}\n`;
    }
    writeFileSync(file, content);
    try {
        chmodSync(file, 0o600);
    }
    catch {
        // Em sistemas sem suporte a chmod, segue normalmente.
    }
}
