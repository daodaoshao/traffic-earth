import { api, type SourceView, type TestResult } from './api';
import { field, langSwitch, locationForm, mihomoForm, openwrtForm, testText } from './forms';
import { lang, msgText, setLang, t } from './i18n';
import { copyText, h, mount, msg } from './ui';
import { GLOBE_STYLES } from './globe-styles';

interface SettingsView {
  sources: SourceView[];
  home: { lat: number; lon: number; name: string } | null;
  retention: { flowsDays: number; minuteDays: number; hourDays: number };
  flushIntervalSec: number;
  geoipAutoUpdate: boolean;
  display: { quality: string; rotateSpeed: number; globeStyle?: string };
  geo: { state: string; error?: string; builtAt?: string; attribution: string };
  uninstallScript: string;
}

const sections = ['sources', 'location', 'devices', 'display', 'data', 'access'] as const;

const statusText = (s: SourceView['status']) =>
  s.state === 'ok' ? t('st.ok') : s.state === 'connecting' ? t('st.connecting') : s.state === 'disabled' ? t('st.disabled') : `✕ ${msgText(s.error)}`;
const statusColor = (s: SourceView['status']) =>
  s.state === 'ok' ? 'var(--ok)' : s.state === 'error' ? 'var(--danger)' : 'var(--muted)';

export async function showSettings(root: HTMLElement, section: string) {
  if (!(sections as readonly string[]).includes(section)) section = 'sources';
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
          h('a.back', { href: '#/' }, t('nav.backGlobe')),
          sections.map((k) => h('a', { href: `#/settings/${k}`, class: k === section ? 'on' : '' }, t(`nav.${k}`))),
          h('div.nav-lang', null, langSwitch()),
        ),
        body,
      ),
    ),
  );
  const s = await api<SettingsView>('/api/settings');
  const render = { sources, location, devices, display, data, access }[section as (typeof sections)[number]];
  await render(body, s);
}

const reload = () => window.dispatchEvent(new HashChangeEvent('hashchange'));

function sources(body: HTMLElement, s: SettingsView) {
  const routers = s.sources.filter((x) => x.type === 'openwrt').map((x) => ({ id: x.id, name: x.name }));
  const editor = h('div');

  const card = (src: SourceView) => {
    const res = h('div');
    const test = h('button.btn.small', { type: 'button' }, t('common.test'));
    test.onclick = async () => {
      mount(res, msg('info', t('common.testing')));
      try {
        mount(res, testText(await api<TestResult>('/api/sources/test', { body: { type: src.type, url: src.url, id: src.id } })));
      } catch (e: any) {
        mount(res, msg('err', e.message));
      }
    };
    const toggle = h('button.btn.small', { type: 'button' }, src.enabled ? t('common.disable') : t('common.enable'));
    toggle.onclick = async () => {
      await api(`/api/sources/${src.id}`, { method: 'PUT', body: { url: src.url, name: src.name, enabled: !src.enabled } });
      reload();
    };
    const del = h('button.btn.small.danger', { type: 'button' }, t('common.delete'));
    del.onclick = async () => {
      if (!confirm(t('src.deleteConfirm', { name: src.name }))) return;
      await api(`/api/sources/${src.id}`, { method: 'DELETE' });
      reload();
    };
    const edit = h('button.btn.small', { type: 'button' }, t('common.edit'));
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
        linked ? h('span.tag', null, t('src.mergedInto', { name: linked.name })) : null,
        h('span.status', { style: { color: statusColor(src.status) } }, statusText(src.status)),
        test,
        edit,
        toggle,
        del,
      ),
      h('div.muted.mono.src-url', null, src.url, src.type === 'openwrt' ? `  ·  ${t('src.pollEvery', { n: src.pollSec })}` : ''),
      res,
    );
  };

  function openEditor(src: SourceView | null, type?: 'openwrt' | 'mihomo') {
    const kind = src?.type ?? type!;
    const err = h('div');
    const save = h('button.btn.primary', { type: 'button' }, t('common.save'));
    const cancel = h('button.btn', { type: 'button', onclick: () => mount(editor) }, t('common.cancel'));
    let get: () => any;
    let formEl: HTMLElement;
    if (kind === 'openwrt') {
      const f = openwrtForm({ name: src?.name, url: src?.url }, { requireCommand: !src });
      if (src) f.withExtra(() => (f.value.setupToken ? undefined : { id: src.id }));
      const poll = h('input', { type: 'number', min: '1', max: '30', value: String(src?.pollSec ?? 2) });
      const wan = h('input', { type: 'text', value: (src?.wan ?? []).join(', '), placeholder: t('ow.wanPh') });
      formEl = h('div', null, f.el, h('div.row', null, field(t('ow.poll'), poll, t('ow.pollHint')), field(t('ow.wan'), wan, t('ow.wanHint'))));
      get = () => ({ ...f.value, pollSec: Number(poll.value), wan: wan.value.split(/[,\s]+/).filter(Boolean) });
      if (!src) save.dataset.needToken = '1';
    } else {
      const f = mihomoForm({ name: src?.name, url: src?.url, linkTo: src?.linkTo, hasSecret: src?.hasSecret, id: src?.id }, routers);
      formEl = f.el;
      get = () => f.value;
    }
    save.onclick = async () => {
      const v = get();
      if (save.dataset.needToken && !v.setupToken) return mount(err, msg('err', t('setup.needCommand')));
      try {
        if (src) await api(`/api/sources/${src.id}`, { method: 'PUT', body: v });
        else await api('/api/sources', { body: v });
        reload();
      } catch (e: any) {
        mount(err, msg('err', e.message));
      }
    };
    const title = src ? t('src.editTitle', { name: src.name }) : kind === 'openwrt' ? t('src.addOwTitle') : t('src.addMiTitle');
    mount(editor, h('div.src', null, h('h2', { style: { marginTop: '0' } }, title), formEl, err, h('div.actions', null, save, cancel)));
    editor.scrollIntoView({ behavior: 'smooth' });
  }

  const uninstall = h('button.btn.small', { type: 'button' }, t('common.copy'));
  uninstall.onclick = () => copyText(s.uninstallScript).then(() => (uninstall.textContent = t('common.copied')));

  mount(
    body,
    h('h1', null, t('src.title')),
    h('p', null, t('src.desc')),
    s.sources.length ? s.sources.map(card) : msg('info', t('src.empty')),
    h(
      'div.actions',
      null,
      h('button.btn', { type: 'button', onclick: () => openEditor(null, 'openwrt') }, t('src.addOw')),
      h('button.btn', { type: 'button', onclick: () => openEditor(null, 'mihomo') }, t('src.addMi')),
    ),
    editor,
    h('details', { style: { marginTop: '24px' } }, h('summary', null, t('src.uninstall')), h('pre.code', null, s.uninstallScript), uninstall),
  );
}

function location(body: HTMLElement, s: SettingsView) {
  const f = locationForm(s.home);
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, t('common.save'));
  save.onclick = async () => {
    if (!f.valid) return mount(res, msg('err', t('setup.badCoords')));
    try {
      await api('/api/settings', { method: 'PUT', body: { home: f.value } });
      mount(res, msg('ok', t('common.saved')));
    } catch (e: any) {
      mount(res, msg('err', e.message));
    }
  };
  mount(body, h('h1', null, t('loc.title')), h('p', null, t('loc.desc')), f.el, res, h('div.actions', null, save));
}

async function devices(body: HTMLElement) {
  const list = await api<Array<{ key: string; name: string; icon: string; ips: string[]; autoName: string; lastSeen: number }>>('/api/devices');
  const timeFmt = (ts: number) => new Date(ts).toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-GB', { hour12: false });
  mount(
    body,
    h('h1', null, t('dev.title')),
    h('p', null, t('dev.desc')),
    list.length
      ? h(
          'table.t',
          null,
          h('tr', null, h('th', null, t('dev.icon')), h('th', null, t('dev.name')), h('th', null, t('dev.id')), h('th', null, t('dev.lastSeen')), h('th')),
          list.map((d) => {
            const icon = h('input', { type: 'text', value: d.icon, placeholder: '💻', style: { width: '52px' } });
            const name = h('input', { type: 'text', value: d.name !== d.autoName ? d.name : '', placeholder: d.autoName || t('hud.unknownDevice') });
            const ok = h('span.muted');
            const save = h('button.btn.small', { type: 'button' }, t('common.save'));
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
              h('td.muted', { style: { fontSize: '12px' } }, d.lastSeen ? timeFmt(d.lastSeen) : '—'),
              h('td', null, save, ok),
            );
          }),
        )
      : msg('info', t('dev.empty')),
  );
}

function display(body: HTMLElement, s: SettingsView) {
  const language = h(
    'select',
    null,
    (['zh', 'en'] as const).map((l) => h('option', { value: l, selected: lang === l }, t(`lang.${l}`))),
  );
  language.onchange = () => setLang(language.value as 'zh' | 'en');
  const q = h(
    'select',
    null,
    (['auto', 'high', 'medium', 'low'] as const).map((v) => h('option', { value: v, selected: s.display.quality === v }, t(`disp.q.${v}`))),
  );
  const rot = h('input', { type: 'number', step: '0.05', min: '0', max: '3', value: String(s.display.rotateSpeed) });
  const gs = h(
    'select',
    null,
    GLOBE_STYLES.map((v) => h('option', { value: v, selected: (s.display.globeStyle ?? 'dots') === v }, t(`style.${v}`))),
  );
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, t('common.save'));
  save.onclick = async () => {
    await api('/api/settings', { method: 'PUT', body: { display: { quality: q.value, rotateSpeed: Number(rot.value), globeStyle: gs.value } } });
    mount(res, msg('ok', t('disp.savedHint')));
  };
  mount(
    body,
    h('h1', null, t('disp.title')),
    field(t('lang.label'), language, t('disp.langHint')),
    h('p', { style: { marginTop: '22px' } }, t('disp.desc')),
    field(t('disp.style'), gs, t('disp.styleHint')),
    field(t('disp.quality'), q),
    field(t('disp.rotate'), rot, t('disp.rotateHint')),
    res,
    h('div.actions', null, save),
  );
}

function data(body: HTMLElement, s: SettingsView) {
  const fd = h('input', { type: 'number', min: '1', max: '90', value: String(s.retention.flowsDays) });
  const md = h('input', { type: 'number', min: '1', max: '90', value: String(s.retention.minuteDays) });
  const hd = h('input', { type: 'number', min: '1', max: '3650', value: String(s.retention.hourDays) });
  const fl = h('input', { type: 'number', min: '30', max: '3600', value: String(s.flushIntervalSec) });
  const au = h('input', { type: 'checkbox', checked: s.geoipAutoUpdate });
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, t('common.save'));
  save.onclick = async () => {
    await api('/api/settings', {
      method: 'PUT',
      body: { retention: { flowsDays: fd.value, minuteDays: md.value, hourDays: hd.value }, flushIntervalSec: fl.value, geoipAutoUpdate: au.checked },
    });
    mount(res, msg('ok', t('common.saved')));
  };
  const upd = h('button.btn.small', { type: 'button' }, t('data.geoNow'));
  upd.onclick = async () => {
    await api('/api/geoip/update', { body: {} });
    upd.textContent = t('data.geoStarted');
  };
  const geo = s.geo;
  const stateKey = `data.geo.${geo.state}`;
  mount(
    body,
    h('h1', null, t('data.title')),
    h('h2', null, t('data.retention')),
    h('div.row', null, field(t('data.flows'), fd), field(t('data.minute'), md), field(t('data.hour'), hd)),
    field(t('data.flush'), fl, t('data.flushHint')),
    h('h2', null, t('data.geo')),
    h('p', null, t('data.geoState', { state: t(stateKey) }), geo.builtAt ? t('data.geoVersion', { v: geo.builtAt.slice(0, 10) }) : ''),
    h('label.check', null, au, t('data.geoAuto')),
    h('div.actions', null, upd),
    h('small.muted', null, t('hud.attribution')),
    res,
    h('div.actions', null, save),
  );
}

function access(body: HTMLElement) {
  const old = h('input', { type: 'password', autocomplete: 'current-password' });
  const pw = h('input', { type: 'password', autocomplete: 'new-password' });
  const res = h('div');
  const save = h('button.btn.primary', { type: 'button' }, t('acc.change'));
  save.onclick = async () => {
    try {
      await api('/api/password', { body: { old: old.value, password: pw.value } });
      mount(res, msg('ok', t('acc.changed')));
    } catch (e: any) {
      mount(res, msg('err', e.message));
    }
  };
  const logout = h('button.btn.danger', { type: 'button' }, t('acc.logout'));
  logout.onclick = async () => {
    await api('/api/logout', { body: {} });
    window.location.hash = '#/login';
  };
  mount(
    body,
    h('h1', null, t('acc.title')),
    h('h2', null, t('acc.pw')),
    h('div.row', null, field(t('acc.old'), old), field(t('acc.new'), pw)),
    res,
    h('div.actions', null, save, logout),
    h('p', { style: { marginTop: '24px', fontSize: '12px' } }, t('acc.kiosk')),
  );
}
