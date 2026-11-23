import { createConnection, createServer } from 'node:net';
/** Retorna true se a porta está livre para um novo servidor. */
export function isPortFree(port) {
    return new Promise((resolvePort) => {
        const server = createServer();
        server.once('error', () => resolvePort(false));
        server.once('listening', () => {
            server.close(() => resolvePort(true));
        });
        server.listen(port, '127.0.0.1');
    });
}
/** Retorna true se há algo escutando na porta. */
export function isPortInUse(port) {
    return new Promise((resolvePort) => {
        const socket = createConnection({ port, host: '127.0.0.1' });
        socket.once('connect', () => {
            socket.destroy();
            resolvePort(true);
        });
        socket.once('error', () => resolvePort(false));
    });
}
