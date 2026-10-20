import { EventEmitter } from 'node:events';
import { type Msg, toMsg } from '../msg.js';
import type { Adapter, FlowConn, Snapshot, SourceStatus } from './types.js';

/** The subset of mihomo's /connections payload we rely on. Older cores omit some metadata fields. */
interface MihomoConnection {
  id: string;
  upload: number;
  download: number;
  start: string;
  chains: string[];
  rule: string;
  rulePayload: string;
  metadata: {
    network: string;
    sourceIP: string;
    sourcePort: string;
    destinationIP: string;
    destinationPort: string;
    host: string;
    sniffHost?: string;
    remoteDestination?: string;
  };
}

interface MihomoSnapshot {
  downloadTotal: number;
  uploadTotal: number;
  connections: MihomoConnection[] | null;
}

const wsUrl = (base: string, secret: string) => {
  const u = new URL(base.replace(/^http/i, 'ws') + '/connections');
  u.searchParams.set('interval', '1000');
  if (secret) u.searchParams.set('token', secret);
  return u.toString();
};

function normalize(s: MihomoSnapshot): Snapshot {
  const conns: FlowConn[] = [];
  for (const c of s.connections ?? []) {
    const m = c.metadata;
    conns.push({
      id: c.id,
      device: m.sourceIP || 'router',
      sport: Number(m.sourcePort) || 0,
      remote: m.destinationIP || m.remoteDestination || '',
      rport: Number(m.destinationPort) || 0,
      host: (m.host || m.sniffHost || '').toLowerCase(),
      net: m.network,
      chain: c.chains?.[0] ?? 'DIRECT',
      rule: c.rulePayload ? `${c.rule},${c.rulePayload}` : c.rule,
      up: c.upload,
      down: c.download,
      start: Date.parse(c.start) || Date.now(),
      inbound: false,
    });
  }
  return { t: Date.now(), conns, totals: { up: s.uploadTotal, down: s.downloadTotal } };
}

/** Streams /connections snapshots over WebSocket and reconnects with backoff. */
export class MihomoAdapter extends EventEmitter implements Adapter {
  status: SourceStatus = { state: 'connecting' };
  private ws: WebSocket | null = null;
  private timer: NodeJS.Timeout | null = null;
  private watchdog: NodeJS.Timeout | null = null;
  private backoff = 1000;
  private stopped = false;

  constructor(
    private url: string,
    private secret: string,
  ) {
    super();
  }

  start() {
    this.stopped = false;
    this.connect();
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.ws?.close();
    this.ws = null;
  }

  private setStatus(s: SourceStatus) {
    this.status = s;
    this.emit('status', s);
  }

  private connect() {
    if (this.stopped) return;
    this.setStatus({ state: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl(this.url, this.secret));
    } catch (e) {
      return this.fail(toMsg(e));
    }
    this.ws = ws;
    let gotData = false;
    const kick = () => {
      if (this.watchdog) clearTimeout(this.watchdog);
      // mihomo pushes every second; silence for 10s means a dead link.
      this.watchdog = setTimeout(() => {
        ws.close();
        this.fail({ code: 'noData', params: { sec: 10 } });
      }, 10_000);
    };
    kick();
    ws.onmessage = (ev) => {
      kick();
      if (!gotData) {
        gotData = true;
        this.backoff = 1000;
        this.setStatus({ state: 'ok', since: Date.now() });
      }
      let snap: MihomoSnapshot;
      try {
        snap = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      this.emit('snapshot', normalize(snap));
    };
    ws.onerror = () => {};
    ws.onclose = (ev) => {
      if (this.ws !== ws || this.stopped) return;
      this.fail(gotData ? { code: 'wsClosed', params: { code: ev.code } } : { code: 'wsFailed' });
    };
  }

  private fail(error: Msg) {
    if (this.stopped) return;
    if (this.watchdog) clearTimeout(this.watchdog);
    const wait = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 30_000);
    this.setStatus({ state: 'error', error, retryAt: Date.now() + wait });
    this.ws = null;
    this.timer = setTimeout(() => this.connect(), wait);
  }
}

/** One-shot check used by the setup wizard and the "test connection" button. */
export async function testMihomo(url: string, secret: string): Promise<TestResult> {
  const headers: Record<string, string> = secret ? { Authorization: `Bearer ${secret}` } : {};
  const t0 = Date.now();
  try {
    const v = await fetch(url + '/version', { headers, signal: AbortSignal.timeout(5000) });
    if (v.status === 401) return { ok: false, error: { code: 'mihomoSecret' } };
    if (!v.ok) return { ok: false, error: { code: 'httpStatus', params: { path: '/version', status: v.status } } };
    const ver = (await v.json()) as { version?: string };
    const latencyMs = Date.now() - t0;
    const c = await fetch(url + '/connections', { headers, signal: AbortSignal.timeout(5000) });
    if (!c.ok) return { ok: false, error: { code: 'httpStatus', params: { path: '/connections', status: c.status } } };
    const snap = (await c.json()) as MihomoSnapshot;
    return { ok: true, info: { kind: 'mihomo', version: ver.version ?? '?', conns: snap.connections?.length ?? 0, latencyMs } };
  } catch (e) {
    return { ok: false, error: toMsg(e) };
  }
}

export type TestResult =
  | { ok: true; info: Record<string, string | number | string[]> & { kind: string } }
  | { ok: false; error: Msg };
