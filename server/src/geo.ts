import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import zlib from 'node:zlib';
import maxmind, { type AsnResponse, type CityResponse, type Reader } from 'maxmind';
import { env } from './env.js';
import * as settings from './settings.js';

/**
 * IP → location / ASN using DB-IP Lite (CC BY 4.0, https://db-ip.com).
 * Both databases are downloaded into the data volume on first start and refreshed monthly.
 */

export interface GeoInfo {
  lat: number;
  lon: number;
  cc: string; // ISO country code, lower case; the browser names the country in its language
  cityEn: string;
  cityZh: string; // often missing in DB-IP Lite
  regionEn: string; // state / province
  asn: number;
  org: string;
}

const dir = path.join(env.dataDir, 'geoip');
const files = { city: path.join(dir, 'dbip-city-lite.mmdb'), asn: path.join(dir, 'dbip-asn-lite.mmdb') };

let cityDb: Reader<CityResponse> | null = null;
let asnDb: Reader<AsnResponse> | null = null;
let status: { state: 'missing' | 'downloading' | 'ready' | 'error'; error?: string; builtAt?: string } = {
  state: 'missing',
};
const cache = new Map<string, GeoInfo | null>();

export const geoStatus = () => ({ ...status, attribution: 'IP geolocation by DB-IP (db-ip.com), CC BY 4.0' });

const month = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

async function download(kind: 'city' | 'asn') {
  const now = new Date();
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  let lastErr = '';
  // A new month's file shows up a day or two late; fall back to last month.
  for (const m of [month(now), month(prev)]) {
    const url = `https://download.db-ip.com/free/dbip-${kind}-lite-${m}.mmdb.gz`;
    const res = await fetch(url).catch((e) => ({ ok: false, status: 0, statusText: String(e) }) as Response);
    if (!res.ok || !res.body) {
      lastErr = `${url}: ${res.status} ${res.statusText}`;
      continue;
    }
    const tmp = files[kind] + '.tmp';
    await pipeline(Readable.fromWeb(res.body as any), zlib.createGunzip(), fs.createWriteStream(tmp));
    fs.renameSync(tmp, files[kind]);
    return;
  }
  throw new Error(lastErr);
}

async function load() {
  cityDb = await maxmind.open<CityResponse>(files.city);
  asnDb = await maxmind.open<AsnResponse>(files.asn);
  cache.clear();
  const built = new Date((cityDb.metadata.buildEpoch as unknown as Date).valueOf());
  status = { state: 'ready', builtAt: isNaN(+built) ? undefined : built.toISOString() };
}

function isStale(file: string) {
  if (!fs.existsSync(file)) return true;
  return month(fs.statSync(file).mtime) !== month(new Date());
}

export async function updateGeo(force = false) {
  if (status.state === 'downloading') return;
  const need = force || isStale(files.city) || isStale(files.asn) || !cityDb;
  if (!need) return;
  fs.mkdirSync(dir, { recursive: true });
  const prevState = status;
  try {
    if (force || isStale(files.city) || isStale(files.asn)) {
      status = { state: 'downloading' };
      await download('asn');
      await download('city');
    }
    await load();
  } catch (e) {
    // Keep serving the old database if we had one.
    status = cityDb ? { ...prevState, error: String(e) } : { state: 'error', error: String(e) };
  }
}

export async function initGeo() {
  if (fs.existsSync(files.city) && fs.existsSync(files.asn)) await load().catch(() => {});
  if (settings.get('geoipAutoUpdate')) void updateGeo();
  setInterval(() => settings.get('geoipAutoUpdate') && void updateGeo(), 24 * 3600e3).unref();
}

const privateV4 = new net.BlockList();
for (const [a, p] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.168.0.0', 16], ['198.18.0.0', 15], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) privateV4.addSubnet(a, p, 'ipv4');
const privateV6 = new net.BlockList();
for (const [a, p] of [['::', 127], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8]] as const) privateV6.addSubnet(a, p, 'ipv6');

export function isPrivateIp(ip: string): boolean {
  const v = net.isIP(ip);
  if (v === 4) return privateV4.check(ip, 'ipv4');
  if (v === 6) {
    const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
    if (m) return privateV4.check(m[1], 'ipv4');
    return privateV6.check(ip, 'ipv6');
  }
  return true;
}

export function lookup(ip: string): GeoInfo | null {
  if (!ip || !cityDb || isPrivateIp(ip)) return null;
  if (cache.has(ip)) return cache.get(ip)!;
  let info: GeoInfo | null = null;
  try {
    const c = cityDb.get(ip);
    const a = asnDb?.get(ip);
    if (c?.location) {
      const cityNames = (c.city?.names ?? {}) as Record<string, string>;
      info = {
        lat: c.location.latitude,
        lon: c.location.longitude,
        cc: (c.country?.iso_code ?? '').toLowerCase(),
        cityEn: cityNames.en ?? '',
        cityZh: cityNames['zh-CN'] ?? '',
        regionEn: ((c.subdivisions?.[0]?.names ?? {}) as Record<string, string>).en ?? '',
        asn: a?.autonomous_system_number ?? 0,
        org: a?.autonomous_system_organization ?? '',
      };
    }
  } catch {
    info = null;
  }
  if (cache.size > 50_000) cache.clear();
  cache.set(ip, info);
  return info;
}
