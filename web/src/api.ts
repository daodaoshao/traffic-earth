export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? (opts.body !== undefined ? 'POST' : 'GET'),
    headers: opts.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/login' && path !== '/api/password') {
    location.hash = '#/login';
  }
  if (!res.ok) throw new ApiError(res.status, data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export interface Category {
  id: string;
  name: string;
  nameEn: string;
  color: string;
}

export interface Meta {
  categories: Category[];
  home: { lat: number; lon: number; name: string } | null;
  display: { quality: 'auto' | 'high' | 'medium' | 'low'; rotateSpeed: number };
  geo: { state: string; error?: string; attribution: string };
}

export type SourceStatus =
  | { state: 'connecting' }
  | { state: 'ok'; since: number }
  | { state: 'error'; error: string; retryAt: number }
  | { state: 'disabled' };

export interface Row {
  s: string;
  d: string;
  h: string;
  p: string;
  c: string;
  x: string;
  i: 0 | 1;
  u: number;
  w: number;
  n: number;
  o?: string;
}

export interface Point {
  lat: number;
  lon: number;
  cc: string;
  country: string;
  city: string;
}

export interface Frame {
  t: number;
  total: { up: number; down: number; conns: number };
  sources: { id: string; name: string; type: string; status: SourceStatus }[];
  rows: Row[];
  points: Record<string, Point>;
  devices: Record<string, { name: string; icon: string }>;
  today: {
    day: string;
    up: number;
    down: number;
    cats: Record<string, [number, number]>;
    devs: Record<string, [number, number]>;
  };
}

export interface SourceView {
  id: string;
  name: string;
  type: 'openwrt' | 'mihomo';
  url: string;
  username: string;
  enabled: boolean;
  pollSec: number;
  wan: string[];
  linkTo: string;
  hasSecret: boolean;
  status: SourceStatus;
}
