#!/usr/bin/env ucode
// Traffic Earth rpcd plugin — read-only. https://github.com/traffic-earth/traffic-earth
// Exposes the conntrack table with both directions' byte counters, plus interface counters.

'use strict';

import { open } from 'fs';

const VERSION = 1;

function readlines(path) {
	let f = open(path, 'r');
	if (!f) return [];
	let out = [];
	for (let l = f.read('line'); length(l); l = f.read('line')) push(out, l);
	f.close();
	return out;
}

function readone(path) {
	let l = readlines(path);
	return length(l) ? trim(l[0]) : '';
}

// Addresses in /proc/net/nf_conntrack are fully expanded (four hex digits per group).
function is_private(a) {
	if (index(a, ':') >= 0) {
		let g = lc(substr(a, 0, 4));
		let c2 = substr(g, 0, 2);
		return g == '0000' || c2 == 'fc' || c2 == 'fd' || c2 == 'ff' ||
			(c2 == 'fe' && index('89ab', substr(g, 2, 1)) >= 0);
	}
	let p = split(a, '.');
	let x = +p[0], y = +p[1];
	return x == 10 || x == 127 || x == 0 || x >= 224 ||
		(x == 100 && y >= 64 && y <= 127) || (x == 169 && y == 254) ||
		(x == 172 && y >= 16 && y <= 31) || (x == 192 && y == 168) ||
		(x == 198 && (y == 18 || y == 19));
}

function conntrack() {
	let out = [];
	let f = open('/proc/net/nf_conntrack', 'r');
	if (!f) return out;
	for (let line = f.read('line'); length(line); line = f.read('line')) {
		let t = split(trim(line), /\s+/);
		let kv = { src: [], dst: [], sport: [], dport: [], bytes: [] };
		for (let i = 4; i < length(t); i++) {
			let e = index(t[i], '=');
			if (e < 0) continue;
			let k = substr(t[i], 0, e);
			if (kv[k] != null) push(kv[k], substr(t[i], e + 1));
		}
		if (length(kv.src) < 2 || length(kv.dst) < 2) continue;
		// Traffic that never leaves the LAN (or goes to a fake-ip) is not interesting.
		if (is_private(kv.src[0]) && is_private(kv.dst[0])) continue;
		push(out, [
			t[0] == 'ipv6' ? 6 : 4, t[2],
			kv.src[0], +(kv.sport[0] ?? 0), kv.dst[0], +(kv.dport[0] ?? 0),
			+(kv.bytes[0] ?? 0), +(kv.bytes[1] ?? 0),
			kv.src[1], +(kv.sport[1] ?? 0)
		]);
	}
	f.close();
	return out;
}

function netdev() {
	let out = {};
	let lines = readlines('/proc/net/dev');
	for (let i = 2; i < length(lines); i++) {
		let c = index(lines[i], ':');
		if (c < 0) continue;
		let name = trim(substr(lines[i], 0, c));
		let n = split(trim(substr(lines[i], c + 1)), /\s+/);
		out[name] = [+n[0], +n[8]];
	}
	return out;
}

function wan_devices() {
	let out = {};
	let r4 = readlines('/proc/net/route');
	for (let i = 1; i < length(r4); i++) {
		let t = split(trim(r4[i]), /\s+/);
		if (t[1] == '00000000' && t[7] == '00000000') out[t[0]] = true;
	}
	for (let l in readlines('/proc/net/ipv6_route')) {
		let t = split(trim(l), /\s+/);
		if (t[0] == '00000000000000000000000000000000' && t[1] == '00' && t[9] != 'lo') out[t[9]] = true;
	}
	return keys(out);
}

const methods = {
	info: {
		call: function() {
			return {
				version: VERSION,
				acct: readone('/proc/sys/net/netfilter/nf_conntrack_acct') == '1',
				count: +readone('/proc/sys/net/netfilter/nf_conntrack_count'),
				max: +readone('/proc/sys/net/netfilter/nf_conntrack_max'),
				hostname: readone('/proc/sys/kernel/hostname'),
				wan: wan_devices()
			};
		}
	},
	snapshot: {
		call: function() {
			return { version: VERSION, t: time(), conns: conntrack(), dev: netdev(), wan: wan_devices() };
		}
	}
};

return { 'traffic-earth': methods };
