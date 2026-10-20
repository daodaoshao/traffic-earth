import { cities } from './cities';
import { t } from './i18n';

/**
 * Presentation mode for screen recordings: ?demo hides anything that identifies the household,
 * &tour adds an automatic camera, &city=<name> moves "home" for the shot only.
 */
const params = new URLSearchParams(location.search);

export const demo = {
  on: params.has('demo'),
  tour: params.has('tour'),
  city: (() => {
    const q = params.get('city')?.trim().toLowerCase();
    if (!q) return null;
    const c = cities.find(([zh, en]) => zh === q || en.toLowerCase() === q);
    return c ? { name: c[0], nameEn: c[1], lat: c[2], lon: c[3] } : null;
  })(),
};

if (demo.on) document.documentElement.classList.add('demo');

type Kind = 'phone' | 'computer' | 'tablet' | 'tv' | 'storage' | 'smart' | 'router' | 'device';

const rules: Array<[RegExp, Kind]> = [
  [/iphone|android|phone|vivo|oppo|huawei|honor|redmi|xiaomi|^mi-|oneplus|galaxy|pixel|rong-?yao|手机/i, 'phone'],
  [/ipad|tablet|pad\b|matepad/i, 'tablet'],
  [/mac|book|laptop|desktop|\bpc\b|win|thinkpad|imac|surface|电脑/i, 'computer'],
  [/nas|datacenter|synology|truenas|unraid|fnos|存储/i, 'storage'],
  [/\btv\b|^tv|tv$|iptv|tv-?box|apple-?tv|android-?tv|settop|roku|chromecast|firestick|电视|机顶盒/i, 'tv'],
  [/ha\b|home|hass|haier|xiaomi-|aqara|camera|cam\b|ac\b|light|plug|sensor|esp|printer|screen|vacuum|robot|空调|摄像/i, 'smart'],
];

const labels = new Map<string, string>();
const counters = new Map<Kind, number>();

/** A stable generic name such as "手机 2" / "Phone 2" for a device key. */
export function anonDevice(key: string, realName: string): string {
  if (key === 'router') return t('hud.router');
  let label = labels.get(key);
  if (!label) {
    const kind = rules.find(([re]) => re.test(realName))?.[1] ?? 'device';
    const n = (counters.get(kind) ?? 0) + 1;
    counters.set(kind, n);
    label = `${kind}|${n}`;
    labels.set(key, label);
  }
  const [kind, n] = label.split('|');
  return `${t(`demo.${kind}`)} ${n}`;
}
