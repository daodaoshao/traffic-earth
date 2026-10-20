import Globe, { type GlobeInstance } from 'globe.gl';
import { api, type Category, type Frame, type Meta, type Row } from './api';
import { bytes, flag, fmtRate, h, mount, rate } from './ui';

type Quality = 'high' | 'medium' | 'low';

interface ArcObj {
  key: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
  stroke: number | null;
  time: number;
  gap: number;
  info: string;
}

interface PointObj {
  key: string;
  lat: number;
  lng: number;
  alt: number;
  color: string;
  info: string;
}

interface Agg {
  up: number;
  down: number;
  n: number;
  cats: Map<string, number>;
  hosts: Map<string, number>;
  inbound: number;
}

const HISTORY = 90;

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const top = <K>(m: Map<K, number>) => [...m.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export async function showGlobe(root: HTMLElement) {
  const meta = await api<Meta>('/api/meta');
  const cats = new Map<string, Category>(meta.categories.map((c) => [c.id, c]));
  const catColor = (id: string) => cats.get(id)?.color ?? '#6c7a89';
  const catName = (id: string) => cats.get(id)?.name ?? id;
  const home = meta.home ?? { lat: 39.9, lon: 116.4, name: '家' };

  // ---------- layout ----------
  const stage = h('div.stage');
  const clock = h('span.chip.mono');
  const srcChips = h('span', { style: { display: 'flex', gap: '6px', flexWrap: 'wrap' } });
  const filterChip = h('span.chip.filter.hidden', { title: '点击取消筛选' });
  const todayChip = h('span.chip.mono');
  const banner = h('div.banner.hidden');

  const vDown = h('span.v');
  const vDownU = h('span.u');
  const vUp = h('span.v');
  const vUpU = h('span.u');
  const spark = h('canvas.spark');
  const kvConns = h('b.mono');
  const kvToday = h('b.mono');

  const donut = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  donut.setAttribute('viewBox', '0 0 120 120');
  donut.classList.add('donut');
  const legend = h('div.legend.scroll');
  const topList = h('div.list.scroll', { style: { flex: '1' } });
  const devList = h('div.list.scroll', { style: { flex: '1' } });
  const exits = h('div.exits');

  let catMode: 'now' | 'today' = 'now';
  let topMode: 'host' | 'region' = 'host';
  let filter: string | null = null;

  const tabs = (opts: [string, string][], get: () => string, set: (v: string) => void) => {
    const wrap = h('span.tabs');
    const draw = () =>
      mount(
        wrap,
        opts.map(([v, label]) => h('button', { class: get() === v ? 'on' : '', onclick: () => (set(v), draw(), render()) }, label)),
      );
    draw();
    return wrap;
  };

  const hud = h(
    'div.hud',
    null,
    h(
      'div.topbar',
      null,
      h('div.brand', null, h('b', null, '流量地球'), h('span', null, 'TRAFFIC EARTH')),
      clock,
      srcChips,
      filterChip,
      h('span.spacer'),
      todayChip,
      h('a.icon-btn', { href: '#/settings/sources', title: '设置' }, '⚙ 设置'),
    ),
    h(
      'section.panel.p-rate',
      null,
      h('h3', null, '实时吞吐'),
      h(
        'div.big',
        null,
        h('div.down', null, h('div.lbl', null, '↓ 流入'), h('div', null, vDown, vDownU)),
        h('div.up', null, h('div.lbl', null, '↑ 流出'), h('div', null, vUp, vUpU)),
      ),
      spark,
      h('div.kv', null, h('span', null, '活动连接'), kvConns),
      h('div.kv', null, h('span', null, '今日 ↓/↑'), kvToday),
    ),
    h(
      'section.panel.p-cats',
      null,
      h('h3', null, '流量分类', tabs([['now', '实时'], ['today', '今日']], () => catMode, (v) => (catMode = v as any))),
      h('div.donut-wrap', null, donut, legend),
    ),
    h(
      'section.panel.p-top',
      null,
      h('h3', null, '流向排行', tabs([['host', '目标'], ['region', '地区']], () => topMode, (v) => (topMode = v as any))),
      topList,
    ),
    h('section.panel.p-dev', null, h('h3', null, '设备'), devList),
    h('section.panel.p-exit', null, h('h3', null, '出口'), exits),
    h('div.footer', null, meta.geo.attribution),
  );
  mount(root, stage, h('div.scanlines'), h('div.vignette'), hud, banner);

  filterChip.onclick = () => {
    filter = null;
    render();
  };

  // ---------- globe ----------
  let quality: Quality = meta.display.quality === 'auto' ? 'high' : meta.display.quality;
  const globe: GlobeInstance = new Globe(stage, { rendererConfig: { antialias: true, alpha: true, powerPreference: 'high-performance' } })
    .backgroundColor('rgba(0,0,0,0)')
    .globeImageUrl('/img/earth-night.jpg')
    .showAtmosphere(true)
    .atmosphereColor('#2ee6ff')
    .atmosphereAltitude(0.22)
    .hexPolygonResolution(3)
    .hexPolygonMargin(0.42)
    .hexPolygonUseDots(true)
    .hexPolygonColor(() => 'rgba(64, 200, 255, 0.55)')
    .arcsTransitionDuration(0)
    .arcColor('color')
    .arcStroke('stroke')
    .arcDashLength(0.28)
    .arcDashGap('gap')
    .arcDashInitialGap(() => Math.random())
    .arcDashAnimateTime('time')
    .arcAltitudeAutoScale(0.45)
    .arcLabel('info')
    .pointsTransitionDuration(400)
    .pointAltitude('alt')
    .pointColor('color')
    .pointRadius(0.32)
    .pointLabel('info')
    .ringColor((d: any) => (t: number) => hexA(d.color, 1 - t))
    .ringMaxRadius('max')
    .ringPropagationSpeed('speed')
    .ringRepeatPeriod('period');

  const mat = globe.globeMaterial() as any;
  mat.color?.set?.('#7fa8d8');
  mat.emissive?.set?.('#03101e');
  mat.shininess = 6;

  fetch('/data/countries.geojson')
    .then((r) => r.json())
    .then((g) => globe.hexPolygonsData(g.features));

  const controls = globe.controls() as any;
  controls.autoRotate = true;
  controls.autoRotateSpeed = meta.display.rotateSpeed;
  controls.minDistance = 130;
  controls.maxDistance = 700;
  controls.enableDamping = true;
  let resume: number | undefined;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    clearTimeout(resume);
  });
  controls.addEventListener('end', () => {
    resume = window.setTimeout(() => (controls.autoRotate = meta.display.rotateSpeed > 0), 8000);
  });
  globe.pointOfView({ lat: home.lat - 8, lng: home.lon - 15, altitude: 2.4 }, 0);

  const resize = () => {
    const r = stage.getBoundingClientRect();
    globe.width(r.width).height(r.height);
  };
  window.addEventListener('resize', resize);
  resize();

  function applyQuality(q: Quality) {
    quality = q;
    const dpr = window.devicePixelRatio || 1;
    globe.renderer().setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.25) : 1);
    globe.showAtmosphere(q !== 'low');
    globe.globeImageUrl(q === 'low' ? '/img/earth-dark.jpg' : '/img/earth-night.jpg');
    globe.hexPolygonResolution(q === 'low' ? 2 : 3);
  }
  applyQuality(quality);

  // Auto quality: step down while the frame rate stays poor.
  if (meta.display.quality === 'auto') {
    let frames = 0;
    let since = performance.now();
    const tick = () => {
      frames++;
      const now = performance.now();
      if (now - since > 4000) {
        const fps = (frames * 1000) / (now - since);
        frames = 0;
        since = now;
        if (fps < 28 && quality !== 'low') applyQuality(quality === 'high' ? 'medium' : 'low');
      }
      if (quality !== 'low') requestAnimationFrame(tick);
    };
    setTimeout(() => requestAnimationFrame(tick), 3000);
  }

  // Home beacon.
  const homeRing = { lat: home.lat, lng: home.lon, color: '#2ee6ff', max: 6, speed: 2.2, period: 1100 };
  const labelLayer = h('div', { style: { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' } });
  stage.append(labelLayer);
  const homeLabel = { lat: home.lat, lng: home.lon, alt: 0.02, el: h('div.globe-label', null, `◉ ${home.name}`) };
  labelLayer.append(homeLabel.el);

  // HTML labels positioned by hand each frame; hidden when on the far side of the globe.
  let labelsAlive = true;
  const placeLabels = () => {
    if (!labelsAlive) return;
    const cam = globe.camera().position;
    // Home first, then busiest destinations; drop any label that would overlap one already placed.
    const placed: { x: number; y: number; w: number }[] = [];
    for (const l of [homeLabel, ...labels.values()]) {
      const p = globe.getCoords(l.lat, l.lng, l.alt);
      const facing = p.x * (cam.x - p.x) + p.y * (cam.y - p.y) + p.z * (cam.z - p.z) > 0;
      const sc = facing ? globe.getScreenCoords(l.lat, l.lng, l.alt) : null;
      const w = l.el.offsetWidth || 80;
      const hit = sc && placed.some((o) => Math.abs(o.x - sc.x) < (o.w + w) / 2 + 6 && Math.abs(o.y - sc.y) < 18);
      if (!sc || hit) {
        l.el.style.visibility = 'hidden';
        continue;
      }
      placed.push({ x: sc.x, y: sc.y, w });
      l.el.style.visibility = '';
      l.el.style.left = `${sc.x}px`;
      l.el.style.top = `${sc.y}px`;
    }
    requestAnimationFrame(placeLabels);
  };

  // Arc and point objects are reused between frames so animations keep running.
  const arcs = new Map<string, ArcObj>();
  const pts = new Map<string, PointObj>();
  const labels = new Map<string, { lat: number; lng: number; alt: number; el: HTMLElement }>();

  // ---------- data ----------
  let frame: Frame | null = null;
  const hist: { up: number; down: number }[] = [];
  const devName = (k: string) => {
    const d = frame?.devices[k];
    return (d?.icon ? d.icon + ' ' : '') + (d?.name || k);
  };

  function render() {
    if (!frame) return;
    const f = frame;
    const rows = filter ? f.rows.filter((r) => r.d === filter) : f.rows;

    // Per destination point.
    const byPoint = new Map<string, Agg>();
    const byHost = new Map<string, { up: number; down: number; n: number; cat: string; p: string; o?: string; i: number }>();
    const byRegion = new Map<string, { up: number; down: number; n: number; cc: string; label: string }>();
    const byCat = new Map<string, number>();
    const byExit = new Map<string, { up: number; down: number; n: number }>();
    let up = 0;
    let down = 0;
    for (const r of rows) {
      up += r.u;
      down += r.w;
      const t = r.u + r.w;
      byCat.set(r.c, (byCat.get(r.c) ?? 0) + t);
      const e = byExit.get(r.x) ?? { up: 0, down: 0, n: 0 };
      e.up += r.u;
      e.down += r.w;
      e.n += r.n;
      byExit.set(r.x, e);
      const hk = `${r.h}|${r.i}`;
      const hh = byHost.get(hk) ?? { up: 0, down: 0, n: 0, cat: r.c, p: r.p, o: r.o, i: r.i };
      hh.up += r.u;
      hh.down += r.w;
      hh.n += r.n;
      byHost.set(hk, hh);
      if (!r.p) continue;
      const pt = f.points[r.p];
      const a = byPoint.get(r.p) ?? { up: 0, down: 0, n: 0, cats: new Map(), hosts: new Map(), inbound: 0 };
      a.up += r.u;
      a.down += r.w;
      a.n += r.n;
      a.cats.set(r.c, (a.cats.get(r.c) ?? 0) + t + 1);
      a.hosts.set(r.h, (a.hosts.get(r.h) ?? 0) + t + 1);
      if (r.i) a.inbound += t + 1;
      byPoint.set(r.p, a);
      const rk = `${pt.cc}|${pt.city}`;
      const rg = byRegion.get(rk) ?? { up: 0, down: 0, n: 0, cc: pt.cc, label: [pt.country, pt.city].filter(Boolean).join(' · ') };
      rg.up += r.u;
      rg.down += r.w;
      rg.n += r.n;
      byRegion.set(rk, rg);
    }
    if (!filter) {
      up = f.total.up;
      down = f.total.down;
    }

    // ----- globe layers -----
    const maxT = Math.max(1, ...[...byPoint.values()].map((a) => a.up + a.down));
    const seen = new Set<string>();
    const pointList: PointObj[] = [];
    const ringList: any[] = [homeRing];
    const ranked = [...byPoint.entries()].sort((a, b) => b[1].up + b[1].down - (a[1].up + a[1].down));
    ranked.forEach(([key, a], idx) => {
      const p = f.points[key];
      const t = a.up + a.down;
      const cat = top(a.cats)!;
      const inbound = a.inbound > (a.up + a.down + a.n) / 2;
      const color = inbound ? catColor('inbound') : catColor(cat);
      const norm = Math.log10(1 + t) / Math.log10(1 + maxT); // 0..1
      const info =
        `<b>${flag(p.cc)} ${esc([p.country, p.city].filter(Boolean).join(' · '))}</b><br>` +
        `↓ ${rate(a.down)} &nbsp; ↑ ${rate(a.up)} · ${a.n} 连接<br>` +
        [...a.hosts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([hst]) => esc(hst)).join('<br>');
      seen.add(key);
      let arc = arcs.get(key);
      if (!arc) {
        arc = { key, startLat: home.lat, startLng: home.lon, endLat: p.lat, endLng: p.lon, color: ['', ''], stroke: null, time: 0, gap: 0, info: '' };
        arcs.set(key, arc);
      }
      // Inbound traffic flows toward home.
      if (inbound) Object.assign(arc, { startLat: p.lat, startLng: p.lon, endLat: home.lat, endLng: home.lon });
      else Object.assign(arc, { startLat: home.lat, startLng: home.lon, endLat: p.lat, endLng: p.lon });
      const idle = t < 64;
      arc.color = idle ? [hexA(color, 0.1), hexA(color, 0.4)] : [hexA(color, 0.35), hexA(color, 1)];
      arc.stroke = quality === 'low' ? null : idle ? 0.15 : 0.25 + norm * 1.1;
      arc.time = idle ? 6000 : 3800 - norm * 3000;
      arc.gap = idle ? 2 : 0.9 - norm * 0.5;
      arc.info = info;

      let pt = pts.get(key);
      if (!pt) {
        pt = { key, lat: p.lat, lng: p.lon, alt: 0, color, info };
        pts.set(key, pt);
      }
      pt.alt = 0.01 + norm * 0.12;
      pt.color = color;
      pt.info = info;
      pointList.push(pt);
      if (quality !== 'low' && idx < 10 && !idle)
        ringList.push({ lat: p.lat, lng: p.lon, color, max: 1.5 + norm * 3, speed: 1 + norm * 2, period: 1800 - norm * 900 });
    });
    for (const k of arcs.keys()) if (!seen.has(k)) arcs.delete(k);
    for (const k of pts.keys()) if (!seen.has(k)) pts.delete(k);
    globe.arcsData([...arcs.values()]);
    globe.pointsData(pointList);
    globe.ringsData(ringList);

    const labelKeys = new Set(ranked.slice(0, quality === 'low' ? 3 : 6).filter(([, a]) => a.up + a.down > 1024).map(([k]) => k));
    for (const [k, l] of labels)
      if (!labelKeys.has(k)) {
        l.el.remove();
        labels.delete(k);
      }
    for (const k of labelKeys) {
      const p = f.points[k];
      const a = byPoint.get(k)!;
      let l = labels.get(k);
      if (!l) {
        l = { lat: p.lat, lng: p.lon, alt: 0.03, el: h('div.globe-label') };
        labelLayer.append(l.el);
        labels.set(k, l);
      }
      l.el.textContent = `${p.city || p.country} ${rate(a.up + a.down)}`;
    }

    // ----- rate panel -----
    const [dv, du] = fmtRate(down);
    const [uv, uu] = fmtRate(up);
    vDown.textContent = dv;
    vDownU.textContent = du;
    vUp.textContent = uv;
    vUpU.textContent = uu;
    kvConns.textContent = String(filter ? rows.reduce((s, r) => s + r.n, 0) : f.total.conns);
    const td = filter ? (f.today.devs[filter] ?? [0, 0]) : [f.today.up, f.today.down];
    kvToday.textContent = `${bytes(td[1])} / ${bytes(td[0])}`;
    todayChip.textContent = `今日 ↓ ${bytes(f.today.down)}  ↑ ${bytes(f.today.up)}`;
    drawSpark();

    // ----- categories -----
    const catVals =
      catMode === 'now'
        ? byCat
        : new Map(
            Object.entries(filter ? {} : f.today.cats).map(([k, v]) => [k, v[0] + v[1]] as [string, number]),
          );
    drawDonut(catVals, catMode === 'now' ? rate : bytes, filter && catMode === 'today' ? '筛选设备时只看实时' : '');

    // ----- top list -----
    const items =
      topMode === 'host'
        ? [...byHost.entries()].map(([k, v]) => ({
            name: k.split('|')[0],
            sub: v.i ? '外部访问' : v.o || [f.points[v.p]?.country, f.points[v.p]?.city].filter(Boolean).join(' '),
            cc: f.points[v.p]?.cc ?? '',
            t: v.up + v.down,
            down: v.down,
            up: v.up,
            color: catColor(v.i ? 'inbound' : v.cat),
          }))
        : [...byRegion.values()].map((v) => ({ name: v.label || v.cc.toUpperCase(), sub: `${v.n} 连接`, cc: v.cc, t: v.up + v.down, down: v.down, up: v.up, color: '#2ee6ff' }));
    items.sort((a, b) => b.t - a.t);
    const shown = items.slice(0, 40);
    const maxI = Math.max(1, ...shown.map((x) => x.t));
    mount(
      topList,
      shown.length
        ? shown.map((x) =>
            h(
              'div.item',
              { title: `↓ ${rate(x.down)}  ↑ ${rate(x.up)}` },
              h('div.name', null, `${flag(x.cc)} ${x.name}`, x.sub ? h('small', null, x.sub) : null),
              h('div.rate', null, rate(x.t)),
              h('div.bar', null, h('i', { style: { width: `${(x.t / maxI) * 100}%`, background: x.color, boxShadow: `0 0 6px ${x.color}` } })),
            ),
          )
        : h('div.empty', null, '暂无流量'),
    );

    // ----- devices (always unfiltered) -----
    const devs = new Map<string, { up: number; down: number; n: number }>();
    for (const r of f.rows) {
      const d = devs.get(r.d) ?? { up: 0, down: 0, n: 0 };
      d.up += r.u;
      d.down += r.w;
      d.n += r.n;
      devs.set(r.d, d);
    }
    for (const k of Object.keys(f.today.devs)) if (!devs.has(k)) devs.set(k, { up: 0, down: 0, n: 0 });
    const devItems = [...devs.entries()]
      .map(([k, v]) => ({ k, ...v, today: (f.today.devs[k]?.[0] ?? 0) + (f.today.devs[k]?.[1] ?? 0) }))
      .sort((a, b) => b.up + b.down - (a.up + a.down) || b.today - a.today)
      .slice(0, 60);
    const maxD = Math.max(1, ...devItems.map((x) => x.up + x.down));
    mount(
      devList,
      devItems.map((x) =>
        h(
          'div.item.click',
          {
            class: filter === x.k ? 'sel' : '',
            onclick: () => {
              filter = filter === x.k ? null : x.k;
              render();
            },
          },
          h('div.name', null, devName(x.k), h('small', null, `今日 ${bytes(x.today)}`)),
          h('div.rate', null, rate(x.up + x.down)),
          h('div.bar', null, h('i', { style: { width: `${((x.up + x.down) / maxD) * 100}%`, background: '#2ee6ff' } })),
        ),
      ),
    );
    filterChip.classList.toggle('hidden', !filter);
    if (filter) filterChip.textContent = `◎ 只看 ${devName(filter)}  ✕`;

    // ----- exits -----
    const ex = [...byExit.entries()].sort((a, b) => b[1].up + b[1].down - (a[1].up + a[1].down)).slice(0, 8);
    const totEx = Math.max(1, ex.reduce((s, [, v]) => s + v.up + v.down, 0));
    mount(
      exits,
      ex.length
        ? ex.map(([name, v]) =>
            h(
              'div.exit',
              { style: { borderLeftColor: name === 'DIRECT' ? '#3dffa8' : '#b388ff' } },
              h('b', null, name === 'DIRECT' ? '直连 DIRECT' : name),
              h('span', null, `${rate(v.up + v.down)} · ${Math.round(((v.up + v.down) / totEx) * 100)}%`),
            ),
          )
        : h('span.muted', null, '—'),
    );

    // ----- sources -----
    mount(
      srcChips,
      f.sources.map((s) =>
        h('span.chip', { title: s.status.state === 'error' ? s.status.error : '' }, h('i.dot', { class: s.status.state }), s.name),
      ),
    );
    const bad = f.sources.filter((s) => s.status.state === 'error');
    banner.classList.toggle('hidden', !bad.length && f.sources.length > 0);
    if (!f.sources.length) banner.textContent = '还没有启用的数据源，去「设置 → 数据源」添加';
    else if (bad.length) banner.textContent = bad.map((s) => `${s.name}：${(s.status as any).error}`).join('；');
  }

  function drawSpark() {
    const dpr = window.devicePixelRatio || 1;
    const w = spark.clientWidth;
    const hgt = spark.clientHeight;
    if (!w) return;
    spark.width = w * dpr;
    spark.height = hgt * dpr;
    const ctx = spark.getContext('2d')!;
    ctx.scale(dpr, dpr);
    const max = Math.max(1, ...hist.map((x) => Math.max(x.down, x.up)));
    const x = (i: number) => (i / (HISTORY - 1)) * w;
    const y = (v: number) => hgt - 2 - (v / max) * (hgt - 6);
    const off = HISTORY - hist.length;
    ctx.strokeStyle = 'rgba(46,230,255,0.08)';
    for (let g = 1; g < 4; g++) {
      ctx.beginPath();
      ctx.moveTo(0, (hgt / 4) * g);
      ctx.lineTo(w, (hgt / 4) * g);
      ctx.stroke();
    }
    if (hist.length < 2) return;
    const grad = ctx.createLinearGradient(0, 0, 0, hgt);
    grad.addColorStop(0, 'rgba(46,230,255,0.45)');
    grad.addColorStop(1, 'rgba(46,230,255,0)');
    ctx.beginPath();
    hist.forEach((p, i) => (i ? ctx.lineTo(x(i + off), y(p.down)) : ctx.moveTo(x(i + off), y(p.down))));
    ctx.lineTo(x(HISTORY - 1), hgt);
    ctx.lineTo(x(off), hgt);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.beginPath();
    hist.forEach((p, i) => (i ? ctx.lineTo(x(i + off), y(p.down)) : ctx.moveTo(x(i + off), y(p.down))));
    ctx.strokeStyle = '#2ee6ff';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = '#2ee6ff';
    ctx.shadowBlur = 6;
    ctx.stroke();
    ctx.beginPath();
    hist.forEach((p, i) => (i ? ctx.lineTo(x(i + off), y(p.up)) : ctx.moveTo(x(i + off), y(p.up))));
    ctx.strokeStyle = '#ffb547';
    ctx.shadowColor = '#ffb547';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.font = '10px ui-monospace, monospace';
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(111,138,168,0.9)';
    ctx.fillText(rate(max), 2, 10);
  }

  function drawDonut(vals: Map<string, number>, fmt: (n: number) => string, note: string) {
    const list = [...vals.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    const total = list.reduce((s, [, v]) => s + v, 0);
    const ns = 'http://www.w3.org/2000/svg';
    donut.replaceChildren();
    const r = 46;
    const c = 2 * Math.PI * r;
    const bg = document.createElementNS(ns, 'circle');
    Object.entries({ cx: 60, cy: 60, r, fill: 'none', stroke: 'rgba(46,230,255,0.08)', 'stroke-width': 14 }).forEach(([k, v]) => bg.setAttribute(k, String(v)));
    donut.append(bg);
    let acc = 0;
    for (const [id, v] of list) {
      const seg = document.createElementNS(ns, 'circle');
      const len = (v / total) * c;
      Object.entries({
        cx: 60, cy: 60, r, fill: 'none', stroke: catColor(id), 'stroke-width': 14,
        'stroke-dasharray': `${Math.max(0, len - 1.2)} ${c}`, 'stroke-dashoffset': String(-acc), transform: 'rotate(-90 60 60)',
      }).forEach(([k, val]) => seg.setAttribute(k, String(val)));
      seg.style.filter = `drop-shadow(0 0 3px ${catColor(id)})`;
      donut.append(seg);
      acc += len;
    }
    const txt = document.createElementNS(ns, 'text');
    Object.entries({ x: 60, y: 58, 'text-anchor': 'middle', fill: '#d8ecff', 'font-size': 13, 'font-family': 'ui-monospace, monospace' }).forEach(([k, v]) => txt.setAttribute(k, String(v)));
    txt.textContent = total ? fmt(total) : '—';
    const sub = document.createElementNS(ns, 'text');
    Object.entries({ x: 60, y: 74, 'text-anchor': 'middle', fill: '#6f8aa8', 'font-size': 9 }).forEach(([k, v]) => sub.setAttribute(k, String(v)));
    sub.textContent = catMode === 'now' ? '当前' : '今日';
    donut.append(txt, sub);
    mount(
      legend,
      note ? h('div.muted', null, note) : null,
      list.slice(0, 12).map(([id, v]) =>
        h('div', null, h('i', { style: { background: catColor(id) } }), h('span', null, catName(id)), h('em', null, `${Math.round((v / total) * 100)}%`)),
      ),
    );
  }

  setInterval(() => {
    clock.textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }, 1000);

  // ---------- live feed ----------
  let ws: WebSocket | null = null;
  let retry = 1000;
  let alive = true;
  const connect = () => {
    if (!alive) return;
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`);
    ws.onmessage = (ev) => {
      retry = 1000;
      frame = JSON.parse(ev.data) as Frame;
      const rows: Row[] = filter ? frame.rows.filter((r) => r.d === filter) : frame.rows;
      const v = filter
        ? { up: rows.reduce((s, r) => s + r.u, 0), down: rows.reduce((s, r) => s + r.w, 0) }
        : { up: frame.total.up, down: frame.total.down };
      hist.push(v);
      if (hist.length > HISTORY) hist.shift();
      render();
    };
    ws.onclose = (ev) => {
      if (ev.code === 4401) {
        location.hash = '#/login';
        return;
      }
      if (!alive) return;
      banner.classList.remove('hidden');
      banner.textContent = '与服务器的连接断开，正在重连…';
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 15000);
    };
  };
  connect();
  requestAnimationFrame(placeLabels);

  // Called by the router when navigating away.
  return () => {
    alive = false;
    labelsAlive = false;
    ws?.close();
    window.removeEventListener('resize', resize);
    globe._destructor?.();
  };
}
