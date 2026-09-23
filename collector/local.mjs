import { DatabaseSync } from 'node:sqlite';
import http from 'node:http';
import worker from './entry.js';
import { sqliteAdapter } from './sqlite-adapter.js';
const database = new DatabaseSync(process.env.COLLECTOR_DB || 'collector/local.sqlite');
database.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;');
const env = { V2_ENABLED: process.env.V2_ENABLED || 'false', V2_APPROVED_MANIFEST_HASHES: process.env.V2_APPROVED_MANIFEST_HASHES || '', DB: sqliteAdapter(database), ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:4173,http://localhost:4173' };
http.createServer(async (req, res) => {
  try {
    const request = new Request(`http://localhost${req.url}`, { method: req.method, headers: req.headers, ...(req.method !== 'GET' && req.method !== 'HEAD' ? { body: req, duplex: 'half' } : {}) });
    const response = await worker.fetch(request, env);
    res.writeHead(response.status, Object.fromEntries(response.headers)); res.end(Buffer.from(await response.arrayBuffer()));
  } catch { res.writeHead(500); res.end('{"error":"Local collector error"}'); }
}).listen(Number(process.env.COLLECTOR_PORT || 8787), '127.0.0.1', () => console.log(`Local collector: http://127.0.0.1:${process.env.COLLECTOR_PORT || 8787} (v2 ${env.V2_ENABLED === 'true' ? 'explicitly enabled' : 'disabled'})`));
