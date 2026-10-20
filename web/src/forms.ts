import { api, type TestResult } from './api';
import { cities } from './cities';
import { lang, msgText, t } from './i18n';
import { copyText, h, mount, msg } from './ui';

export const field = (label: string, input: HTMLElement, hint?: string) =>
  h('label.field', null, h('span', null, label), input, hint ? h('small.muted', null, hint) : null);

export function testText(r: TestResult) {
  if (!r.ok) return msg('err', msgText(r.error));
  const i = r.info;
  return msg(
    'ok',
    '✓ ' + (i.kind === 'mihomo' ? t('test.mihomo', i) : t('test.openwrt', { ...i, wan: i.wan.join(', ') || t('test.wanUnknown') })),
  );
}

function codeBlock(text: string) {
  const btn = h('button.btn.small', { type: 'button' }, t('common.copy'));
  btn.onclick = () =>
    copyText(text).then(() => {
      btn.textContent = t('common.copied');
      setTimeout(() => (btn.textContent = t('common.copy')), 1500);
    });
  return h('div', null, h('pre.code', null, text), btn);
}

/**
 * OpenWrt onboarding: address → generated one-time setup command → test.
 */
export function openwrtForm(init: { name?: string; url?: string } = {}, opts: { requireCommand: boolean } = { requireCommand: true }) {
  const name = h('input', { type: 'text', value: init.name ?? '', placeholder: t('ow.namePh') });
  const url = h('input', { type: 'text', value: init.url ?? 'http://192.168.1.1', placeholder: 'http://192.168.1.1' });
  const cmdBox = h('div');
  const result = h('div');
  let token = '';
  let lastOk = false;
  let extra: () => object | undefined = () => undefined;

  const gen = h('button.btn', { type: 'button' }, opts.requireCommand ? t('ow.gen') : t('ow.regen'));
  gen.onclick = async () => {
    gen.disabled = true;
    try {
      const r = await api<{ token: string; oneLiner: string; script: string }>('/api/openwrt/prepare', { body: { lang } });
      token = r.token;
      const local = /^(localhost|127\.|\[::1\])/.test(location.hostname);
      mount(
        cmdBox,
        h('p', null, t('ow.run')),
        local ? msg('info', t('ow.localhost')) : null,
        codeBlock(r.oneLiner),
        h('details', null, h('summary', null, t('ow.fullScript')), codeBlock(r.script)),
        h('p', { style: { fontSize: '12px' } }, t('ow.explain')),
      );
    } catch (e: any) {
      mount(cmdBox, msg('err', e.message));
    } finally {
      gen.disabled = false;
    }
  };

  const test = h('button.btn', { type: 'button' }, t('common.testConn'));
  test.onclick = async () => {
    test.disabled = true;
    mount(result, msg('info', t('common.testing')));
    try {
      const r = await api<TestResult>('/api/sources/test', { body: { type: 'openwrt', url: url.value, setupToken: token || undefined, ...(extra() ?? {}) } });
      mount(result, testText(r));
      lastOk = r.ok;
    } catch (e: any) {
      mount(result, msg('err', e.message));
    } finally {
      test.disabled = false;
    }
  };

  const el = h(
    'div',
    null,
    h('div.row', null, field(t('ow.name'), name), field(t('ow.url'), url)),
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
  const name = h('input', { type: 'text', value: init.name ?? '', placeholder: t('mi.namePh') });
  const url = h('input', { type: 'text', value: init.url ?? '', placeholder: 'http://192.168.1.1:9090' });
  const secret = h('input', { type: 'password', placeholder: init.hasSecret ? t('mi.secretKeep') : t('mi.secretPh') });
  const link = h(
    'select',
    null,
    h('option', { value: '' }, t('mi.linkNone')),
    routers.map((r) => h('option', { value: r.id, selected: r.id === init.linkTo }, t('mi.linkOn', { name: r.name }))),
  );
  const result = h('div');
  const test = h('button.btn', { type: 'button' }, t('common.testConn'));
  test.onclick = async () => {
    test.disabled = true;
    mount(result, msg('info', t('common.testing')));
    try {
      const body: any = { type: 'mihomo', url: url.value, id: init.id };
      if (secret.value || !init.hasSecret) body.secret = secret.value;
      mount(result, testText(await api<TestResult>('/api/sources/test', { body })));
    } catch (e: any) {
      mount(result, msg('err', e.message));
    } finally {
      test.disabled = false;
    }
  };
  const el = h(
    'div',
    null,
    h('div.row', null, field(t('mi.name'), name), field(t('mi.url'), url, t('mi.urlHint'))),
    field(t('mi.secret'), secret),
    routers.length ? field(t('mi.link'), link, t('mi.linkHint')) : null,
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
  const name = h('input', { type: 'text', value: init?.name ?? '', placeholder: t('loc.namePh') });
  const lat = h('input', { type: 'number', step: '0.0001', value: init && Number.isFinite(init.lat) ? String(init.lat) : '' });
  const lon = h('input', { type: 'number', step: '0.0001', value: init && Number.isFinite(init.lon) ? String(init.lon) : '' });
  const pick = h(
    'select',
    null,
    h('option', { value: '' }, t('loc.quickPh')),
    cities.map(([zh, en], i) => h('option', { value: String(i) }, lang === 'zh' ? zh : en)),
  );
  pick.onchange = () => {
    const c = cities[Number(pick.value)];
    if (!c) return;
    name.value = lang === 'zh' ? c[0] : c[1];
    lat.value = String(c[2]);
    lon.value = String(c[3]);
  };
  const el = h(
    'div',
    null,
    field(t('loc.quick'), pick),
    h('div.row', null, field(t('loc.name'), name), field(t('loc.lat'), lat), field(t('loc.lon'), lon)),
    h('small.muted', null, t('loc.hint')),
  );
  return {
    el,
    get value() {
      return { name: name.value, lat: Number(lat.value), lon: Number(lon.value) };
    },
    get valid() {
      return lat.value !== '' && lon.value !== '' && Math.abs(Number(lat.value)) <= 90 && Math.abs(Number(lon.value)) <= 180;
    },
  };
}

/** A small 中 / EN switch for pages outside the globe. */
export function langSwitch() {
  const mk = (l: 'zh' | 'en') => {
    const b = h('button', { type: 'button', class: lang === l ? 'on' : '' }, t(`lang.${l}`));
    b.onclick = () => import('./i18n').then((m) => m.setLang(l));
    return b;
  };
  return h('span.tabs.lang-switch', null, mk('zh'), mk('en'));
}
