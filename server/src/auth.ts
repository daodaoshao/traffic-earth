import type { FastifyReply, FastifyRequest } from 'fastify';
import { db } from './db.js';
import { randomToken, verifyPassword } from './crypto.js';
import * as settings from './settings.js';

export const COOKIE = 'te_session';
const TTL = 30 * 86400e3;

export function createSession(reply: FastifyReply) {
  const token = randomToken();
  db.prepare('INSERT INTO sessions (token, expires) VALUES (?, ?)').run(token, Date.now() + TTL);
  reply.setCookie(COOKIE, token, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: TTL / 1000 });
}

export function destroySession(req: FastifyRequest, reply: FastifyReply) {
  const t = req.cookies[COOKIE];
  if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(t);
  reply.clearCookie(COOKIE, { path: '/' });
}

export function isAuthed(req: FastifyRequest): boolean {
  const t = req.cookies[COOKIE];
  if (!t) return false;
  const row = db.prepare('SELECT expires FROM sessions WHERE token = ?').get(t) as { expires: number } | undefined;
  return !!row && row.expires > Date.now();
}

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!isAuthed(req)) return reply.code(401).send({ error: 'unauthorized' });
}

/** Five tries per minute per address is plenty for a person and slow for a script. */
const attempts = new Map<string, number[]>();
export function checkPassword(ip: string, pw: string): 'ok' | 'bad' | 'throttled' {
  const now = Date.now();
  const list = (attempts.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (list.length >= 5) return 'throttled';
  const hash = settings.get('passwordHash');
  if (hash && verifyPassword(pw, hash)) {
    attempts.delete(ip);
    return 'ok';
  }
  list.push(now);
  attempts.set(ip, list);
  return 'bad';
}
