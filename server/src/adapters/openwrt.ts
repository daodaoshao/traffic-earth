import { EventEmitter } from 'node:events';
import net from 'node:net';
import { isPrivateIp } from '../geo.js';
import { ipFamily, maskToPrefix, normIp } from '../ip.js';
import { AppError, toMsg } from '../msg.js';
import type { TestResult } from './mihomo.js';
import type { Adapter, FlowConn, HostEntry, Snapshot, SourceStatus } from './types.js';

/**
 * OpenWrt via rpcd JSON-RPC (/ubus). Needs the read-only "traffic-earth" rpcd plugin and login
 * that the setup script installs; device names come from LuCI's own luci-rpc methods.
 */

type RawConn = [4 | 6, string, string, number, string, number, number, number, string, number];

interface RawSnapshot {
  version: number;
  t: number;
  conns: RawConn[];
  dev: Record<string, [number, number]>;
  wan: string[];
}

interface NetDev {
  devtype?: string;
  ipaddrs?: { address: string; netmask: string }[];
  ip6addrs?: { address: string; netmask: string }[];
}

const NULL_SESSION = '00000000000000000000000000000000';

export class UbusClient {
  private sid = NULL_SESSION;
  constructor(
    private url: string,
    private username: string,
    private password: string,
  ) {}

  private async rpc(params: unknown[], timeoutMs = 8000): Promise<any> {
    const res = await fetch(this.url + '/ubus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'call', params }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new AppError('httpStatus', { path: '/ubus', status: res.status });
    const j = (await res.json()) as { result?: [number, any]; error?: { code: number; message: string } };
    if (j.error) {
      const e = new Error(j.error.message) as Error & { code?: number };
      e.code = j.error.code;
      throw e;
    }
    const [code, data] = j.result ?? [9, null];
    if (code !== 0) {
      const e = new AppError('ubus', { code }) as AppError & { ubus?: number };
      e.ubus = code;
      throw e;
    }
    return data;
  }

  async login() {
    try {
      const d = await this.rpc([NULL_SESSION, 'session', 'login', { username: this.username, password: this.password, timeout: 3600 }]);
      this.sid = d.ubus_rpc_session;
    } catch (e: any) {
      if (e.ubus === 6) throw new AppError('owLogin');
      throw e;
    }
  }

  /** Calls a method, logging in again once if the session has expired. */
  async call(object: string, method: string, args: object = {}, timeoutMs?: number): Promise<any> {
    if (this.sid === NULL_SESSION) await this.login();
    try {
      return await this.rpc([this.sid, object, method, args], timeoutMs);
    } catch (e: any) {
      if (e.code === -32002 || e.ubus === 6) {
        await this.login();
        return this.rpc([this.sid, object, method, args], timeoutMs);
      }
      throw e;
    }
  }
}


export class OpenWrtAdapter extends EventEmitter implements Adapter {
  status: SourceStatus = { state: 'connecting' };
  private ubus: UbusClient;
  private timer: NodeJS.Timeout | null = null;
  private stopped = false;
  private failures = 0;
  private lastHosts = 0;
  private routerAddrs = new Set<string>();
  private lanNets = new net.BlockList();
  private devTypes: Record<string, string> = {};
  private firstSeen = new Map<string, number>();

  constructor(
    url: string,
    username: string,
    password: string,
    private opts: { pollSec: number; wan: string[] },
  ) {
    super();
    this.ubus = new UbusClient(url, username, password);
  }

  start() {
    this.stopped = false;
    this.schedule(0);
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private schedule(ms: number) {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), ms);
  }

  private setStatus(s: SourceStatus) {
    this.status = s;
    this.emit('status', s);
  }

  private async tick() {
    const t0 = Date.now();
    try {
      if (t0 - this.lastHosts > 60_000) await this.refreshHosts();
      const raw = (await this.ubus.call('traffic-earth', 'snapshot', {}, 15_000)) as RawSnapshot;
      const snap = this.normalize(raw);
      if (this.status.state !== 'ok') this.setStatus({ state: 'ok', since: Date.now() });
      this.failures = 0;
      this.emit('snapshot', snap);
      // Busy routers get polled less often: never spend more than ~25% of the time in the call.
      const took = Date.now() - t0;
      this.schedule(Math.max(this.opts.pollSec * 1000, took * 4) - took);
    } catch (e) {
      this.failures++;
      const wait = Math.min(1000 * 2 ** this.failures, 30_000);
      this.setStatus({ state: 'error', error: toMsg(e), retryAt: Date.now() + wait });
      this.schedule(wait);
    }
  }

  private async refreshHosts() {
    const [hints, leases, devs] = await Promise.all([
      this.ubus.call('luci-rpc', 'getHostHints').catch(() => ({})),
      this.ubus.call('luci-rpc', 'getDHCPLeases').catch(() => ({})),
      this.ubus.call('luci-rpc', 'getNetworkDevices').catch(() => ({})),
    ]);
    this.lastHosts = Date.now();

    const addrs = new Set<string>();
    const nets = new net.BlockList();
    const types: Record<string, string> = {};
    for (const [name, d] of Object.entries(devs as Record<string, NetDev>)) {
      types[name] = d.devtype ?? '';
      for (const a of [...(d.ipaddrs ?? []), ...(d.ip6addrs ?? [])]) {
        const ip = normIp(a.address);
        addrs.add(ip);
        // Global IPv6 prefixes on LAN-side interfaces mark "our" addresses (no NAT on v6).
        if (ipFamily(ip) === 'ipv6' && !ip.startsWith('fe80') && !this.isWanDev(name)) {
          const p = maskToPrefix(a.netmask);
          if (p >= 32 && p < 128) {
            try {
              nets.addSubnet(ip, p, 'ipv6');
            } catch {
              /* ignore */
            }
          }
        }
      }
    }
    this.routerAddrs = addrs;
    this.lanNets = nets;
    this.devTypes = types;

    const byMac = new Map<string, HostEntry>();
    for (const [mac, h] of Object.entries(hints as Record<string, { name?: string; ipaddrs?: string[]; ip6addrs?: string[] }>)) {
      byMac.set(mac.toUpperCase(), {
        key: mac.toUpperCase(),
        name: h.name ?? '',
        ips: [...(h.ipaddrs ?? []), ...(h.ip6addrs ?? [])].map(normIp).filter((ip) => !ip.startsWith('fe80')),
      });
    }
    for (const l of (leases as { dhcp_leases?: { hostname?: string; macaddr: string; ipaddr: string }[] }).dhcp_leases ?? []) {
      const mac = l.macaddr.toUpperCase();
      const e = byMac.get(mac) ?? { key: mac, name: '', ips: [] };
      if (!e.name && l.hostname) e.name = l.hostname;
      if (l.ipaddr && !e.ips.includes(l.ipaddr)) e.ips.push(l.ipaddr);
      byMac.set(mac, e);
    }
    this.emit('hosts', [...byMac.values()].filter((h) => h.ips.length));
  }

  private wanSet: string[] = [];
  private isWanDev(name: string) {
    return this.wanSet.includes(name);
  }

  private isLocal(ip: string) {
    return isPrivateIp(ip) || this.routerAddrs.has(ip) || (ipFamily(ip) === 'ipv6' && this.lanNets.check(ip, 'ipv6'));
  }

  private normalize(raw: RawSnapshot): Snapshot {
    // Physical WAN: default-route devices that aren't proxy tunnels, unless the user picked them.
    const wan = this.opts.wan.length
      ? this.opts.wan
      : raw.wan.filter((d) => !['tun', 'wireguard', 'tailscale'].includes(this.devTypes[d] ?? '') && !/^(tun|utun|wg|nikki|mihomo|clash|Meta)/i.test(d));
    // Host refresh ran before we knew the WAN; redo it so WAN prefixes aren't counted as LAN.
    if (!this.wanSet.length && wan.length) this.lastHosts = 0;
    this.wanSet = wan;
    let rx = 0;
    let tx = 0;
    for (const d of wan) {
      rx += raw.dev[d]?.[0] ?? 0;
      tx += raw.dev[d]?.[1] ?? 0;
    }

    const now = Date.now();
    const conns: FlowConn[] = [];
    const live = new Set<string>();
    for (const [l3, proto, osrc0, osport, odst0, odport, ob, rb, rsrc0, rsport] of raw.conns) {
      const osrc = normIp(osrc0);
      const odst = normIp(odst0);
      const rsrc = normIp(rsrc0);
      const id = `${l3}|${proto}|${osrc}|${osport}|${odst}|${odport}`;
      live.add(id);
      let start = this.firstSeen.get(id);
      if (!start) this.firstSeen.set(id, (start = now));

      const srcLocal = this.isLocal(osrc);
      if (srcLocal && this.isLocal(odst)) continue;
      const base = { id, host: '', net: proto, chain: 'DIRECT', rule: '', start };
      if (srcLocal) {
        conns.push({
          ...base,
          device: this.routerAddrs.has(osrc) ? 'router' : osrc,
          sport: osport,
          remote: odst,
          rport: odport,
          up: ob,
          down: rb,
          inbound: false,
          // Replies come from the router itself, not the destination: a local proxy owns it.
          proxied: rsrc !== odst && this.routerAddrs.has(rsrc),
        });
      } else {
        // Someone outside opened this. After DNAT the reply comes from the real LAN host.
        const target = this.isLocal(rsrc) && !this.routerAddrs.has(rsrc) ? rsrc : odst;
        conns.push({
          ...base,
          device: this.routerAddrs.has(target) ? 'router' : target,
          sport: target === rsrc ? rsport : odport,
          remote: osrc,
          rport: osport,
          up: rb,
          down: ob,
          inbound: true,
        });
      }
    }
    for (const id of this.firstSeen.keys()) if (!live.has(id)) this.firstSeen.delete(id);
    return { t: raw.t * 1000, conns, totals: wan.length ? { up: tx, down: rx } : null };
  }
}

export async function testOpenWrt(url: string, username: string, password: string): Promise<TestResult> {
  const c = new UbusClient(url, username, password);
  try {
    await c.login();
    const info = await c.call('traffic-earth', 'info').catch((e: any) => {
      if (e.ubus === 3 || e.ubus === 4 || e.ubus === 6) throw new AppError('owPlugin');
      throw e;
    });
    if (!info.acct) return { ok: false, error: { code: 'owAcct' } };
    return { ok: true, info: { kind: 'openwrt', host: info.hostname, count: info.count, max: info.max, wan: info.wan } };
  } catch (e) {
    return { ok: false, error: toMsg(e) };
  }
}
