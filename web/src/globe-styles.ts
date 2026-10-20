import type { GlobeInstance } from 'globe.gl';

/** How the globe itself looks. Arcs, points and labels keep their category colors in every style. */
export type GlobeStyle = 'dots' | 'hologram' | 'realistic' | 'stars' | 'neon';
export const GLOBE_STYLES: GlobeStyle[] = ['dots', 'hologram', 'realistic', 'stars', 'neon'];

interface StyleDef {
  texture: string | null;
  bump: string | null;
  material: { color: string; emissive: string; shininess: number; opacity: number };
  atmosphere: { color: string; altitude: number } | null;
  /** Land drawn as a hexagonal dot grid. */
  hex: { color: string; margin: number; resolution: number } | null;
  /** Countries as polygons: cap fill, extruded side, outline. */
  plates: { cap: string; side: string; stroke: string; altitude: number } | null;
  /** Latitude/longitude grid lines. */
  graticule: { color: string; step: number } | null;
  /** Cheaper texture for the low quality level, when the style has one. */
  lowTexture?: string;
}

const STYLES: Record<GlobeStyle, StyleDef> = {
  dots: {
    texture: '/img/earth-night.jpg',
    lowTexture: '/img/earth-dark.jpg',
    bump: null,
    material: { color: '#7fa8d8', emissive: '#03101e', shininess: 6, opacity: 1 },
    atmosphere: { color: '#2ee6ff', altitude: 0.22 },
    hex: { color: 'rgba(64, 200, 255, 0.55)', margin: 0.42, resolution: 3 },
    plates: null,
    graticule: null,
  },
  hologram: {
    texture: null,
    bump: null,
    material: { color: '#03141f', emissive: '#021826', shininess: 40, opacity: 0.9 },
    atmosphere: { color: '#2ee6ff', altitude: 0.3 },
    hex: null,
    plates: { cap: 'rgba(46, 230, 255, 0.05)', side: 'rgba(0, 0, 0, 0)', stroke: 'rgba(110, 236, 255, 0.9)', altitude: 0.003 },
    graticule: { color: 'rgba(46, 230, 255, 0.16)', step: 15 },
  },
  realistic: {
    texture: '/img/earth-blue-marble.jpg',
    bump: '/img/earth-topology.png',
    material: { color: '#ffffff', emissive: '#000000', shininess: 14, opacity: 1 },
    atmosphere: { color: '#8ccfff', altitude: 0.17 },
    hex: null,
    plates: null,
    graticule: null,
  },
  stars: {
    texture: null,
    bump: null,
    material: { color: '#0d1d3f', emissive: '#0a1733', shininess: 4, opacity: 1 },
    atmosphere: { color: '#7d93ff', altitude: 0.26 },
    hex: { color: 'rgba(236, 242, 255, 0.82)', margin: 0.58, resolution: 3 },
    plates: null,
    graticule: null,
  },
  neon: {
    texture: null,
    bump: null,
    material: { color: '#06030f', emissive: '#0b0620', shininess: 20, opacity: 1 },
    atmosphere: { color: '#b45cff', altitude: 0.22 },
    hex: null,
    plates: { cap: 'rgba(34, 16, 70, 0.92)', side: 'rgba(180, 80, 255, 0.35)', stroke: 'rgba(255, 92, 220, 0.95)', altitude: 0.01 },
    graticule: { color: 'rgba(170, 90, 255, 0.12)', step: 15 },
  },
};

function graticule(step: number) {
  const lines: [number, number][][] = [];
  for (let lng = -180; lng < 180; lng += step) {
    const l: [number, number][] = [];
    for (let lat = -88; lat <= 88; lat += 2) l.push([lat, lng]);
    lines.push(l);
  }
  for (let lat = -75; lat <= 75; lat += step) {
    const l: [number, number][] = [];
    for (let lng = -180; lng <= 180; lng += 2) l.push([lat, lng]);
    lines.push(l);
  }
  return lines;
}

export function pickStyle(saved: string | undefined): GlobeStyle {
  let fromUrl: string | null = null;
  try {
    fromUrl = new URLSearchParams(location.search).get('style');
  } catch {
    /* ignore */
  }
  const s = (fromUrl ?? saved ?? 'dots') as GlobeStyle;
  return GLOBE_STYLES.includes(s) ? s : 'dots';
}

/** Applies a style; `countries` may arrive later, so call again once it is loaded. */
export function applyGlobeStyle(globe: GlobeInstance, name: GlobeStyle, countries: object[], low: boolean) {
  const s = STYLES[name];
  const texture = low && s.lowTexture ? s.lowTexture : s.texture;
  globe.globeImageUrl(texture as any);
  globe.bumpImageUrl(s.bump as any);
  const mat = globe.globeMaterial() as any;
  if (!texture && mat.map) {
    mat.map = null;
    mat.needsUpdate = true;
  }
  mat.color?.set?.(s.material.color);
  mat.emissive?.set?.(s.material.emissive);
  mat.shininess = s.material.shininess;
  mat.transparent = s.material.opacity < 1;
  mat.opacity = s.material.opacity;

  globe.showAtmosphere(!!s.atmosphere && !low);
  if (s.atmosphere) globe.atmosphereColor(s.atmosphere.color).atmosphereAltitude(s.atmosphere.altitude);

  if (s.hex) {
    const hex = s.hex;
    globe
      .hexPolygonResolution(low ? Math.min(2, hex.resolution) : hex.resolution)
      .hexPolygonMargin(hex.margin)
      .hexPolygonUseDots(true)
      .hexPolygonColor(() => hex.color)
      .hexPolygonsData(countries);
  } else globe.hexPolygonsData([]);

  if (s.plates) {
    const p = s.plates;
    globe
      .polygonsTransitionDuration(0)
      .polygonCapColor(() => p.cap)
      .polygonSideColor(() => p.side)
      .polygonStrokeColor(() => p.stroke)
      .polygonAltitude(p.altitude)
      .polygonsData(countries);
  } else globe.polygonsData([]);

  if (s.graticule) {
    const g = s.graticule;
    globe
      .pathTransitionDuration(0)
      .pathPointLat((pt: any) => pt[0])
      .pathPointLng((pt: any) => pt[1])
      .pathPointAlt(0.001)
      .pathStroke(null as any)
      .pathColor(() => g.color)
      .pathsData(graticule(g.step));
  } else globe.pathsData([]);
}
