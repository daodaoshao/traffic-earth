import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomToken } from './crypto.js';
import { md5crypt } from './md5crypt.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const plugin = fs.readFileSync(path.join(here, '../assets/openwrt/traffic-earth.uc'), 'utf8');

export const RPC_USER = 'traffic-earth';

const acl = JSON.stringify(
  {
    'traffic-earth': {
      description: 'Traffic Earth: read-only access to connection and host lists',
      read: {
        ubus: {
          'traffic-earth': ['info', 'snapshot'],
          'luci-rpc': ['getHostHints', 'getDHCPLeases', 'getNetworkDevices'],
        },
      },
    },
  },
  null,
  '\t',
);

/** Pending setups: the browser gets a token, the router fetches the script with it. */
const pending = new Map<string, { password: string; expires: number }>();

export function prepareSetup() {
  for (const [k, v] of pending) if (v.expires < Date.now()) pending.delete(k);
  const token = randomToken(18);
  const password = randomToken(24);
  pending.set(token, { password, expires: Date.now() + 3600e3 });
  return { token, password, script: setupScript(password) };
}

export const pendingPassword = (token: string) => {
  const p = pending.get(token);
  return p && p.expires > Date.now() ? p.password : undefined;
};

export function setupScript(password: string): string {
  const hash = md5crypt(password);
  return `#!/bin/sh
# Traffic Earth — OpenWrt setup (read-only).
# Installs an rpcd plugin that lists connections, and a login that can only call it
# and LuCI's host lists. Undo with the uninstall command shown in Traffic Earth.
set -e
if ! command -v ucode >/dev/null 2>&1 || [ ! -e /usr/lib/rpcd/ucode.so ]; then
	echo "Traffic Earth: 需要 OpenWrt 23.05 或更新版本（缺少 ucode / rpcd-mod-ucode）" >&2
	exit 1
fi
mkdir -p /usr/share/rpcd/ucode /usr/share/rpcd/acl.d
cat > /usr/share/rpcd/ucode/traffic-earth.uc <<'TRAFFIC_EARTH_EOF'
${plugin.trimEnd()}
TRAFFIC_EARTH_EOF
cat > /usr/share/rpcd/acl.d/traffic-earth.json <<'TRAFFIC_EARTH_EOF'
${acl}
TRAFFIC_EARTH_EOF
uci -q delete rpcd.traffic_earth || true
uci set rpcd.traffic_earth=login
uci set rpcd.traffic_earth.username='${RPC_USER}'
uci set rpcd.traffic_earth.password='${hash}'
uci add_list rpcd.traffic_earth.read='traffic-earth'
uci commit rpcd
if [ "$(cat /proc/sys/net/netfilter/nf_conntrack_acct 2>/dev/null)" != "1" ]; then
	echo "net.netfilter.nf_conntrack_acct=1" > /etc/sysctl.d/12-traffic-earth.conf
	sysctl -q -w net.netfilter.nf_conntrack_acct=1
	echo "Traffic Earth: 已开启 conntrack 字节计数"
fi
/etc/init.d/rpcd restart
echo "Traffic Earth: 配置完成，回到网页点「测试连接」"
`;
}

export const uninstallScript = `uci -q delete rpcd.traffic_earth; uci commit rpcd; rm -f /usr/share/rpcd/ucode/traffic-earth.uc /usr/share/rpcd/acl.d/traffic-earth.json /etc/sysctl.d/12-traffic-earth.conf; /etc/init.d/rpcd restart`;
