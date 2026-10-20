import net from 'node:net';

/** Canonical form, so "240e:0324:...:0001" from /proc matches "240e:324::1" from ubus. */
export function normIp(ip: string): string {
  if (!ip.includes(':')) return ip;
  const m = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (m) return m[1];
  // Let the URL parser do the RFC 5952 compression.
  try {
    return new URL(`http://[${ip}]/`).hostname.slice(1, -1);
  } catch {
    return ip.toLowerCase();
  }
}

export function maskToPrefix(mask: string): number {
  if (/^\d+$/.test(mask)) return Number(mask);
  if (mask.includes(':')) {
    const full = normIp(mask);
    const groups = full.split('::');
    const left = groups[0] ? groups[0].split(':') : [];
    let bits = 0;
    for (const g of left) {
      let v = parseInt(g, 16);
      while (v & 0x8000) {
        bits++;
        v = (v << 1) & 0xffff;
      }
    }
    return bits;
  }
  return mask.split('.').reduce((n, o) => n + (Number(o) >>> 0).toString(2).replace(/0/g, '').length, 0);
}

export const ipFamily = (ip: string) => (net.isIP(ip) === 6 ? 'ipv6' : 'ipv4') as 'ipv4' | 'ipv6';
