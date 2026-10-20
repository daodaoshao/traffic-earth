import { EventEmitter } from 'node:events';
import { db } from './db.js';
import { decrypt, encrypt, randomToken } from './crypto.js';

export interface SourceConfig {
  id: string;
  name: string;
  type: 'openwrt' | 'mihomo';
  url: string;
  /** openwrt: rpcd login name. */
  username: string;
  /** openwrt: rpcd password; mihomo: API secret. Encrypted at rest; never sent to the browser. */
  secretEnc: string;
  enabled: boolean;
  /** openwrt: seconds between polls (raised automatically on busy routers). */
  pollSec: number;
  /** openwrt: WAN devices for the headline counters; empty = detect. */
  wan: string[];
  /** mihomo: id of the openwrt source this core runs on, so the two are merged without double counting. */
  linkTo: string;
}

export interface Settings {
  setupDone: boolean;
  passwordHash: string;
  sources: SourceConfig[];
  home: { lat: number; lon: number; name: string } | null;
  retention: { flowsDays: number; minuteDays: number; hourDays: number };
  flushIntervalSec: number;
  geoipAutoUpdate: boolean;
  display: { quality: 'auto' | 'high' | 'medium' | 'low'; rotateSpeed: number; globeStyle: string };
}

const defaults: Settings = {
  setupDone: false,
  passwordHash: '',
  sources: [],
  home: null,
  retention: { flowsDays: 7, minuteDays: 14, hourDays: 730 },
  // Writes are batched: SD cards and eMMC are the usual home for this.
  flushIntervalSec: 300,
  geoipAutoUpdate: true,
  display: { quality: 'auto', rotateSpeed: 0.35, globeStyle: 'dots' },
};

const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

export const settingsEvents = new EventEmitter();

export function get<K extends keyof Settings>(key: K): Settings[K] {
  const row = getStmt.get(key) as { value: string } | undefined;
  if (!row) return structuredClone(defaults[key]);
  const v = JSON.parse(row.value);
  // Merge nested defaults so new fields appear for old installs.
  const d = defaults[key];
  if (d && typeof d === 'object' && !Array.isArray(d) && v && typeof v === 'object') return { ...d, ...v };
  return v;
}

export function set<K extends keyof Settings>(key: K, value: Settings[K]) {
  setStmt.run(key, JSON.stringify(value));
  settingsEvents.emit('change', key);
}

export const sourceSecret = (s: SourceConfig) => decrypt(s.secretEnc);

export interface SourceInput {
  type: 'openwrt' | 'mihomo';
  name?: string;
  url: string;
  username?: string;
  /** Omit to keep the stored secret when editing. */
  secret?: string;
  enabled?: boolean;
  pollSec?: number;
  wan?: string[];
  linkTo?: string;
}

export function buildSource(input: SourceInput, prev?: SourceConfig): SourceConfig {
  const type = input.type === 'mihomo' ? 'mihomo' : 'openwrt';
  return {
    id: prev?.id ?? randomToken(6),
    name: (input.name ?? '').trim() || (type === 'openwrt' ? 'OpenWrt' : 'mihomo'),
    type,
    url: normalizeUrl(input.url),
    username: type === 'openwrt' ? (input.username ?? prev?.username ?? 'traffic-earth') : '',
    secretEnc: input.secret !== undefined ? encrypt(input.secret) : (prev?.secretEnc ?? ''),
    enabled: input.enabled ?? prev?.enabled ?? true,
    pollSec: Math.min(30, Math.max(1, Number(input.pollSec ?? prev?.pollSec ?? 2))),
    wan: (input.wan ?? prev?.wan ?? []).filter(Boolean),
    linkTo: type === 'mihomo' ? (input.linkTo ?? prev?.linkTo ?? '') : '',
  };
}

export function normalizeUrl(raw: string): string {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = 'http://' + u;
  const url = new URL(u);
  return `${url.protocol}//${url.host}${url.pathname.replace(/\/+$/, '')}`;
}

/** What the browser is allowed to see. */
export function publicSource(s: SourceConfig) {
  const { secretEnc, ...rest } = s;
  return { ...rest, hasSecret: !!secretEnc };
}
