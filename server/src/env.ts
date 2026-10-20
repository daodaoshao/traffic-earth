import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export const env = {
  port: Number(process.env.PORT ?? 8097),
  host: process.env.HOST ?? '0.0.0.0',
  dataDir: path.resolve(process.env.DATA_DIR ?? '/data'),
  /** Built web assets. In the image they sit next to the server; in dev Vite serves them. */
  webDir: path.resolve(process.env.WEB_DIR ?? path.join(here, '../../web/dist')),
  /** Optional: preset the admin password so the setup wizard skips that step. */
  adminPassword: process.env.ADMIN_PASSWORD || undefined,
  logLevel: process.env.LOG_LEVEL ?? 'info',
};
