import { describe, it, expect, vi } from "vitest";
import tunnel from "../src/index.js";
import http from 'http';

describe("StaticServer", () => {
  it("deve rodar localmente sem tunel e responder com HTML", async () => {
    const server = await tunnel.serve({
      html: '<h1>Teste Local</h1>'
    });
    
    expect(server.url).toContain("http://127.0.0.1:");
    expect(server.port).toBeGreaterThan(0);
    
    // Testa a requisição
    const response = await new Promise<string>((resolve) => {
       http.get(server.url, (res) => {
         let data = '';
         res.on('data', chunk => data += chunk);
         res.on('end', () => resolve(data));
       });
    });

    expect(response).toBe('<h1>Teste Local</h1>');
    
    server.stop();
  });
});
