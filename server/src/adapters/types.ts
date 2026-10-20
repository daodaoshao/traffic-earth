import type { EventEmitter } from 'node:events';

/** A connection as every adapter reports it. Byte counters are cumulative. */
export interface FlowConn {
  id: string;
  /** Local side: LAN device address, or 'router' for the router's own traffic. */
  device: string;
  /** Local port on the device (used to match the same connection across sources). */
  sport: number;
  remote: string;
  rport: number;
  host: string;
  net: string;
  chain: string;
  rule: string;
  /** Bytes leaving home / arriving home. */
  up: number;
  down: number;
  start: number;
  inbound: boolean;
}

export interface Snapshot {
  t: number;
  conns: FlowConn[];
  /** Cumulative interface or core counters, for the headline rate. */
  totals: { up: number; down: number } | null;
}

export interface HostEntry {
  key: string; // MAC when known, otherwise the IP
  name: string;
  ips: string[];
}

export type SourceStatus =
  | { state: 'connecting' }
  | { state: 'ok'; since: number; detail?: string }
  | { state: 'error'; error: string; retryAt: number }
  | { state: 'disabled' };

/**
 * Events: 'snapshot' (Snapshot), 'status' (SourceStatus), 'hosts' (HostEntry[]).
 */
export interface Adapter extends EventEmitter {
  status: SourceStatus;
  start(): void;
  stop(): void;
}
