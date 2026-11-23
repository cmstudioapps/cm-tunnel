import { createTunnel } from './Tunnel.js';
import { serve } from './StaticServer.js';
const tunnel = createTunnel;
tunnel.cloudflare = (options) => {
    const { domain, tunnelId, tunnelName, token, credentialsFile, cloudflaredPath, timeout, mode, protocol, ...rest } = options;
    // Monta o objeto cloudflare a partir das opções de atalho
    const cloudflareOpts = {};
    if (mode !== undefined)
        cloudflareOpts.mode = mode;
    if (domain !== undefined)
        cloudflareOpts.domain = domain;
    if (tunnelId !== undefined)
        cloudflareOpts.tunnelId = tunnelId;
    if (tunnelName !== undefined)
        cloudflareOpts.tunnelName = tunnelName;
    if (token !== undefined)
        cloudflareOpts.token = token;
    if (credentialsFile !== undefined)
        cloudflareOpts.credentialsFile = credentialsFile;
    if (cloudflaredPath !== undefined)
        cloudflareOpts.cloudflaredPath = cloudflaredPath;
    if (timeout !== undefined)
        cloudflareOpts.timeout = timeout;
    if (protocol !== undefined)
        cloudflareOpts.protocol = protocol;
    // Merge: se o usuário já passou cloudflare: {...}, combina
    const existingCloudflare = rest.cloudflare || {};
    const mergedCloudflare = { ...existingCloudflare, ...cloudflareOpts };
    return createTunnel({
        ...rest,
        provider: 'cloudflare',
        cloudflare: Object.keys(mergedCloudflare).length > 0 ? mergedCloudflare : undefined,
    });
};
tunnel.localtunnel = (options) => createTunnel({ ...options, provider: 'localtunnel' });
tunnel.ngrok = (options) => createTunnel({ ...options, provider: 'ngrok' });
tunnel.serve = serve;
export default tunnel;
