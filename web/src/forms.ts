import { api } from './api';
import { cities } from './cities';
import { copyText, h, mount, msg } from './ui';

export const field = (label: string, input: HTMLElement, hint?: string) =>
  h('label.field', null, h('span', null, label), input, hint ? h('small.muted', null, hint) : null);

function codeBlock(text: string) {
  const btn = h('button.btn.small', { type: 'button' }, '复制');
  btn.onclick = () => copyText(text).then(() => ((btn.textContent = '已复制'), setTimeout(() => (btn.textContent = '复制'), 1500)));
  return h('div', null, h('pre.code', null, text), btn);
}

/**
 * OpenWrt onboarding: address → generated one-time setup command → test.
 * Returns the element and a getter for what to save.
 */
export function openwrtForm(init: { name?: string; url?: string } = {}, opts: { requireCommand: boolean } = { requireCommand: true }) {
  const name = h('input', { type: 'text', value: init.name ?? '', placeholder: '例如：主路由' });
  const url = h('input', { type: 'text', value: init.url ?? 'http://192.168.1.1', placeholder: 'http://192.168.1.1' });
  const cmdBox = h('div');
  const result = h('div');
  let token = '';

  const gen = h('button.btn', { type: 'button' }, opts.requireCommand ? '生成配置命令' : '重新生成配置命令（会更换密码）');
  gen.onclick = async () => {
    gen.disabled = true;
    try {
      const r = await api<{ token: string; oneLiner: string; script: string; uninstall: string }>('/api/openwrt/prepare', { body: {} });
      token = r.token;
      const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
      mount(
        cmdBox,
        h('p', null, 'SSH 登录路由器（或用 LuCI 的「系统 → 终端」），执行下面这一行：'),
        local ? msg('info', '你现在是通过 localhost 打开的页面，路由器访问不到这个地址。请改用下面的「完整脚本」。') : null,
        codeBlock(r.oneLiner),
        h('details', null, h('summary', null, '路由器访问不到这台服务器？展开完整脚本，直接粘贴执行'), codeBlock(r.script)),
        h(
          'p',
          { style: { fontSize: '12px' } },
          '它只做三件事：放一个只读的 rpcd 插件、建一个只能调用该插件的登录账号、重启 rpcd（LuCI 需要重新登录，不影响上网）。命令 1 小时内有效。',
        ),
      );
    } catch (e: any) {
      mount(cmdBox, msg('err', e.message));
    } finally {
      gen.disabled = false;
    }
  };

  const test = h('button.btn', { type: 'button' }, '测试连接');
  test.onclick = async () => {
    test.disabled = true;
    mount(result, msg('info', '测试中…'));
    try {
      const r = await api('/api/sources/test', { body: { type: 'openwrt', url: url.value, setupToken: token || undefined, ...(extra() ?? {}) } });
      mount(result, r.ok ? msg('ok', '✓ ' + r.summary) : msg('err', r.error));
      lastOk = !!r.ok;
    } catch (e: any) {
      mount(result, msg('err', e.message));
    } finally {
      test.disabled = false;
    }
  };
  let lastOk = false;
  let extra: () => object | undefined = () => undefined;

  const el = h(
    'div',
    null,
    h('div.row', null, field('名称', name), field('路由器地址（LuCI 所在地址）', url)),
    h('div.actions', null, gen),
    cmdBox,
    h('div.actions', null, test),
    result,
  );
  return {
    el,
    get value() {
      return { type: 'openwrt' as const, name: name.value, url: url.value, ...(token ? { setupToken: token } : {}) };
    },
    get tested() {
      return lastOk;
    },
    get url() {
      return url.value;
    },
    withExtra(fn: () => object | undefined) {
      extra = fn;
    },
  };
}

export function mihomoForm(init: { name?: string; url?: string; linkTo?: string; hasSecret?: boolean; id?: string } = {}, routers: { id: string; name: string }[] = []) {
  const name = h('input', { type: 'text', value: init.name ?? '', placeholder: '例如：路由器 mihomo' });
  const url = h('input', { type: 'text', value: init.url ?? '', placeholder: 'http://192.168.1.1:9090' });
  const secret = h('input', { type: 'password', placeholder: init.hasSecret ? '留空则不修改' : 'external-controller 的 secret' });
  const link = h(
    'select',
    null,
    h('option', { value: '' }, '不合并（独立的 mihomo，比如电脑上的客户端）'),
    routers.map((r) => h('option', { value: r.id, selected: r.id === init.linkTo }, `运行在 ${r.name} 上`)),
  );
  const result = h('div');
  const test = h('button.btn', { type: 'button' }, '测试连接');
  test.onclick = async () => {
    test.disabled = true;
    mount(result, msg('info', '测试中…'));
    try {
      const body: any = { type: 'mihomo', url: url.value, id: init.id };
      if (secret.value || !init.hasSecret) body.secret = secret.value;
      const r = await api('/api/sources/test', { body });
      mount(result, r.ok ? msg('ok', '✓ ' + r.summary) : msg('err', r.error));
    } catch (e: any) {
      mount(result, msg('err', e.message));
    } finally {
      test.disabled = false;
    }
  };
  const el = h(
    'div',
    null,
    h('div.row', null, field('名称', name), field('控制器地址', url, 'mihomo 配置里的 external-controller，必须监听在局域网地址上，不能是 127.0.0.1')),
    field('Secret', secret),
    routers.length ? field('与路由器合并', link, '合并后：域名、出口节点来自 mihomo；外部访问来自路由器；同一条连接不会重复计算') : null,
    h('div.actions', null, test),
    result,
  );
  return {
    el,
    setUrl(v: string) {
      if (!url.value) url.value = v;
    },
    get value() {
      const v: any = { type: 'mihomo', name: name.value, url: url.value, linkTo: link.value };
      if (secret.value || !init.hasSecret) v.secret = secret.value;
      return v;
    },
  };
}

export function locationForm(init: { lat: number; lon: number; name: string } | null) {
  const name = h('input', { type: 'text', value: init?.name ?? '' , placeholder: '家' });
  const lat = h('input', { type: 'number', step: '0.0001', value: init ? String(init.lat) : '' });
  const lon = h('input', { type: 'number', step: '0.0001', value: init ? String(init.lon) : '' });
  const pick = h(
    'select',
    null,
    h('option', { value: '' }, '— 选择城市快速填入 —'),
    cities.map(([n, a, b], i) => h('option', { value: String(i), selected: init?.name === n }, n)),
  );
  pick.onchange = () => {
    const c = cities[Number(pick.value)];
    if (!c) return;
    name.value = c[0];
    lat.value = String(c[1]);
    lon.value = String(c[2]);
  };
  const el = h(
    'div',
    null,
    field('常用城市', pick),
    h('div.row', null, field('显示名称', name), field('纬度', lat), field('经度', lon)),
    h('small.muted', null, '只用于在地球上画出「家」的位置，城市级精度就够了。'),
  );
  return {
    el,
    get value() {
      return { name: name.value || '家', lat: Number(lat.value), lon: Number(lon.value) };
    },
    get valid() {
      return lat.value !== '' && lon.value !== '' && Math.abs(Number(lat.value)) <= 90 && Math.abs(Number(lon.value)) <= 180;
    },
  };
}
