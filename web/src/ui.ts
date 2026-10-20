type Child = Node | string | number | null | undefined | false | Child[];
type Props = Record<string, any> | null;

/** Tiny DOM builder: h('div.panel', { onclick }, 'text', child) */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K | `${K}.${string}` | `${K}#${string}`, props?: Props, ...children: Child[]): HTMLElementTagNameMap[K];
export function h(tag: string, props?: Props, ...children: Child[]): HTMLElement {
  const [name, ...rest] = tag.split(/(?=[.#])/);
  const el = document.createElement(name);
  for (const r of rest) {
    if (r[0] === '.') el.classList.add(r.slice(1));
    else el.id = r.slice(1);
  }
  if (props)
    for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k === 'class') el.className += ' ' + v;
      else if (k in el && k !== 'list') (el as any)[k] = v;
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  append(el, children);
  return el;
}

function append(el: Node, c: Child) {
  if (c === null || c === undefined || c === false) return;
  if (Array.isArray(c)) c.forEach((x) => append(el, x));
  else el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
}

export function mount(root: HTMLElement, ...children: Child[]) {
  root.replaceChildren();
  append(root, children);
}

const units = ['B', 'KB', 'MB', 'GB', 'TB'];
export function fmtBytes(n: number): [string, string] {
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return [n >= 100 || i === 0 ? n.toFixed(0) : n.toFixed(1), units[i]];
}
export const bytes = (n: number) => fmtBytes(n).join(' ');

/** Rates in bits per second, the way ISPs and speed tests talk. */
export function fmtRate(bps: number): [string, string] {
  let b = bps * 8;
  const u = ['bps', 'Kbps', 'Mbps', 'Gbps'];
  let i = 0;
  while (b >= 1000 && i < u.length - 1) {
    b /= 1000;
    i++;
  }
  return [b >= 100 || i === 0 ? b.toFixed(0) : b.toFixed(1), u[i]];
}
export const rate = (bps: number) => fmtRate(bps).join(' ');

export function flag(cc: string) {
  if (!/^[a-z]{2}$/i.test(cc)) return '';
  return String.fromCodePoint(...[...cc.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0)));
}

export function copyText(text: string) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
  // Plain-http LAN pages have no clipboard API.
  const ta = h('textarea', { value: text, style: { position: 'fixed', opacity: '0' } });
  document.body.append(ta);
  ta.select();
  document.execCommand('copy');
  ta.remove();
  return Promise.resolve();
}

export function msg(kind: 'ok' | 'err' | 'info', text: string) {
  return h('div.msg', { class: kind }, text);
}
