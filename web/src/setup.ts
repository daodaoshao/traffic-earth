import { api } from './api';
import { field, locationForm, mihomoForm, openwrtForm } from './forms';
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
  const loc = locationForm({ name: '', lat: NaN, lon: NaN } as any);
  const pw = h('input', { type: 'password', autocomplete: 'new-password' });
  const pw2 = h('input', { type: 'password', autocomplete: 'new-password' });
  const err = h('div');

  const card = h('div.card');
  const page = h('div.page', null, card);
  mount(root, page);

  const next = h('button.btn.primary', { type: 'button' });
  const back = h('button.btn', { type: 'button' }, '上一步');

  function draw() {
    const steps = h('div.steps', null, Array.from({ length: total }, (_, i) => h('i', { class: i < step ? 'on' : '' })));
    let body: HTMLElement;
    if (step === 1) {
      body = h(
        'div',
        null,
        h('h2', null, '① 连接你的路由器'),
        h('p', null, '流量地球从 OpenWrt 路由器读取连接表（只读）。支持 OpenWrt / ImmortalWrt / LEDE 23.05 及以上。'),
        ow.el,
        h('h2', null, '可选：mihomo 增强'),
        h('label', { style: { display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' } }, useMihomo, '这台路由器上运行着 mihomo（Nikki / OpenClash / mihomo 内核）'),
        h('p', { style: { fontSize: '12px' } }, '接入后能看到具体域名和代理出口；使用 fake-ip 模式的路由器强烈建议开启，否则被代理的连接无法定位。'),
        miWrap,
      );
    } else if (step === 2) {
      body = h('div', null, h('h2', null, '② 家在哪里'), loc.el);
    } else {
      body = h(
        'div',
        null,
        h('h2', null, '③ 管理员密码'),
        h('p', null, '这里能看到全家的上网记录，所以必须设密码。'),
        h('div.row', null, field('密码（至少 8 位）', pw), field('再输一次', pw2)),
      );
    }
    next.textContent = step === total ? '完成' : '下一步';
    mount(
      card,
      h('h1', null, '流量地球'),
      h('p', null, 'Traffic Earth · 首次设置'),
      steps,
      body,
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
      if (!ow.value.setupToken) return mount(err, msg('err', '请先生成配置命令并在路由器上执行'));
      if (!ow.tested) return mount(err, msg('err', '请先点「测试连接」，确认能连上路由器'));
    }
    if (step === 2 && !loc.valid) return mount(err, msg('err', '请填写有效的经纬度'));
    if (step < total) {
      step++;
      return draw();
    }
    if (!passwordPreset) {
      if (pw.value.length < 8) return mount(err, msg('err', '密码至少 8 位'));
      if (pw.value !== pw2.value) return mount(err, msg('err', '两次输入的密码不一致'));
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
  const go = h('button.btn.primary', { type: 'submit' }, '进入');
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
    field('管理员密码', pw),
    err,
    h('div.actions', null, go),
  );
  mount(root, h('div.page', null, h('div.card.narrow', null, h('h1', null, '流量地球'), h('p', null, 'Traffic Earth'), form)));
  pw.focus();
}
