import { api, type SourceView } from './api';
import { field, locationForm, mihomoForm, openwrtForm } from './forms';
import { copyText, h, mount, msg } from './ui';

interface SettingsView {
  sources: SourceView[];
  home: { lat: number; lon: number; name: string } | null;
  retention: { flowsDays: number; minuteDays: number; hourDays: number };
  flushIntervalSec: number;
  geoipAutoUpdate: boolean;
  display: { quality: string; rotateSpeed: number };
  geo: { state: string; error?: string; builtAt?: string; attribution: string };
  uninstallScript: string;
}

const sections: [string, string][] = [
  ['sources', '数据源'],
  ['location', '位置'],
  ['devices', '设备'],
  ['display', '显示'],
  ['data', '数据'],
  ['access', '访问'],
];

const statusText = (s: SourceView['status']) =>
  s.state === 'ok' ? '● 正常' : s.state === 'connecting' ? '◌ 连接中' : s.state === 'disabled' ? '○ 已停用' : `✕ ${s.error}`;
const statusColor = (s: SourceView['status']) =>
  s.state === 'ok' ? 'var(--ok)' : s.state === 'error' ? 'var(--danger)' : 'var(--muted)';

export async function showSettings(root: HTMLElement, section: string) {
  if (!sections.some(([k]) => k === section)) section = 'sources';
  const body = h('div.card');
  mount(
    root,
    h(
      'div.page',
      null,
      h(
        'div.settings',
        null,
        h(
          'nav',
          null,
          h('a.back', { href: '#/' }, '← 返回地球'),
          sections.map(([k, label]) => h('a', { href: `#/settings/${k}`, class: k === section ? 'on' : '' }, label)),
        ),
        body,
      ),
    ),
  );
  const s = await api<SettingsView>('/api/settings');
  const render = { sources, location, devices, display, data, access }[section as 'sources']!;
  await render(body, s);
}

async function reload() {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

function sources(body: HTMLElement, s: SettingsView) {
  const routers = s.sources.filter((x) => x.type === 'openwrt').map((x) => ({ id: x.id, name: x.name }));
  const editor = h('div');

  const card = (src: SourceView) => {
    const res = h('div');
    const test = h('button.btn.small', { type: 'button' }, '测试');
    test.onclick = async () => {
      mount(res, msg('info', '测试中…'));
      const r = await api('/api/sources/test', { body: { type: src.type, url: src.url, id: src.id } }).catch((e) => ({ ok: false, error: e.message }));
      mount(res, r.ok ? msg('ok', '✓ ' + r.summary) : msg('err', r.error));
    };
    const toggle = h('button.btn.small', { type: 'button' }, src.enabled ? '停用' : '启用');
    toggle.onclick = async () => {
      await api(`/api/sources/${src.id}`, { method: 'PUT', body: { url: src.url, name: src.name, enabled: !src.enabled } });
      reload();
    };
    const del = h('button.btn.small.danger', { type: 'button' }, '删除');
    del.onclick = async () => {
      if (!confirm(`删除数据源「${src.name}」？历史数据会保留。`)) return;
      await api(`/api/sources/${src.id}`, { method: 'DELETE' });
      reload();
    };
    const edit = h('button.btn.small', { type: 'button' }, '编辑');
    edit.onclick = () => openEditor(src);
    const linked = src.linkTo ? s.sources.find((x) => x.id === src.linkTo) : null;
    return h(
      'div.src',
      null,
      h(
        'div.head',
        null,
        h('b', null, src.name),
        h('span.tag', null, src.type === 'openwrt' ? 'OpenWrt' : 'mihomo'),
        linked ? h('span.tag', null, `合并到 ${linked.name}`) : null,
        h('span', { style: { color: statusColor(src.status), fontSize: '12px', flex: '1' } }, statusText(src.status)),
        test,
        edit,
        toggle,
        del,
      ),
      h('div.muted.mono', { style: { fontSize: '12px', marginTop: '4px' } }, src.url, src.type === 'openwrt' ? `  ·  每 ${src.pollSec}s 轮询` : ''),
      res,
    );
  };

  function openEditor(src: SourceView | null, type?: 'openwrt' | 'mihomo') {
    const t = src?.type ?? type!;
    const err = h('div');
    const save = h('button.btn.primary', { type: 'button' }, '保存');
    const cancel = h('button.btn', { type: 'button', onclick: () => mount(editor) }, '取消');
    let get: () => any;
    let formEl: HTMLElement;
    if (t === 'openwrt') {
      const f = openwrtForm({ name: src?.name, url: src?.url }, { requireCommand: !src });
      if (src) f.withExtra(() => (f.value.setupToken ? undefined : { id: src.id }));
      const poll = h('input', { type: 'number', min: '1', max: '30', value: String(src?.pollSec ?? 2) });
      const wan = h('input', { type: 'text', value: (src?.wan ?? []).join(', '), placeholder: '留空自动识别，例如 pppoe-wan' });
      formEl = h('div', null, f.el, h('div.row', null, field('轮询间隔（秒）', poll, '路由器忙时会自动放慢'), field('WAN 接口', wan, '用于总流量统计')));
      get = () => ({ ...f.value, pollSec: Number(poll.value), wan: wan.value.split(/[,\s]+/).filter(Boolean) });
      if (!src) save.dataset.needToken = '1';
    } else {
      const f = mihomoForm({ name: src?.name, url: src?.url, linkTo: src?.linkTo, hasSecret: src?.hasSecret, id: src?.id }, routers);
      formEl = f.el;
      get = () => f.value;
    }
    save.onclick = async () => {
      const v = get();
      if (save.dataset.needToken && !v.setupToken) return mount(err, msg('err', '请先生成配置命令并在路由器上执行'));
      try {
        if (src) await api(`/api/sources/${src.id}`, { method: 'PUT', body: v });
        else await api('/api/sources', { body: v });
        reload();
      } catch (e: any) {
        mount(err, msg('err', e.message));
      }
    };
    mount(editor, h('div.src', null, h('h2', { style: { marginTop: '0' } }, src ? `编辑：${src.name}` : t === 'openwrt' ? '添加 OpenWrt 路由器' : '添加 mihomo'), formEl, err, h('div.actions', null, save, cancel)));
    editor.scrollIntoView({ behavior: 'smooth' });
  }

  const uninstall = h('button.btn.small', { type: 'button' }, '复制');
  uninstall.onclick = () => copyText(s.uninstallScript).then(() => (uninstall.textContent = '已复制'));

  mount(
    body,
    h('h1', null, '数据源'),
    h('p', null, '从 OpenWrt 路由器读取连接，用 mihomo 补充域名和代理出口。'),
    s.sources.length ? s.sources.map(card) : msg('info', '还没有数据源'),
    h(
      'div.actions',
      null,
      h('button.btn', { type: 'button', onclick: () => openEditor(null, 'openwrt') }, '+ OpenWrt 路由器'),
      h('button.btn', { type: 'button', onclick: () => openEditor(null, 'mihomo') }, '+ mihomo'),
    ),
    editor,
    h('details', { style: { marginTop: '24px' } }, h('summary', null, '从路由器上移除流量地球的插件和账号'), h('pre.code', null, s.uninstallScript), uninstall),
  );
}

function location(body: HTMLElement, s: SettingsView) {
  const f = locationForm(s.home);
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, '保存');
  save.onclick = async () => {
    if (!f.valid) return mount(res, msg('err', '请填写有效的经纬度'));
    await api('/api/settings', { method: 'PUT', body: { home: f.value } });
    mount(res, msg('ok', '已保存'));
  };
  mount(body, h('h1', null, '位置'), h('p', null, '地球上所有飞线都从这里出发。'), f.el, res, h('div.actions', null, save));
}

async function devices(body: HTMLElement) {
  const list = await api<Array<{ key: string; name: string; icon: string; ips: string[]; autoName: string; lastSeen: number }>>('/api/devices');
  mount(
    body,
    h('h1', null, '设备'),
    h('p', null, '名称默认来自路由器的 DHCP 和主机名表，这里可以改成你认得出的名字。留空则恢复默认。'),
    list.length
      ? h(
          'table.t',
          null,
          h('tr', null, h('th', null, '图标'), h('th', null, '名称'), h('th', null, '标识 / 地址'), h('th', null, '最近活动'), h('th')),
          list.map((d) => {
            const icon = h('input', { type: 'text', value: d.icon, placeholder: '💻', style: { width: '52px' } });
            const name = h('input', { type: 'text', value: d.name !== d.autoName ? d.name : '', placeholder: d.autoName || '未命名' });
            const ok = h('span.muted');
            const save = h('button.btn.small', { type: 'button' }, '保存');
            save.onclick = async () => {
              await api(`/api/devices/${encodeURIComponent(d.key)}`, { method: 'PUT', body: { name: name.value, icon: icon.value } });
              ok.textContent = ' ✓';
            };
            return h(
              'tr',
              null,
              h('td', null, icon),
              h('td', null, name),
              h('td.mono', { style: { fontSize: '11px' } }, d.key, h('br'), h('span.muted', null, d.ips.slice(0, 3).join(' '))),
              h('td.muted', { style: { fontSize: '12px' } }, d.lastSeen ? new Date(d.lastSeen).toLocaleTimeString('zh-CN', { hour12: false }) : '—'),
              h('td', null, save, ok),
            );
          }),
        )
      : msg('info', '还没有发现设备，等数据源连上后再来看'),
  );
}

function display(body: HTMLElement, s: SettingsView) {
  const q = h(
    'select',
    null,
    [
      ['auto', '自动（帧率低时自动降档）'],
      ['high', '高'],
      ['medium', '中'],
      ['low', '低（适合老设备、挂墙小屏）'],
    ].map(([v, l]) => h('option', { value: v, selected: s.display.quality === v }, l)),
  );
  const rot = h('input', { type: 'number', step: '0.05', min: '0', max: '3', value: String(s.display.rotateSpeed) });
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, '保存');
  save.onclick = async () => {
    await api('/api/settings', { method: 'PUT', body: { display: { quality: q.value, rotateSpeed: Number(rot.value) } } });
    mount(res, msg('ok', '已保存，回到地球页面后生效'));
  };
  mount(body, h('h1', null, '显示'), h('p', null, '画面在浏览器里渲染，吃的是看的那台设备的显卡。'), field('画质', q), field('自转速度', rot, '0 为不转'), res, h('div.actions', null, save));
}

function data(body: HTMLElement, s: SettingsView) {
  const fd = h('input', { type: 'number', min: '1', max: '90', value: String(s.retention.flowsDays) });
  const md = h('input', { type: 'number', min: '1', max: '90', value: String(s.retention.minuteDays) });
  const hd = h('input', { type: 'number', min: '1', max: '3650', value: String(s.retention.hourDays) });
  const fl = h('input', { type: 'number', min: '30', max: '3600', value: String(s.flushIntervalSec) });
  const au = h('input', { type: 'checkbox', checked: s.geoipAutoUpdate });
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, '保存');
  save.onclick = async () => {
    await api('/api/settings', {
      method: 'PUT',
      body: { retention: { flowsDays: fd.value, minuteDays: md.value, hourDays: hd.value }, flushIntervalSec: fl.value, geoipAutoUpdate: au.checked },
    });
    mount(res, msg('ok', '已保存'));
  };
  const upd = h('button.btn.small', { type: 'button' }, '立即更新');
  upd.onclick = async () => {
    await api('/api/geoip/update', { body: {} });
    upd.textContent = '已开始，几分钟后刷新查看';
  };
  const geo = s.geo;
  mount(
    body,
    h('h1', null, '数据'),
    h('h2', null, '保留时长（天）'),
    h('div.row', null, field('连接明细', fd), field('分钟统计', md), field('小时统计', hd)),
    field('写盘间隔（秒）', fl, '数据先在内存里攒着，定期批量写入，保护 SD 卡 / eMMC'),
    h('h2', null, 'IP 地理库'),
    h(
      'p',
      null,
      `状态：${{ ready: '可用', downloading: '下载中', missing: '未下载', error: '出错' }[geo.state] ?? geo.state}`,
      geo.builtAt ? `，版本 ${geo.builtAt.slice(0, 10)}` : '',
      geo.error ? `（${geo.error}）` : '',
    ),
    h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center' } }, au, '每月自动更新'),
    h('div.actions', null, upd),
    h('small.muted', null, geo.attribution),
    res,
    h('div.actions', null, save),
  );
}

function access(body: HTMLElement) {
  const old = h('input', { type: 'password', autocomplete: 'current-password' });
  const pw = h('input', { type: 'password', autocomplete: 'new-password' });
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, '修改密码');
  save.onclick = async () => {
    try {
      await api('/api/password', { body: { old: old.value, password: pw.value } });
      mount(res, msg('ok', '已修改，其他设备需要重新登录'));
    } catch (e: any) {
      mount(res, msg('err', e.message));
    }
  };
  const logout = h('button.btn.danger', { type: 'button' }, '退出登录');
  logout.onclick = async () => {
    await api('/api/logout', { body: {} });
    window.location.hash = '#/login';
  };
  mount(
    body,
    h('h1', null, '访问'),
    h('h2', null, '管理员密码'),
    h('div.row', null, field('原密码', old), field('新密码（至少 8 位）', pw)),
    res,
    h('div.actions', null, save, logout),
    h('p', { style: { marginTop: '24px', fontSize: '12px' } }, '只读展示链接（给挂墙大屏用，免登录）将在下个版本提供。'),
  );
}

