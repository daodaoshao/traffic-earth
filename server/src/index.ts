import fs from 'node:fs';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { env } from './env.js';
import './db.js';
import { registerApi } from './api.js';
import { engine } from './engine.js';
import { initGeo } from './geo.js';

const app = Fastify({ logger: { level: env.logLevel }, trustProxy: true });

await app.register(cookie);
await app.register(websocket);

app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
  const code = err.statusCode ?? 500;
  if (code >= 500) app.log.error(err);
  reply.code(code).send({ error: err.message });
});

registerApi(app);

if (fs.existsSync(env.webDir)) {
  await app.register(fastifyStatic, { root: env.webDir, wildcard: true });
  // Client-side routes all serve the app shell.
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' });
    return reply.sendFile('index.html');
  });
}

await initGeo();
engine.start();

const shutdown = async () => {
  engine.stop();
  await app.close();
  process.exit(0);
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

await app.listen({ port: env.port, host: env.host });
