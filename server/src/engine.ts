import { getDomain } from 'tldts';
import { MihomoAdapter } from './adapters/mihomo.js';
import { OpenWrtAdapter } from './adapters/openwrt.js';
import type { Adapter, FlowConn, HostEntry, Snapshot, SourceStatus } from './adapters/types.js';
import { classify } from './classify.js';
import { db, tx } from './db.js';
import { isPrivateIp, lookup } from './geo.js';
import { normIp } from './ip.js';
import * as settings from './settings.js';
import type { SourceConfig } from './settings.js';

/** Facts about a connection, computed once when we first see it. */
interface ConnInfo {
  start: number;
  device: string; // device key (MAC when known, else IP, or 'router')
  host: string;
  key: string; // registrable domain, or the remote IP when there is no host name
  ip: string;
  port: number;
  net: string;
  point: string; // '' when it has no place on the globe
  cc: string;
  city: string;
  asn: number;
  org: string;
  cat: string;
  chain: string;
  rule: string;
  inbound: boolean;
}

interface ConnState {
  info: ConnInfo;
  up: number;
  down: number;
}

export interface Point {
  lat: number;
  lon: number;
  cc: string;
  country: string;
  city: string;
}

/** One aggregated line of the live frame: traffic between one device and one destination. */
export interface Row {
  s: string; // source id
  d: string; // device key
  h: string; // domain or ip
  p: string; // point key
  c: string; // category
  x: string; // exit (first element of mihomo's chain; DIRECT for router data)
  i: 0 | 1; // inbound
  u: number; // bytes/s leaving home
  w: number; // bytes/s arriving home
  n: number; // open connections
  o?: string; // ASN org, for rows without a host name
}

const pointKey = (lat: number, lon: number) => `${lat.toFixed(1)},${lon.toFixed(1)}`;
const minuteOf = (t: number) => Math.floor(t / 60_000) * 60_000;
const hourOf = (t: number) => Math.floor(t / 3_600_000) * 3_600_000;
const localDay = (t: number) => new Date(t).toLocaleDateString('sv-SE');

/** Who is who on the LAN: router-provided names, overridden by the user's own. */
class DeviceDirectory {
  private byIp = new Map<string, string>(); // ip -> key
  private auto = new Map<string, { name: string; ips: string[] }>(); // key -> info from routers
  private manual = new Map<string, { name: string; icon: string }>();

  constructor() {
    this.loadManual();
  }

  loadManual() {
    this.manual.clear();
    for (const r of db.prepare('SELECT key, name, icon FROM devices').all() as { key: string; name: string; icon: string }[])
      this.manual.set(r.key, { name: r.name, icon: r.icon });
  }

  addHosts(hosts: HostEntry[]) {
    for (const h of hosts) {
      this.auto.set(h.key, { name: h.name, ips: h.ips });
      for (const ip of h.ips) this.byIp.set(ip, h.key);
    }
  }

  keyFor(ip: string): string {
    if (ip === 'router') return 'router';
    const n = normIp(ip);
    return this.byIp.get(n) ?? n;
  }

  describe(key: string) {
    const m = this.manual.get(key);
    const a = this.auto.get(key);
    const name = m?.name || a?.name || (key === 'router' ? '路由器' : '');
    return { name, icon: m?.icon ?? '', ips: a?.ips ?? (key.includes(':') || key.includes('.') ? [key] : []) };
  }

  /** Everything we know, for the device editor. */
  all(seen: Map<string, number>) {
    const keys = new Set([...this.auto.keys(), ...this.manual.keys(), ...seen.keys()]);
    return [...keys].map((key) => ({
      key,
      ...this.describe(key),
      autoName: this.auto.get(key)?.name ?? '',
      lastSeen: seen.get(key) ?? 0,
    }));
  }
}

class SourceRunner {
  adapter: Adapter;
  conns = new Map<string, ConnState>();
  /** "ip|port" of every connection this source sees; used by linked sources to skip duplicates. */
  localEnds = new Set<string>();
  rows: Row[] = [];
  rate = { up: 0, down: 0 };
  hasTotals = false;
  lastTotals: { up: number; down: number; t: number } | null = null;
  lastSnapshot = 0;
  primed = false;

  constructor(
    public cfg: SourceConfig,
    private engine: Engine,
  ) {
    const secret = settings.sourceSecret(cfg);
    this.adapter =
      cfg.type === 'openwrt'
        ? new OpenWrtAdapter(cfg.url, cfg.username, secret, { pollSec: cfg.pollSec, wan: cfg.wan })
        : new MihomoAdapter(cfg.url, secret);
    this.adapter.on('snapshot', (s: Snapshot) => this.onSnapshot(s));
    this.adapter.on('hosts', (h: HostEntry[]) => engine.devices.addHosts(h));
    this.adapter.on('status', (st: SourceStatus) => {
      if (st.state !== 'ok') this.reset();
    });
  }

  /** Start over after an outage so a counter jump isn't counted as a burst. */
  private reset() {
    for (const st of this.conns.values()) this.engine.closed(this.cfg.id, st, Date.now());
    this.conns.clear();
    this.localEnds.clear();
    this.rows = [];
    this.rate = { up: 0, down: 0 };
    this.lastTotals = null;
    this.primed = false;
  }

  private enrich(c: FlowConn): ConnInfo {
    const geo = lookup(c.remote);
    const priv = !c.host && isPrivateIp(c.remote);
    let point = '';
    if (geo) {
      point = pointKey(geo.lat, geo.lon);
      this.engine.points.set(point, { lat: geo.lat, lon: geo.lon, cc: geo.cc, country: geo.country, city: geo.city });
    }
    return {
      start: c.start,
      device: this.engine.devices.keyFor(c.device),
      host: c.host,
      key: c.host ? (getDomain(c.host) ?? c.host) : c.remote,
      ip: c.remote,
      port: c.inbound ? c.sport : c.rport,
      net: c.net,
      point,
      cc: geo?.cc ?? (priv ? 'lan' : ''),
      city: geo?.city ?? '',
      asn: geo?.asn ?? 0,
      org: geo?.org ?? '',
      cat: c.inbound ? 'inbound' : classify({ host: c.host, port: c.rport, asn: geo?.asn ?? 0, private: priv }),
      chain: c.chain,
      rule: c.rule,
      inbound: c.inbound,
    };
  }

  onSnapshot(s: Snapshot) {
    const now = Date.now();
    const first = !this.primed;
    const dt = this.lastTotals ? Math.max(0.2, (now - this.lastTotals.t) / 1000) : 1;
    if (s.totals) {
      this.hasTotals = true;
      if (this.lastTotals)
        this.rate = {
          up: Math.max(0, s.totals.up - this.lastTotals.up) / dt,
          down: Math.max(0, s.totals.down - this.lastTotals.down) / dt,
        };
      this.lastTotals = { ...s.totals, t: now };
    } else {
      this.lastTotals = { up: 0, down: 0, t: now };
    }
    this.lastSnapshot = now;
    this.primed = true;

    // A router that runs a linked mihomo core: mihomo already reports its outbound connections
    // (with host names), so keep only what mihomo can't see — mainly inbound traffic.
    const linked = this.engine.linkedEnds(this.cfg.id);

    const seen = new Set<string>();
    const ends = new Set<string>();
    const groups = new Map<string, Row>();
    let sumUp = 0;
    let sumDown = 0;
    for (const c of s.conns) {
      ends.add(`${normIp(c.device)}|${c.sport}`);
      if (linked && !c.inbound && (c.device === 'router' || linked.has(`${normIp(c.device)}|${c.sport}`))) continue;
      seen.add(c.id);
      let st = this.conns.get(c.id);
      let du = 0;
      let dd = 0;
      if (!st) {
        st = { info: this.enrich(c), up: c.up, down: c.down };
        this.conns.set(c.id, st);
        // On the first snapshot we can't tell when those bytes moved; count from here on.
        if (!first) {
          du = c.up;
          dd = c.down;
          this.engine.account(this.cfg.id, st.info, 0, 0, 1);
        }
      } else {
        du = Math.max(0, c.up - st.up);
        dd = Math.max(0, c.down - st.down);
        st.up = c.up;
        st.down = c.down;
      }
      const i = st.info;
      if (du || dd) this.engine.account(this.cfg.id, i, du, dd, 0);
      sumUp += du;
      sumDown += dd;
      this.engine.deviceSeen.set(i.device, now);

      const gk = `${i.device}|${i.key}|${i.point}|${i.cat}|${i.chain}|${+i.inbound}`;
      let row = groups.get(gk);
      if (!row) {
        row = { s: this.cfg.id, d: i.device, h: i.key, p: i.point, c: i.cat, x: i.chain, i: i.inbound ? 1 : 0, u: 0, w: 0, n: 0 };
        if (!i.host && i.org) row.o = i.org;
        groups.set(gk, row);
      }
      row.u += du / dt;
      row.w += dd / dt;
      row.n++;
    }
    this.localEnds = ends;
    for (const [id, st] of this.conns) {
      if (!seen.has(id)) {
        this.engine.closed(this.cfg.id, st, now);
        this.conns.delete(id);
      }
    }
    if (!s.totals) this.rate = { up: sumUp / dt, down: sumDown / dt };
    this.rows = [...groups.values()].map((r) => ({ ...r, u: Math.round(r.u), w: Math.round(r.w) }));
  }
}

interface Bucket {
  source: string;
  device: string;
  cat: string;
  cc: string;
  chain: string;
  ts: number;
  up: number;
  down: number;
  conns: number;
}

type Today = {
  day: string;
  up: number;
  down: number;
  cats: Record<string, [number, number]>;
  devs: Record<string, [number, number]>;
};

const emptyToday = (day: string): Today => ({ day, up: 0, down: 0, cats: {}, devs: {} });

export class Engine {
  runners = new Map<string, SourceRunner>();
  points = new Map<string, Point>();
  deviceSeen = new Map<string, number>();
  devices = new DeviceDirectory();
  private buckets = new Map<string, Bucket>();
  private flows: Array<[ConnState, string, number]> = [];
  today: Today = emptyToday(localDay(Date.now()));
  private flushTimer: NodeJS.Timeout | null = null;

  start() {
    this.loadToday();
    this.syncSources();
    settings.settingsEvents.on('change', (k) => {
      if (k === 'sources') this.syncSources();
      if (k === 'flushIntervalSec') this.scheduleFlush();
    });
    this.scheduleFlush();
    this.prune();
    setInterval(() => this.prune(), 6 * 3600e3).unref();
  }

  private scheduleFlush() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    const sec = Math.max(30, settings.get('flushIntervalSec'));
    this.flushTimer = setInterval(() => this.flush(false), sec * 1000);
    this.flushTimer.unref();
  }

  syncSources() {
    const want = new Map(settings.get('sources').filter((s) => s.enabled).map((s) => [s.id, s]));
    for (const [id, r] of this.runners) {
      const cfg = want.get(id);
      if (!cfg || JSON.stringify(cfg) !== JSON.stringify(r.cfg)) {
        r.adapter.stop();
        for (const st of r.conns.values()) this.closed(id, st, Date.now());
        this.runners.delete(id);
      }
    }
    for (const [id, cfg] of want) {
      if (this.runners.has(id)) continue;
      const r = new SourceRunner(cfg, this);
      this.runners.set(id, r);
      r.adapter.start();
    }
  }

  sourceStatus(id: string): SourceStatus {
    return this.runners.get(id)?.adapter.status ?? { state: 'disabled' };
  }

  /** Local endpoints seen by mihomo cores linked to this router, or null when none is linked. */
  linkedEnds(routerId: string): Set<string> | null {
    let out: Set<string> | null = null;
    for (const r of this.runners.values()) {
      if (r.cfg.type !== 'mihomo' || r.cfg.linkTo !== routerId) continue;
      out ??= new Set();
      for (const e of r.localEnds) out.add(e);
    }
    return out;
  }

  /** Add traffic to the minute bucket and today's counters. */
  account(source: string, i: ConnInfo, up: number, down: number, newConns: number) {
    const now = Date.now();
    const ts = minuteOf(now);
    const k = `${ts}|${source}|${i.device}|${i.cat}|${i.cc}|${i.chain}`;
    let b = this.buckets.get(k);
    if (!b) {
      b = { source, device: i.device, cat: i.cat, cc: i.cc, chain: i.chain, ts, up: 0, down: 0, conns: 0 };
      this.buckets.set(k, b);
    }
    b.up += up;
    b.down += down;
    b.conns += newConns;

    const day = localDay(now);
    if (day !== this.today.day) this.today = emptyToday(day);
    this.today.up += up;
    this.today.down += down;
    const c = (this.today.cats[i.cat] ??= [0, 0]);
    c[0] += up;
    c[1] += down;
    const d = (this.today.devs[i.device] ??= [0, 0]);
    d[0] += up;
    d[1] += down;
  }

  closed(source: string, st: ConnState, end: number) {
    this.flows.push([st, source, end]);
    // Never let the buffer grow without bound if flushes keep failing.
    if (this.flows.length > 200_000) this.flows.splice(0, this.flows.length - 200_000);
  }

  private loadToday() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const rows = db
      .prepare(`SELECT device, cat, SUM(up) up, SUM(down) down FROM rollup_min WHERE ts >= ? GROUP BY device, cat`)
      .all(start.getTime()) as Array<{ device: string; cat: string; up: number; down: number }>;
    for (const r of rows) {
      this.today.up += r.up;
      this.today.down += r.down;
      const c = (this.today.cats[r.cat] ??= [0, 0]);
      c[0] += r.up;
      c[1] += r.down;
      const d = (this.today.devs[r.device] ??= [0, 0]);
      d[0] += r.up;
      d[1] += r.down;
    }
  }

  /** Write finished minutes and closed connections. `all` also writes the current minute (shutdown). */
  flush(all: boolean) {
    const cur = minuteOf(Date.now());
    const ready = [...this.buckets.entries()].filter(([, b]) => all || b.ts < cur);
    const flows = this.flows;
    if (!ready.length && !flows.length) return;
    this.flows = [];
    const upsert = (table: string) =>
      db.prepare(
        `INSERT INTO ${table} (ts, source, device, cat, cc, chain, up, down, conns) VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT (ts, source, device, cat, cc, chain) DO UPDATE SET
           up = up + excluded.up, down = down + excluded.down, conns = conns + excluded.conns`,
      );
    const insMin = upsert('rollup_min');
    const insHour = upsert('rollup_hour');
    const insFlow = db.prepare(
      `INSERT INTO flows (start, end, source, device, host, ip, port, net, cc, city, asn, cat, chain, rule, up, down)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    );
    try {
      tx(() => {
        for (const [, b] of ready) {
          insMin.run(b.ts, b.source, b.device, b.cat, b.cc, b.chain, b.up, b.down, b.conns);
          insHour.run(hourOf(b.ts), b.source, b.device, b.cat, b.cc, b.chain, b.up, b.down, b.conns);
        }
        for (const [st, source, end] of flows) {
          const i = st.info;
          insFlow.run(i.start, end, source, i.device, i.host, i.ip, i.port, i.net, i.cc, i.city, i.asn, i.cat, i.chain, i.rule, st.up, st.down);
        }
      });
      for (const [k] of ready) this.buckets.delete(k);
    } catch (e) {
      console.error('flush failed', e);
      this.flows = flows.concat(this.flows);
    }
  }

  prune() {
    const r = settings.get('retention');
    const now = Date.now();
    db.prepare('DELETE FROM flows WHERE end < ?').run(now - r.flowsDays * 86400e3);
    db.prepare('DELETE FROM rollup_min WHERE ts < ?').run(now - r.minuteDays * 86400e3);
    db.prepare('DELETE FROM rollup_hour WHERE ts < ?').run(now - r.hourDays * 86400e3);
    db.prepare('DELETE FROM sessions WHERE expires < ?').run(now);
  }

  /** The once-a-second message pushed to every open globe. */
  frame() {
    const now = Date.now();
    const rows: Row[] = [];
    const sources = [];
    let up = 0;
    let down = 0;
    let conns = 0;
    for (const [id, r] of this.runners) {
      sources.push({ id, name: r.cfg.name, type: r.cfg.type, status: r.adapter.status });
      if (now - r.lastSnapshot > Math.max(6000, r.cfg.pollSec * 3000)) continue;
      rows.push(...r.rows);
      conns += r.conns.size;
      // A linked mihomo's traffic already passes the router's WAN counters.
      const linkedToActive = r.cfg.type === 'mihomo' && r.cfg.linkTo && this.runners.get(r.cfg.linkTo)?.hasTotals;
      if (!linkedToActive) {
        up += r.rate.up;
        down += r.rate.down;
      }
    }
    const points: Record<string, Point> = {};
    const devices: Record<string, { name: string; icon: string }> = {};
    for (const row of rows) {
      if (row.p && !points[row.p]) points[row.p] = this.points.get(row.p)!;
      if (!devices[row.d]) {
        const d = this.devices.describe(row.d);
        devices[row.d] = { name: d.name, icon: d.icon };
      }
    }
    for (const k of Object.keys(this.today.devs))
      if (!devices[k]) {
        const d = this.devices.describe(k);
        devices[k] = { name: d.name, icon: d.icon };
      }
    if (localDay(now) !== this.today.day) this.today = emptyToday(localDay(now));
    return { t: now, total: { up: Math.round(up), down: Math.round(down), conns }, sources, rows, points, devices, today: this.today };
  }

  stop() {
    for (const r of this.runners.values()) r.adapter.stop();
    this.flush(true);
  }
}

export const engine = new Engine();
