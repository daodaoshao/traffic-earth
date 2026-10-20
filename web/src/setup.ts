import { api } from './api';
import { field, langSwitch, locationForm, mihomoForm, openwrtForm } from './forms';
import { t } from './i18n';
import { h, mount, msg } from './ui';

export function showSetup(root: HTMLElement, passwordPreset: boolean) {
  const total = passwordPreset ? 2 : 3;
  let step = 1;

  const ow = openwrtForm();
  const useMihomo = h('input', { type: 'checkbox' });
  const mi = mihomoForm({}, []);
  const miWrap = h('div.hidden', null, mi.el);
  useMihomo.onchange = () => {
    miWrap.classList.toggle('hidden', !useMihomo.checked);
    try {
      mi.setUrl(`${new URL(ow.url.includes('://') ? ow.url : 'http://' + ow.url).hostname}:9090`);
    } catch {
      /* ignore */
    }
  };
  const loc = locationForm(null);
  const pw = h('input', { type: 'password', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const err = h('div');

  const card = h('div.card');
  mount(root, h('div.page', null, card));

  const next = h('button.btn.primary', { type: 'button' });
  const back = h('button.btn', { type: 'button' }, t('common.back'));

  // All step bodies exist from the start so values survive moving back and forth.
  const steps = [
    h(
      'div',
      null,
      h('h2', null, t('setup.step1')),
      h('p', null, t('setup.step1.desc')),
      ow.el,
      h('h2', null, t('setup.mihomo')),
      h('label.check', null, useMihomo, t('setup.mihomo.check')),
      h('p', { style: { fontSize: '12px' } }, t('setup.mihomo.desc')),
      miWrap,
    ),
    h('div', null, h('h2', null, t('setup.step2')), loc.el),
    h(
      'div',
      null,
      h('h2', null, t('setup.step3')),
      h('p', null, t('setup.step3.desc')),
      h('div.row', null, field(t('setup.pw'), pw), field(t('setup.pw2'), pw2)),
    ),
  ];

  function draw() {
    const bar = h('div.steps', null, Array.from({ length: total }, (_, i) => h('i', { class: i < step ? 'on' : '' })));
    next.textContent = step === total ? t('common.finish') : t('common.next');
    mount(
      card,
      h('div.card-head', null, h('div', null, h('h1', null, t('app.title')), h('p', null, t('setup.subtitle'))), langSwitch()),
      bar,
      steps[step - 1],
      err,
      h('div.actions', null, step > 1 ? back : null, next),
    );
  }

  back.onclick = () => {
    step--;
    mount(err);
    draw();
  };
  next.onclick = async () => {
    mount(err);
    if (step === 1) {
      if (!ow.value.setupToken) return mount(err, msg('err', t('setup.needCommand')));
      if (!ow.tested) return mount(err, msg('err', t('setup.needTest')));
    }
    if (step === 2 && !loc.valid) return mount(err, msg('err', t('setup.badCoords')));
    if (step < total) {
      step++;
      return draw();
    }
    if (!passwordPreset) {
      if (pw.value.length < 8) return mount(err, msg('err', t('setup.pwShort')));
      if (pw.value !== pw2.value) return mount(err, msg('err', t('setup.pwMismatch')));
    }
    next.disabled = true;
    try {
      const sources: any[] = [ow.value];
      if (useMihomo.checked) sources.push(mi.value);
      await api('/api/setup', { body: { password: pw.value, home: loc.value, sources } });
      location.hash = '#/';
    } catch (e: any) {
      mount(err, msg('err', e.message));
    } finally {
      next.disabled = false;
    }
  };
  draw();
}

export function showLogin(root: HTMLElement) {
  const pw = h('input', { type: 'password', autocomplete: 'current-password', autofocus: true });
  const err = h('div');
  const go = h('button.btn.primary', { type: 'submit' }, t('login.go'));
  const form = h(
    'form',
    {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        go.disabled = true;
        try {
          await api('/api/login', { body: { password: pw.value } });
          location.hash = '#/';
        } catch (ex: any) {
          mount(err, msg('err', ex.message));
        } finally {
          go.disabled = false;
        }
      },
    },
    field(t('login.password'), pw),
    err,
    h('div.actions', null, go),
  );
  mount(
    root,
    h('div.page', null, h('div.card.narrow', null, h('div.card-head', null, h('h1', null, t('app.title')), langSwitch()), form)),
  );
  pw.focus();
}
