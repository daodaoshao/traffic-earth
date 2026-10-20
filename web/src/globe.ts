import Globe, { type GlobeInstance } from 'globe.gl';
import { api, type Category, type Frame, type Meta, type Point } from './api';
import { cities } from './cities';
import { anonDevice, demo } from './demo';
import { applyGlobeStyle, pickStyle } from './globe-styles';
import { catName, lang, msgText, placeName, setLang, t } from './i18n';
import { zhOrg } from './places-zh';
import { bytes, flag, fmtBytes, fmtRate, h, rate } from './ui';

type Quality = 'high' | 'medium' | 'low';

/** Lists re-sort at most this often; in between only numbers and bars move. */
const RESORT_MS = 3000;
/** Smoothing for displayed rates (per 1 s frame). */
const EMA = 0.45;
const HISTORY_SEC = 90;
const LEGEND_SLOTS = 8;
const TOP_SLOTS = 12;
const DEV_SLOTS = 8;
const MAX_ARCS = 90;

const hexA = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const setText = (el: HTMLElement | SVGElement, v: string) => {
  if (el.textContent !== v) el.textContent = v;
};

/**
 * Values that glide toward a target inside the page's animation loop rather than via CSS
 * transitions, so every motion follows the same clock (which a frame-by-frame recorder controls).
 */
class Glide {
  private items = new Map<object, { cur: number; target: number; apply: (v: number) => void }>();
  set(key: object, target: number, apply: (v: number) => void) {
    const it = this.items.get(key);
    if (it) {
      it.target = target;
      it.apply = apply;
    } else this.items.set(key, { cur: target, target, apply: (apply(target), apply) });
  }
  drop(key: object) {
    this.items.delete(key);
  }
  step(k = 0.08) {
    for (const it of this.items.values()) {
      if (Math.abs(it.target - it.cur) < 1e-3) continue;
      it.cur += (it.target - it.cur) * k;
      if (Math.abs(it.target - it.cur) < 1e-3) it.cur = it.target;
      it.apply(it.cur);
    }
  }
}
const glide = new Glide();

/** Exponentially smoothed values per key; keys fade out instead of vanishing. */
class Smooth {
  v = new Map<string, number>();
  update(next: Map<string, number>) {
    for (const [k, x] of next) this.v.set(k, (this.v.get(k) ?? x) * (1 - EMA) + x * EMA);
    for (const [k, x] of this.v)
      if (!next.has(k)) {
        const y = x * (1 - EMA);
        if (y < 1) this.v.delete(k);
        else this.v.set(k, y);
      }
  }
  get(k: string) {
    return this.v.get(k) ?? 0;
  }
}

/** Keeps an order for a while so rows don't jump every second. */
class StableOrder {
  order: string[] = [];
  private at = 0;
  pick(score: Map<string, number>, n: number, force = false): string[] {
    const now = performance.now();
    const stale = this.order.some((k) => !score.has(k));
    const room = this.order.length < n && score.size > this.order.length;
    if (force || stale || room || now - this.at > RESORT_MS) {
      this.order = [...score.entries()]
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .map(([k]) => k);
      this.at = now;
    }
    return this.order;
  }
}

interface ArcObj {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  color: [string, string];
  stroke: number | null;
  time: number;
  gap: number;
  info: string;
  sig: string;
  /** Data mostly flows toward home (download) — dashes run from the destination to home. */
  toHome: boolean;
}

interface PointObj {
  lat: number;
  lng: number;
  alt: number;
  color: string;
  info: string;
  sig: string;
}

interface Agg {
  up: number;
  down: number;
  n: number;
  cats: Map<string, number>;
  hosts: Map<string, number>;
  inbound: number;
}

export async function showGlobe(root: HTMLElement) {
  const meta = await api<Meta>('/api/meta');
  const cats = new Map<string, Category>(meta.categories.map((c) => [c.id, c]));
  const catColor = (id: string) => cats.get(id)?.color ?? '#6c7a89';
  // ?city=… moves home for a recording without touching the saved setting.
  const home = demo.city
    ? { lat: demo.city.lat, lon: demo.city.lon, name: demo.city.name }
    : (meta.home ?? { lat: 39.9, lon: 116.4, name: '' });
  // A home name picked from the city list is shown in the viewer's language.
  const preset = cities.find((c) => c[0] === home.name || c[1] === home.name);
  const homeName = preset ? (lang === 'zh' ? preset[0] : preset[1]) : home.name || t('hud.home');

  // ---------- static layout (built once; later only text, widths and attributes change) ----------
  const stage = h('div.stage');
  const clock = h('span.chip.mono');
  const srcChips = h('span.src-chips');
  const filterChip = h('span.chip.filter.hidden', { title: t('hud.clearFilter') });
  const langBtn = h('button.icon-btn', { type: 'button', title: t('lang.label') }, lang === 'zh' ? 'EN' : '中');
  langBtn.onclick = () => setLang(lang === 'zh' ? 'en' : 'zh');
  const banner = h('div.banner.hidden');
  const qualityTag = h('span.q-tag');

  const vDown = h('span.v', null, '0');
  const vDownU = h('span.u', null, 'bps');
  const vUp = h('span.v', null, '0');
  const vUpU = h('span.u', null, 'bps');
  const spark = h('canvas.spark');
  const kvConns = h('b.mono', null, '0');
  // Today's totals live in their own panel; the throughput panel is strictly live.
  const tdDown = h('span.v', null, '0');
  const tdDownU = h('span.u', null, 'B');
  const tdUp = h('span.v', null, '0');
  const tdUpU = h('span.u', null, 'B');

  const ns = 'http://www.w3.org/2000/svg';
  const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
    const el = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
  };
  // Two rings: outer = live rate, inner = today's bytes.
  const donut = svg('svg', { viewBox: '0 0 120 120', class: 'donut' });
  const ring = (r: number, w: number) => {
    const c = 2 * Math.PI * r;
    donut.append(svg('circle', { cx: 60, cy: 60, r, fill: 'none', stroke: 'rgba(46,230,255,0.08)', 'stroke-width': w }));
    const segs = Array.from({ length: LEGEND_SLOTS + 1 }, () => {
      const el = svg('circle', { cx: 60, cy: 60, r, fill: 'none', 'stroke-width': w, transform: 'rotate(-90 60 60)' });
      el.style.strokeDasharray = `0 ${c}`;
      el.style.strokeDashoffset = '0';
      donut.append(el);
      return el;
    });
    return { c, segs };
  };
  const ringNow = ring(52, 9);
  const ringDay = ring(39, 9);
  const donutNow = svg('text', { x: 60, y: 58, 'text-anchor': 'middle', fill: '#2ee6ff', 'font-size': 11, 'font-family': 'ui-monospace, monospace' });
  const donutDay = svg('text', { x: 60, y: 72, 'text-anchor': 'middle', fill: '#9fb4cc', 'font-size': 9, 'font-family': 'ui-monospace, monospace' });
  donut.append(donutNow, donutDay);
  const legendNote = h('div.legend-note.muted');
  const legendRows = Array.from({ length: LEGEND_SLOTS }, () => {
    const sw = h('i');
    const name = h('span');
    const now = h('em');
    const day = h('em');
    return { row: h('div.slot', null, sw, name, now, day), sw, name, now, day };
  });
  const legend = h(
    'div.legend',
    null,
    h('div.legend-head', null, h('span'), h('em', null, t('hud.now')), h('em', null, t('hud.todayTab'))),
    legendRows.map((r) => r.row),
    legendNote,
  );

  const mkRows = (n: number, clickable: boolean) =>
    Array.from({ length: n }, () => {
      const name = h('span.n');
      const sub = h('small');
      const val = h('div.rate');
      const bar = h('i');
      const row = h('div.item.slot', { class: clickable ? 'click' : '' }, h('div.name', null, name, sub), val, h('div.bar', null, bar));
      return { row, name, sub, val, bar, key: '' };
    });
  const devRows = mkRows(DEV_SLOTS, true);
  type TopMeta = { name: string; sub: string; org: string; cc: string; color: string; up: number; down: number };
  /** A ranked list with fixed slots, smoothed values and a slowly changing order. */
  const rankList = (slots: number) => {
    const rows = mkRows(slots, false);
    const empty = h('div.empty', null, t('hud.noTraffic'));
    const el = h('div.list', null, rows.map((r) => r.row), empty);
    const sm = new Smooth();
    const ord = new StableOrder();
    const meta = new Map<string, TopMeta>();
    return {
      el,
      reset() {
        sm.v.clear();
      },
      feed(next: Map<string, TopMeta>) {
        sm.update(new Map([...next].map(([k, v]) => [k, v.up + v.down])));
        for (const [k, v] of next) meta.set(k, v);
        for (const k of meta.keys()) if (!sm.v.has(k)) meta.delete(k);
      },
      render(force: boolean) {
        const order = ord.pick(sm.v, slots, force);
        const max = Math.max(1, ...order.map((k) => sm.get(k)));
        rows.forEach((r, i) => {
          const k = order[i];
          const m = k ? meta.get(k) : undefined;
          r.row.classList.toggle('empty', !m);
          if (!m) {
            r.key = '';
            return;
          }
          const v = sm.get(k);
          if (r.key !== k) {
            r.key = k;
            setText(r.name, `${flag(m.cc)} ${m.name}`);
            r.bar.style.background = m.color;
            r.bar.style.boxShadow = `0 0 6px ${m.color}`;
          }
          setText(r.sub, m.sub);
          setText(r.val, rate(v));
          glide.set(r.bar, (v / max) * 100, (x) => (r.bar.style.width = `${x.toFixed(2)}%`));
          r.row.title = [m.org, `↓ ${rate(m.down)}  ↑ ${rate(m.up)}`].filter(Boolean).join('\n');
        });
        empty.classList.toggle('hidden', order.length > 0);
      },
    };
  };
  const hostList = rankList(TOP_SLOTS);
  const regionList = rankList(TOP_SLOTS);
  const devList = h('div.list', null, devRows.map((r) => r.row));

  let filter: string | null = null;

  const hud = h(
    'div.hud',
    null,
    h(
      'div.topbar',
      null,
      h('div.brand', null, h('b', null, t('app.name')), h('span', null, t('app.sub'))),
      clock,
      srcChips,
      filterChip,
      h('span.spacer'),
      langBtn,
      h('a.icon-btn', { href: '#/settings/sources' }, `⚙ ${t('hud.settings')}`),
    ),
    h(
      'div.col-left',
      null,
    h(
      'section.panel.p-rate',
      null,
      h('h3', null, t('hud.throughput')),
      h(
        'div.big',
        null,
        h('div.down', null, h('div.lbl', null, t('hud.in')), h('div', null, vDown, vDownU)),
        h('div.up', null, h('div.lbl', null, t('hud.out')), h('div', null, vUp, vUpU)),
      ),
      spark,
      h('div.kv', null, h('span', null, t('hud.conns')), kvConns),
    ),
    h(
      'section.panel.p-today',
      null,
      h('h3', null, t('hud.todayTotal')),
      h(
        'div.big',
        null,
        h('div.down', null, h('div.lbl', null, t('hud.todayDown')), h('div', null, tdDown, tdDownU)),
        h('div.up', null, h('div.lbl', null, t('hud.todayUp')), h('div', null, tdUp, tdUpU)),
      ),
    ),
    h('section.panel.p-dev', null, h('h3', null, t('hud.devices')), devList),
    h(
      'section.panel.p-cats',
      null,
      h('h3', null, t('hud.categories')),
      h('div.donut-wrap', null, donut, legend),
    ),
    ),
    h(
      'section.panel.p-top',
      null,
      h('h3', null, t('hud.top')),
      h('h4.sub-head', null, t('hud.byTarget')),
      hostList.el,
      h('h4.sub-head', null, t('hud.byRegion')),
      regionList.el,
    ),
    h('div.footer', null, h('div.arc-hint', null, t('hud.arcHint')), t('hud.attribution'), qualityTag),
  );
  root.replaceChildren(stage, h('div.scanlines'), h('div.vignette'), hud, banner);

  filterChip.onclick = () => setFilter(null);
  devRows.forEach((r) => (r.row.onclick = () => r.key && setFilter(filter === r.key ? null : r.key)));

  // ---------- globe ----------
  let quality: Quality = meta.display.quality === 'auto' ? 'high' : meta.display.quality;
  const globe: GlobeInstance = new Globe(stage, { rendererConfig: { antialias: true, alpha: true, powerPreference: 'high-performance' } })
    .backgroundColor('rgba(0,0,0,0)')
    .arcsTransitionDuration(0)
    .arcColor('color')
    .arcStroke('stroke')
    .arcDashLength(0.28)
    .arcDashGap('gap')
    .arcDashInitialGap(() => Math.random())
    .arcDashAnimateTime('time')
    .arcAltitudeAutoScale(0.45)
    .arcLabel((d: any) => d.info)
    .pointsTransitionDuration(600)
    .pointAltitude('alt')
    .pointColor('color')
    .pointRadius(0.32)
    .pointLabel((d: any) => d.info)
    .ringColor((d: any) => (tt: number) => hexA(d.color, 1 - tt))
    .ringMaxRadius('max')
    .ringPropagationSpeed('speed')
    .ringRepeatPeriod('period');

  // Presentation mode lets a recording script direct the camera.
  if (demo.on) (window as any).__globe = globe;

  // ?style=… previews a look without changing the saved one.
  const style = pickStyle(meta.display.globeStyle);
  let countries: object[] = [];
  applyGlobeStyle(globe, style, countries, quality === 'low');
  fetch('/data/countries.geojson')
    .then((r) => r.json())
    .then((g) => {
      countries = g.features;
      applyGlobeStyle(globe, style, countries, quality === 'low');
    });

  const controls = globe.controls() as any;
  controls.autoRotate = meta.display.rotateSpeed > 0;
  controls.autoRotateSpeed = meta.display.rotateSpeed;
  controls.minDistance = 130;
  controls.maxDistance = 700;
  let resume: number | undefined;
  // The camera tour drives rotation itself; otherwise resume spinning a while after the user lets go.
  let userUntil = 0;
  controls.addEventListener('start', () => {
    controls.autoRotate = false;
    clearTimeout(resume);
    userUntil = Infinity;
  });
  controls.addEventListener('end', () => {
    userUntil = performance.now() + 15000;
    if (!demo.tour) resume = window.setTimeout(() => (controls.autoRotate = meta.display.rotateSpeed > 0), 8000);
  });
  globe.pointOfView({ lat: home.lat - 8, lng: home.lon - 15, altitude: 2.4 }, 0);

  /** Busiest destinations away from home, for the camera tour. */
  let tourTargets: { lat: number; lon: number }[] = [];
  const toVec = (lat: number, lon: number) => {
    const a = (lat * Math.PI) / 180;
    const b = (lon * Math.PI) / 180;
    return [Math.cos(a) * Math.cos(b), Math.cos(a) * Math.sin(b), Math.sin(a)];
  };
  /** Great-circle midpoint, so both home and the destination are in frame. */
  const midpoint = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const [x1, y1, z1] = toVec(lat1, lon1);
    const [x2, y2, z2] = toVec(lat2, lon2);
    const x = x1 + x2;
    const y = y1 + y2;
    const z = z1 + z2;
    return { lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI, lng: (Math.atan2(y, x) * 180) / Math.PI };
  };
  let tourTimer: number | undefined;
  if (demo.tour) {
    let step = 0;
    const run = () => {
      if (performance.now() < userUntil) {
        tourTimer = window.setTimeout(run, 1000);
        return;
      }
      type Shot = { lat: number; lng: number; altitude: number; move: number; hold: number; spin?: boolean };
      const shots: Shot[] = [
        { lat: home.lat - 10, lng: home.lon - 30, altitude: 2.7, move: 5000, hold: 10000, spin: true },
        { lat: home.lat - 2, lng: home.lon, altitude: 1.3, move: 5000, hold: 6000 },
        ...tourTargets.slice(0, 3).map((p) => {
          const m = midpoint(home.lat, home.lon, p.lat, p.lon);
          return { lat: m.lat - 5, lng: m.lng, altitude: 2.0, move: 6000, hold: 6000 };
        }),
      ];
      const shot = shots[step % shots.length];
      step++;
      controls.autoRotate = !!shot.spin && meta.display.rotateSpeed > 0;
      globe.pointOfView({ lat: shot.lat, lng: shot.lng, altitude: shot.altitude }, shot.move);
      tourTimer = window.setTimeout(run, shot.move + shot.hold);
    };
    tourTimer = window.setTimeout(run, 4000);
  }

  const resize = () => {
    const r = stage.getBoundingClientRect();
    globe.width(r.width).height(r.height);
    const dpr = window.devicePixelRatio || 1;
    spark.width = Math.round(spark.clientWidth * dpr);
    spark.height = Math.round(spark.clientHeight * dpr);
  };
  window.addEventListener('resize', resize);
  resize();

  // Home beacon and HTML labels (positioned by hand; three-globe's html layer is avoided).
  const homeRing = { lat: home.lat, lng: home.lon, color: '#2ee6ff', max: 6, speed: 2.2, period: 1100 };
  const labelLayer = h('div.label-layer');
  stage.append(labelLayer);
  type Label = { lat: number; lng: number; alt: number; el: HTMLElement; w: number; text: string };
  const homeLabel: Label = { lat: home.lat, lng: home.lon, alt: 0.02, el: h('div.globe-label.home'), w: 0, text: '' };
  labelLayer.append(homeLabel.el);
  const labels = new Map<string, Label>();
  const setLabel = (l: Label, text: string) => {
    if (l.text === text) return;
    l.text = text;
    l.el.textContent = text;
    l.w = 0; // measured lazily
  };
  setLabel(homeLabel, `◉ ${homeName}`);

  const arcs = new Map<string, ArcObj>();
  const pts = new Map<string, PointObj>();
  let ringKey = '';

  function applyQuality(q: Quality) {
    quality = q;
    const dpr = window.devicePixelRatio || 1;
    globe.renderer().setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.25) : 1);
    applyGlobeStyle(globe, style, countries, q === 'low');
    document.body.classList.toggle('q-low', q === 'low');
    document.body.dataset.quality = q;
    setText(qualityTag, '  ·  ' + t('hud.quality', { q: t(`hud.q.${q}`) }) + (meta.display.quality === 'auto' ? t('hud.qualityAuto') : ''));
  }
  applyQuality(quality);

  // ---------- data state ----------
  let frame: Frame | null = null;
  const sCat = new Smooth();
  const sDev = new Smooth();
  const oCat = new StableOrder();
  const oDev = new StableOrder();
  const hist: { t: number; up: number; down: number }[] = [];
  const shown = { up: 0, down: 0 };
  const target = { up: 0, down: 0 };

  const devName = (k: string) => {
    const d = frame?.devices[k];
    if (demo.on) return anonDevice(k, d?.name ?? '');
    const name = d?.name || (k === 'router' ? t('hud.router') : k);
    return (d?.icon ? d.icon + ' ' : '') + name;
  };

  function setFilter(k: string | null) {
    filter = k;
    hist.length = 0;
    sCat.v.clear();
    hostList.reset();
    regionList.reset();
    filterChip.classList.toggle('hidden', !filter);
    if (filter) filterChip.textContent = `◎ ${t('hud.onlyDevice', { name: devName(filter) })}  ✕`;
    onFrame(true);
  }

  /** Runs once per server frame (1 s). */
  function onFrame(force = false) {
    if (!frame) return;
    const f = frame;
    const rows = filter ? f.rows.filter((r) => r.d === filter) : f.rows;

    const byPoint = new Map<string, Agg>();
    const byCat = new Map<string, number>();
    const hosts = new Map<string, TopMeta>();
    const regions = new Map<string, TopMeta>();
    let up = 0;
    let down = 0;
    for (const r of rows) {
      up += r.u;
      down += r.w;
      const tt = r.u + r.w;
      byCat.set(r.c, (byCat.get(r.c) ?? 0) + tt);
      const pt: Point | undefined = r.p ? f.points[r.p] : undefined;
      const hk = `${r.h}|${r.i}`;
      let e = hosts.get(hk);
      if (!e) {
        e = {
          name: r.h,
          // The subtitle is always a place in the viewer's language; operator names are
          // data in English, so they only appear in the tooltip (translated or omitted in Chinese).
          sub: r.i ? `${t('hud.inbound')} · ${placeName(pt, true)}` : placeName(pt),
          org: r.o ? (lang === 'zh' ? (zhOrg(r.o) ?? '') : r.o) : '',
          cc: pt?.cc ?? '',
          color: catColor(r.i ? 'inbound' : r.c),
          up: 0,
          down: 0,
        };
        hosts.set(hk, e);
      }
      e.up += r.u;
      e.down += r.w;
      // Regions group by what is displayed, so two spellings of one city merge.
      const rk = placeName(pt);
      let g = regions.get(rk);
      if (!g) {
        g = { name: rk, sub: '', org: '', cc: pt?.cc ?? '', color: '#2ee6ff', up: 0, down: 0 };
        regions.set(rk, g);
      }
      g.up += r.u;
      g.down += r.w;
      g.sub = '';
      if (!r.p || !pt) continue;
      const a = byPoint.get(r.p) ?? { up: 0, down: 0, n: 0, cats: new Map(), hosts: new Map(), inbound: 0 };
      a.up += r.u;
      a.down += r.w;
      a.n += r.n;
      a.cats.set(r.c, (a.cats.get(r.c) ?? 0) + tt + 1);
      a.hosts.set(r.h, (a.hosts.get(r.h) ?? 0) + tt + 1);
      if (r.i) a.inbound += tt + 1;
      byPoint.set(r.p, a);
    }
    if (!filter) {
      up = f.total.up;
      down = f.total.down;
    }
    target.up = up;
    target.down = down;
    const now = performance.now();
    hist.push({ t: now, up, down });
    while (hist.length && now - hist[0].t > (HISTORY_SEC + 2) * 1000) hist.shift();

    sCat.update(byCat);
    hostList.feed(hosts);
    regionList.feed(regions);
    const devRates = new Map<string, number>();
    for (const r of f.rows) devRates.set(r.d, (devRates.get(r.d) ?? 0) + r.u + r.w);
    for (const k of Object.keys(f.today.devs)) if (!devRates.has(k)) devRates.set(k, 0);
    sDev.update(devRates);

    updateGlobe(f, byPoint);
    refreshPanels(force);
  }

  function updateGlobe(f: Frame, byPoint: Map<string, Agg>) {
    const ranked = [...byPoint.entries()].sort((a, b) => b[1].up + b[1].down - (a[1].up + a[1].down)).slice(0, MAX_ARCS);
    tourTargets = ranked
      .map(([k]) => f.points[k])
      .filter((p) => Math.abs(p.lat - home.lat) + Math.abs(p.lon - home.lon) > 15)
      .slice(0, 3)
      .map((p) => ({ lat: p.lat, lon: p.lon }));
    const maxT = Math.max(1, ...ranked.map(([, a]) => a.up + a.down));
    let arcsChanged = false;
    let ptsChanged = false;
    const keep = new Set<string>();
    const rings: any[] = [homeRing];
    ranked.forEach(([key, a], idx) => {
      const p = f.points[key];
      const total = a.up + a.down;
      const cat = [...a.cats.entries()].sort((x, y) => y[1] - x[1])[0][0];
      const inbound = a.inbound > (a.up + a.down + a.n) / 2;
      const color = inbound ? catColor('inbound') : catColor(cat);
      const norm = Math.log10(1 + total) / Math.log10(1 + maxT);
      // Visual level: changes rarely, so geometry is rebuilt rarely.
      const level = total < 64 ? 0 : 1 + Math.min(4, Math.floor(norm * 5));
      keep.add(key);
      const info =
        `<b>${flag(p.cc)} ${esc(placeName(p))}</b><br>↓ ${rate(a.down)} &nbsp; ↑ ${rate(a.up)} · ${esc(t('hud.connCount', { n: a.n }))}<br>` +
        [...a.hosts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4).map(([hst]) => esc(hst)).join('<br>');

      let arc = arcs.get(key);
      if (!arc) {
        arc = { startLat: 0, startLng: 0, endLat: 0, endLng: 0, color: ['', ''], stroke: null, time: 0, gap: 0, info, sig: '', toHome: a.down >= a.up };
        arcs.set(key, arc);
      }
      // Dashes follow the bytes: toward home when downloads dominate, outward when uploads do.
      // The other direction must lead by 30% before an arc turns around, so it doesn't flicker.
      if (arc.toHome && a.up > a.down * 1.3) arc.toHome = false;
      else if (!arc.toHome && a.down > a.up * 1.3) arc.toHome = true;
      const sig = `${level}|${color}|${arc.toHome ? 1 : 0}|${quality}`;
      arc.info = info;
      if (arc.sig !== sig) {
        arc.sig = sig;
        arcsChanged = true;
        if (arc.toHome) Object.assign(arc, { startLat: p.lat, startLng: p.lon, endLat: home.lat, endLng: home.lon });
        else Object.assign(arc, { startLat: home.lat, startLng: home.lon, endLat: p.lat, endLng: p.lon });
        arc.color = level === 0 ? [hexA(color, 0.1), hexA(color, 0.4)] : [hexA(color, 0.35), hexA(color, 1)];
        // Lower quality renders at a lower pixel ratio, where thin tubes shrink to a pixel or two;
        // widen them to compensate so arcs look the same on every level.
        const widen = quality === 'high' ? 1 : quality === 'medium' ? 1.3 : 1.6;
        arc.stroke = (level === 0 ? 0.25 : 0.3 + level * 0.3) * widen;
        arc.time = level === 0 ? 6000 : 4000 - level * 650;
        arc.gap = level === 0 ? 2 : 1 - level * 0.12;
      }

      const psig = `${level}|${color}`;
      let pt = pts.get(key);
      if (!pt) {
        pt = { lat: p.lat, lng: p.lon, alt: 0, color, info, sig: '' };
        pts.set(key, pt);
      }
      pt.info = info;
      if (pt.sig !== psig) {
        pt.sig = psig;
        pt.alt = 0.01 + level * 0.025;
        pt.color = color;
        ptsChanged = true;
      }
      if (quality !== 'low' && idx < 8 && level > 0)
        rings.push({ key, lat: p.lat, lng: p.lon, color, max: 1.2 + level * 0.7, speed: 0.8 + level * 0.4, period: 1900 - level * 220 });
    });
    for (const k of [...arcs.keys()])
      if (!keep.has(k)) {
        arcs.delete(k);
        arcsChanged = true;
      }
    for (const k of [...pts.keys()])
      if (!keep.has(k)) {
        pts.delete(k);
        ptsChanged = true;
      }
    if (arcsChanged) globe.arcsData([...arcs.values()]);
    if (ptsChanged) globe.pointsData([...pts.values()]);
    const rk = rings.map((r) => `${r.key ?? 'home'}${r.max}${r.color}`).join();
    if (rk !== ringKey) {
      ringKey = rk;
      globe.ringsData(rings);
    }

    // City labels for the busiest few destinations.
    const want = new Set(ranked.slice(0, quality === 'low' ? 3 : 6).filter(([, a]) => a.up + a.down > 1024).map(([k]) => k));
    for (const [k, l] of labels)
      if (!want.has(k)) {
        l.el.remove();
        glide.drop(l.el);
        labels.delete(k);
      }
    for (const k of want) {
      const p = f.points[k];
      const a = byPoint.get(k)!;
      let l = labels.get(k);
      if (!l) {
        l = { lat: p.lat, lng: p.lon, alt: 0.03, el: h('div.globe-label'), w: 0, text: '' };
        labelLayer.append(l.el);
        labels.set(k, l);
      }
      setLabel(l, `${placeName(p, true)} ${rate(a.up + a.down)}`);
    }
  }

  /** Panels: numbers update every frame; row order only every few seconds. */
  function refreshPanels(force: boolean) {
    if (!frame) return;
    const f = frame;

    // Categories: live (outer ring) and today (inner ring) side by side, fixed slots.
    // Today's split is only known for the whole home, so it is blank while a device is selected.
    const live = sCat.v;
    const day = new Map<string, number>(filter ? [] : Object.entries(f.today.cats).map(([k, v]) => [k, v[0] + v[1]] as [string, number]));
    const liveTotal = [...live.values()].reduce((a, v) => a + v, 0);
    const dayTotal = [...day.values()].reduce((a, v) => a + v, 0);
    // Order by combined share so both columns stay readable; re-sorted only every few seconds.
    const share = new Map<string, number>();
    for (const [k, v] of live) share.set(k, (share.get(k) ?? 0) + (liveTotal ? v / liveTotal : 0));
    for (const [k, v] of day) share.set(k, (share.get(k) ?? 0) + (dayTotal ? v / dayTotal : 0));
    const order = oCat.pick(share, LEGEND_SLOTS, force);
    const paint = (rg: { c: number; segs: SVGCircleElement[] }, vals: Map<string, number>, total: number) => {
      const shownSum = order.reduce((a, k) => a + (vals.get(k) ?? 0), 0);
      let acc = 0;
      rg.segs.forEach((seg, i) => {
        const k = order[i];
        const v = i < LEGEND_SLOTS ? (k ? (vals.get(k) ?? 0) : 0) : Math.max(0, total - shownSum);
        const len = total > 0 ? (v / total) * rg.c : 0;
        seg.style.stroke = i < LEGEND_SLOTS ? (k ? catColor(k) : 'transparent') : '#3a4a5c';
        glide.set(seg, len, (x) => (seg.style.strokeDasharray = `${Math.max(0, x - 1.2).toFixed(2)} ${rg.c}`));
        const off = -acc;
        glide.set(seg.style, off, (x) => (seg.style.strokeDashoffset = x.toFixed(2)));
        acc += len;
      });
    };
    paint(ringNow, live, liveTotal);
    paint(ringDay, day, dayTotal);
    setText(donutNow, liveTotal > 0 ? rate(liveTotal) : '—');
    setText(donutDay, dayTotal > 0 ? bytes(dayTotal) : '—');
    setText(legendNote, filter ? t('hud.filterNowOnly') : '');
    const pct = (v: number, total: number) => (total > 0 ? `${Math.round((v / total) * 100)}%` : '—');
    legendRows.forEach((r, i) => {
      const k = order[i];
      r.row.classList.toggle('empty', !k);
      r.sw.style.background = k ? catColor(k) : 'transparent';
      setText(r.name, k ? catName(k) : '');
      setText(r.now, k ? pct(live.get(k) ?? 0, liveTotal) : '');
      setText(r.day, k ? pct(day.get(k) ?? 0, dayTotal) : '');
    });

    // Top destinations, by host and by region.
    hostList.render(force);
    regionList.render(force);

    // Devices (never filtered: this is where the filter is chosen).
    const dScore = new Map<string, number>();
    for (const [k, v] of sDev.v) dScore.set(k, v * 1000);
    for (const [k, v] of Object.entries(f.today.devs)) dScore.set(k, (dScore.get(k) ?? 0) + (v[0] + v[1]) / 1e6 + 1e-9);
    const dOrder = oDev.pick(dScore, DEV_SLOTS, force);
    const dMax = Math.max(1, ...dOrder.map((k) => sDev.get(k)));
    devRows.forEach((r, i) => {
      const k = dOrder[i];
      r.row.classList.toggle('empty', !k);
      r.key = k ?? '';
      r.row.dataset.key = r.key;
      if (!k) return;
      const v = sDev.get(k);
      const td = f.today.devs[k];
      setText(r.name, devName(k));
      setText(r.sub, t('hud.todayBytes', { v: bytes(td ? td[0] + td[1] : 0) }));
      setText(r.val, rate(v));
      glide.set(r.bar, (v / dMax) * 100, (x) => (r.bar.style.width = `${x.toFixed(2)}%`));
      r.row.classList.toggle('sel', filter === k);
    });

    // Top bar and status.
    const conns = filter ? f.rows.filter((r) => r.d === filter).reduce((s, r) => s + r.n, 0) : f.total.conns;
    setText(kvConns, String(conns));
    const td = filter ? (f.today.devs[filter] ?? [0, 0]) : [f.today.up, f.today.down];
    const [dv, du] = fmtBytes(td[1]);
    const [uv, uu] = fmtBytes(td[0]);
    setText(tdDown, dv);
    setText(tdDownU, du);
    setText(tdUp, uv);
    setText(tdUpU, uu);
    const srcSig = f.sources.map((s) => s.id + s.status.state).join();
    if (srcChips.dataset.sig !== srcSig) {
      srcChips.dataset.sig = srcSig;
      srcChips.replaceChildren(...f.sources.map((s) => h('span.chip', null, h('i.dot', { class: s.status.state }), s.name)));
    }
    f.sources.forEach((s, i) => {
      const c = srcChips.children[i] as HTMLElement | undefined;
      if (c) c.title = s.status.state === 'error' ? msgText(s.status.error) : '';
    });
    const bad = f.sources.filter((s) => s.status.state === 'error');
    const msg = !f.sources.length ? t('hud.noSources') : bad.map((s) => `${s.name}: ${msgText((s.status as any).error)}`).join('; ');
    banner.classList.toggle('hidden', !msg);
    setText(banner, msg);
  }

  // ---------- animation loop: smooth numbers, sparkline, labels ----------
  let alive = true;
  let lastSpark = 0;
  const loop = (now: number) => {
    if (!alive) return;
    // Numbers glide toward the latest value.
    for (const k of ['up', 'down'] as const) shown[k] += (target[k] - shown[k]) * 0.08;
    const [dv, du] = fmtRate(shown.down);
    const [uv, uu] = fmtRate(shown.up);
    setText(vDown, dv);
    setText(vDownU, du);
    setText(vUp, uv);
    setText(vUpU, uu);
    if (now - lastSpark > 33) {
      lastSpark = now;
      drawSpark(now);
    }
    glide.step();
    placeLabels();
    requestAnimationFrame(loop);
  };

  // Mirrored chart: download above the center line, upload below, each on its own scale.
  // Sharing one axis flattened the upload curve, which is usually a few percent of download.
  const sparkMax = { up: 1, down: 1 };
  function drawSpark(now: number) {
    const ctx = spark.getContext('2d');
    if (!ctx || !spark.width) return;
    const dpr = window.devicePixelRatio || 1;
    const w = spark.width / dpr;
    const hh = spark.height / dpr;
    const mid = Math.round(hh * 0.58) + 0.5; // download gets a little more room
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hh);
    for (const k of ['up', 'down'] as const) {
      const peak = Math.max(1, ...hist.map((p) => p[k]));
      sparkMax[k] += (peak * 1.15 - sparkMax[k]) * 0.06;
    }
    const pps = w / HISTORY_SEC;
    // The newest sample sits one second from the right edge, so the curve scrolls continuously.
    const x = (tt: number) => w - ((now - tt) / 1000 + 1) * pps;
    const y = (k: 'up' | 'down', v: number) => {
      const f = Math.min(1, v / sparkMax[k]);
      return k === 'down' ? mid - f * (mid - 3) : mid + f * (hh - mid - 3);
    };
    ctx.strokeStyle = 'rgba(46,230,255,0.07)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const g of [0.5, 1]) {
      ctx.moveTo(0, mid - (mid - 3) * g);
      ctx.lineTo(w, mid - (mid - 3) * g);
    }
    ctx.moveTo(0, mid + (hh - mid - 3) * 0.5);
    ctx.lineTo(w, mid + (hh - mid - 3) * 0.5);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(46,230,255,0.22)';
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(w, mid);
    ctx.stroke();
    if (hist.length >= 2) {
      const path = (k: 'up' | 'down') => {
        ctx.beginPath();
        hist.forEach((p, i) => {
          const px = x(p.t);
          const py = y(k, p[k]);
          if (!i) ctx.moveTo(px, py);
          else {
            const q = hist[i - 1];
            const mx = (x(q.t) + px) / 2;
            ctx.bezierCurveTo(mx, y(k, q[k]), mx, py, px, py);
          }
        });
      };
      for (const [k, color, rgb] of [
        ['down', '#2ee6ff', '46,230,255'],
        ['up', '#ffb547', '255,181,71'],
      ] as const) {
        const edge = k === 'down' ? 0 : hh;
        const grad = ctx.createLinearGradient(0, edge, 0, mid);
        grad.addColorStop(0, `rgba(${rgb},0.45)`);
        grad.addColorStop(1, `rgba(${rgb},0.02)`);
        path(k);
        ctx.lineTo(x(hist[hist.length - 1].t), mid);
        ctx.lineTo(x(hist[0].t), mid);
        ctx.fillStyle = grad;
        ctx.fill();
        path(k);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    ctx.font = '10px ui-monospace, monospace';
    ctx.fillStyle = 'rgba(46,230,255,0.75)';
    ctx.fillText(`↓ ${rate(sparkMax.down)}`, 2, 10);
    ctx.fillStyle = 'rgba(255,181,71,0.8)';
    ctx.fillText(`↑ ${rate(sparkMax.up)}`, 2, hh - 3);
  }

  function placeLabels() {
    const cam = globe.camera().position;
    const all = [homeLabel, ...labels.values()];
    // Measure first (only labels whose text changed), then write: no read/write interleaving.
    for (const l of all) if (!l.w) l.w = l.el.offsetWidth || 80;
    const placed: { x: number; y: number; w: number }[] = [];
    for (const l of all) {
      const p = globe.getCoords(l.lat, l.lng, l.alt);
      const facing = p.x * (cam.x - p.x) + p.y * (cam.y - p.y) + p.z * (cam.z - p.z) > 0;
      const sc = facing ? globe.getScreenCoords(l.lat, l.lng, l.alt) : null;
      const hit = sc && placed.some((o) => Math.abs(o.x - sc.x) < (o.w + l.w) / 2 + 6 && Math.abs(o.y - sc.y) < 18);
      if (!sc || hit) {
        glide.set(l.el, 0, (x) => (l.el.style.opacity = x.toFixed(3)));
        continue;
      }
      placed.push({ x: sc.x, y: sc.y, w: l.w });
      glide.set(l.el, 1, (x) => (l.el.style.opacity = x.toFixed(3)));
      l.el.style.transform = `translate3d(${sc.x.toFixed(1)}px, ${sc.y.toFixed(1)}px, 0) translate(-50%, -140%)`;
    }
  }

  // Auto quality: step down while the frame rate stays poor, back up once it recovers.
  // Time spent in the background (hidden tab, sleeping screen, stalls) is not counted: browsers
  // throttle animation there, and judging quality by it once left the globe stuck on "low".
  if (meta.display.quality === 'auto') {
    const order: Quality[] = ['low', 'medium', 'high'];
    let frames = 0;
    let busy = 0; // ms of real, foreground frame time in this window
    let last = performance.now();
    let goodWindows = 0;
    const tick = (now: number) => {
      if (!alive) return;
      const dt = now - last;
      last = now;
      if (!document.hidden && dt < 250) {
        frames++;
        busy += dt;
      }
      if (busy > 4000) {
        const fps = (frames * 1000) / busy;
        frames = 0;
        busy = 0;
        const i = order.indexOf(quality);
        if (fps < 30 && i > 0) {
          goodWindows = 0;
          applyQuality(order[i - 1]);
        } else if (fps > 55 && i < order.length - 1 && ++goodWindows >= 3) {
          goodWindows = 0;
          applyQuality(order[i + 1]);
        }
      }
      requestAnimationFrame(tick);
    };
    setTimeout(() => {
      last = performance.now();
      requestAnimationFrame(tick);
    }, 3000);
  }

  const tickClock = () => setText(clock, new Date().toLocaleTimeString(lang === 'zh' ? 'zh-CN' : 'en-GB', { hour12: false }));
  tickClock();
  const clockTimer = setInterval(tickClock, 1000);

  // ---------- live feed ----------
  let ws: WebSocket | null = null;
  let retry = 1000;
  const connect = () => {
    if (!alive) return;
    ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/api/live`);
    ws.onmessage = (ev) => {
      retry = 1000;
      frame = JSON.parse(ev.data) as Frame;
      onFrame();
    };
    ws.onclose = (ev) => {
      if (ev.code === 4401) {
        location.hash = '#/login';
        return;
      }
      if (!alive) return;
      banner.classList.remove('hidden');
      setText(banner, t('hud.reconnecting'));
      setTimeout(connect, retry);
      retry = Math.min(retry * 2, 15000);
    };
  };
  connect();
  requestAnimationFrame(loop);

  return () => {
    alive = false;
    clearTimeout(tourTimer);
    clearInterval(clockTimer);
    ws?.close();
    window.removeEventListener('resize', resize);
    globe._destructor?.();
  };
}
