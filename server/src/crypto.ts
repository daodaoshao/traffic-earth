import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './env.js';

/**
 * Secrets (mihomo secret etc.) are encrypted at rest with a key that lives in its own
 * file inside the data volume, so a leaked database alone does not leak them.
 */
const keyPath = path.join(env.dataDir, 'secret.key');

function loadKey(): Buffer {
  if (fs.existsSync(keyPath)) return Buffer.from(fs.readFileSync(keyPath, 'utf8').trim(), 'base64');
  const key = crypto.randomBytes(32);
  fs.writeFileSync(keyPath, key.toString('base64'), { mode: 0o600 });
  return key;
}

const key = loadKey();

export function encrypt(plain: string): string {
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return ['v1', iv.toString('base64'), c.getAuthTag().toString('base64'), body.toString('base64')].join(':');
}

export function decrypt(blob: string): string {
  if (!blob) return '';
  const [v, iv, tag, body] = blob.split(':');
  if (v !== 'v1') throw new Error('unknown secret format');
  const d = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
  d.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([d.update(Buffer.from(body, 'base64')), d.final()]).toString('utf8');
}

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16);
  const h = crypto.scryptSync(pw, salt, 32);
  return `scrypt:${salt.toString('base64')}:${h.toString('base64')}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, salt, h] = stored.split(':');
  if (alg !== 'scrypt') return false;
  const want = Buffer.from(h, 'base64');
  const got = crypto.scryptSync(pw, Buffer.from(salt, 'base64'), want.length);
  return crypto.timingSafeEqual(want, got);
}

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
