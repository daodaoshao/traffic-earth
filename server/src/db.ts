import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';

fs.mkdirSync(env.dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(env.dataDir, 'traffic-earth.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA synchronous = NORMAL;
  PRAGMA busy_timeout = 3000;
`);

const migrations: string[] = [
  `
  CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE sessions (token TEXT PRIMARY KEY, expires INTEGER NOT NULL);
  -- key is a MAC address when the router told us one, otherwise an IP.
  CREATE TABLE devices (key TEXT PRIMARY KEY, name TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '');
  CREATE TABLE audit (ts INTEGER NOT NULL, action TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '');

  -- Per-minute and per-hour traffic, one row per (bucket, source, device, category, country, exit).
  CREATE TABLE rollup_min (
    ts INTEGER NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, cat TEXT NOT NULL,
    cc TEXT NOT NULL, chain TEXT NOT NULL, up INTEGER NOT NULL, down INTEGER NOT NULL, conns INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX rollup_min_key ON rollup_min (ts, source, device, cat, cc, chain);
  CREATE TABLE rollup_hour (
    ts INTEGER NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL, cat TEXT NOT NULL,
    cc TEXT NOT NULL, chain TEXT NOT NULL, up INTEGER NOT NULL, down INTEGER NOT NULL, conns INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX rollup_hour_key ON rollup_hour (ts, source, device, cat, cc, chain);

  -- One row per finished connection.
  CREATE TABLE flows (
    start INTEGER NOT NULL, end INTEGER NOT NULL, source TEXT NOT NULL, device TEXT NOT NULL,
    host TEXT NOT NULL, ip TEXT NOT NULL, port INTEGER NOT NULL, net TEXT NOT NULL,
    cc TEXT NOT NULL, city TEXT NOT NULL, asn INTEGER NOT NULL, cat TEXT NOT NULL,
    chain TEXT NOT NULL, rule TEXT NOT NULL, up INTEGER NOT NULL, down INTEGER NOT NULL
  );
  CREATE INDEX flows_end ON flows (end);
  `,
];

const version = (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version;
for (let i = version; i < migrations.length; i++) {
  db.exec('BEGIN');
  try {
    db.exec(migrations[i]);
    db.exec(`PRAGMA user_version = ${i + 1}`);
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function tx<T>(fn: () => T): T {
  db.exec('BEGIN');
  try {
    const r = fn();
    db.exec('COMMIT');
    return r;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
}

export function audit(action: string, detail = '') {
  db.prepare('INSERT INTO audit (ts, action, detail) VALUES (?, ?, ?)').run(Date.now(), action, detail);
}
