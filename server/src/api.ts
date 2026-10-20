import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { testMihomo } from './adapters/mihomo.js';
import { testOpenWrt } from './adapters/openwrt.js';
import { checkPassword, createSession, destroySession, isAuthed, requireAuth } from './auth.js';
import { categories } from './classify.js';
import { hashPassword } from './crypto.js';
import { audit, db } from './db.js';
import { engine } from './engine.js';
import { env } from './env.js';
import { geoStatus, updateGeo } from './geo.js';
import { AppError, asLang } from './msg.js';
import { pendingPassword, pendingSetup, prepareSetup, RPC_USER, scriptText, setupScript, uninstallScript } from './openwrt-setup.js';
import * as settings from './settings.js';
import type { SourceInput } from './settings.js';


/** During first-run setup the wizard may use these without a session. */
async function setupOrAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!settings.get('setupDone')) return;
  return requireAuth(req, reply);
}

/** Resolve a one-time setup token from the OpenWrt helper into the generated password. */
function withSecret(input: SourceInput & { setupToken?: string }): SourceInput {
  if (input.type === 'openwrt' && input.setupToken) {
    const pw = pendingPassword(input.setupToken);
    if (!pw) throw new AppError('setupExpired');
    return { ...input, username: RPC_USER, secret: pw };
  }
  return input;
}

function validSource(i: SourceInput) {
  if (!i || !['openwrt', 'mihomo'].includes(i.type)) throw new AppError('badSourceType');
  try {
    settings.normalizeUrl(i.url ?? '');
  } catch {
    throw new AppError('badUrl');
  }
}

function validHome(h: any) {
  const lat = Number(h?.lat);
  const lon = Number(h?.lon);
  if (!(Math.abs(lat) <= 90 && Math.abs(lon) <= 180)) throw new AppError('badCoords');
  // Empty name: the browser shows "Home" in the viewer's language.
  return { lat, lon, name: String(h?.name ?? '').slice(0, 40) };
}

async function testSource(i: SourceInput, prev?: settings.SourceConfig) {
  const url = settings.normalizeUrl(i.url);
  const secret = i.secret ?? (prev ? settings.sourceSecret(prev) : '');
  return i.type === 'openwrt' ? testOpenWrt(url, i.username ?? prev?.username ?? RPC_USER, secret) : testMihomo(url, secret);
}

export function registerApi(app: FastifyInstance) {
  app.get('/api/state', async (req) => ({
    setupDone: settings.get('setupDone'),
    authed: isAuthed(req),
    passwordPreset: !!env.adminPassword,
  }));

  app.post('/api/setup', async (req: any, reply: FastifyReply) => {
    if (settings.get('setupDone')) throw new AppError('alreadySetup', {}, 409);
    const { password, home, sources } = req.body ?? {};
    if (!env.adminPassword && (typeof password !== 'string' || password.length < 8))
      throw new AppError('passwordShort');
    const list = (sources ?? []) as Array<SourceInput & { setupToken?: string }>;
    if (!list.length) throw new AppError('needSource');
    list.forEach(validSource);
    const built: settings.SourceConfig[] = [];
    for (const s of list) {
      const src = settings.buildSource({ ...withSecret(s), linkTo: '' });
      built.push(src);
    }
    // The wizard links mihomo to the router entered alongside it.
    const router = built.find((s) => s.type === 'openwrt');
    for (const s of built) if (s.type === 'mihomo' && router) s.linkTo = router.id;
    settings.set('home', validHome(home));
    settings.set('passwordHash', hashPassword(env.adminPassword ?? password));
    settings.set('sources', built);
    settings.set('setupDone', true);
    audit('setup', built.map((s) => `${s.type}:${s.url}`).join(' '));
    createSession(reply);
    return { ok: true };
  });

  app.post('/api/login', async (req: any, reply: FastifyReply) => {
    const r = checkPassword(req.ip, String(req.body?.password ?? ''));
    if (r === 'throttled') throw new AppError('throttled', {}, 429);
    if (r === 'bad') throw new AppError('badPassword', {}, 401);
    createSession(reply);
    return { ok: true };
  });

  app.post('/api/logout', async (req, reply) => {
    destroySession(req, reply);
    return { ok: true };
  });

  app.get('/api/meta', { preHandler: requireAuth }, async () => ({
    categories,
    home: settings.get('home'),
    display: settings.get('display'),
    geo: geoStatus(),
  }));

  app.get('/api/settings', { preHandler: requireAuth }, async () => ({
    sources: settings.get('sources').map((s) => ({ ...settings.publicSource(s), status: engine.sourceStatus(s.id) })),
    home: settings.get('home'),
    retention: settings.get('retention'),
    flushIntervalSec: settings.get('flushIntervalSec'),
    geoipAutoUpdate: settings.get('geoipAutoUpdate'),
    display: settings.get('display'),
    geo: geoStatus(),
    uninstallScript,
  }));

  app.put('/api/settings', { preHandler: requireAuth }, async (req: any) => {
    const b = req.body ?? {};
    if (b.home) settings.set('home', validHome(b.home));
    if (b.retention) {
      const r = settings.get('retention');
      const clamp = (v: any, def: number, max: number) => Math.min(max, Math.max(1, Math.round(Number(v) || def)));
      settings.set('retention', {
        flowsDays: clamp(b.retention.flowsDays, r.flowsDays, 90),
        minuteDays: clamp(b.retention.minuteDays, r.minuteDays, 90),
        hourDays: clamp(b.retention.hourDays, r.hourDays, 3650),
      });
    }
    if (b.flushIntervalSec !== undefined)
      settings.set('flushIntervalSec', Math.min(3600, Math.max(30, Math.round(Number(b.flushIntervalSec) || 300))));
    if (b.geoipAutoUpdate !== undefined) settings.set('geoipAutoUpdate', !!b.geoipAutoUpdate);
    if (b.display) {
      const d = settings.get('display');
      settings.set('display', {
        quality: ['auto', 'high', 'medium', 'low'].includes(b.display.quality) ? b.display.quality : d.quality,
        rotateSpeed: Math.min(3, Math.max(0, Number(b.display.rotateSpeed ?? d.rotateSpeed))),
        globeStyle: ['dots', 'hologram', 'realistic', 'stars', 'neon'].includes(b.display.globeStyle) ? b.display.globeStyle : d.globeStyle,
      });
    }
    audit('settings', Object.keys(b).join(','));
    return { ok: true };
  });

  app.post('/api/sources/test', { preHandler: setupOrAuth }, async (req: any) => {
    const b = req.body as SourceInput & { id?: string; setupToken?: string };
    validSource(b);
    const prev = b.id ? settings.get('sources').find((s) => s.id === b.id) : undefined;
    return testSource(withSecret(b), prev);
  });

  app.post('/api/sources', { preHandler: requireAuth }, async (req: any) => {
    const b = req.body as SourceInput & { setupToken?: string };
    validSource(b);
    const src = settings.buildSource(withSecret(b));
    settings.set('sources', [...settings.get('sources'), src]);
    audit('source.add', `${src.type}:${src.url}`);
    return settings.publicSource(src);
  });

  app.put('/api/sources/:id', { preHandler: requireAuth }, async (req: any, reply: FastifyReply) => {
    const list = settings.get('sources');
    const idx = list.findIndex((s) => s.id === req.params.id);
    if (idx < 0) throw new AppError('sourceNotFound', {}, 404);
    const b = { ...req.body, type: list[idx].type } as SourceInput & { setupToken?: string };
    validSource(b);
    list[idx] = settings.buildSource(withSecret(b), list[idx]);
    settings.set('sources', list);
    audit('source.edit', `${list[idx].type}:${list[idx].url}`);
    return settings.publicSource(list[idx]);
  });

  app.delete('/api/sources/:id', { preHandler: requireAuth }, async (req: any) => {
    const list = settings.get('sources');
    const gone = list.find((s) => s.id === req.params.id);
    settings.set(
      'sources',
      list.filter((s) => s.id !== req.params.id).map((s) => (s.linkTo === req.params.id ? { ...s, linkTo: '' } : s)),
    );
    if (gone) audit('source.delete', `${gone.type}:${gone.url}`);
    return { ok: true };
  });

  app.post('/api/openwrt/prepare', { preHandler: setupOrAuth }, async (req: any) => {
    const { token, script } = prepareSetup(asLang(req.body?.lang));
    const proto = (req.headers['x-forwarded-proto'] as string) ?? req.protocol;
    const url = `${proto}://${req.headers.host}/api/openwrt/setup.sh?t=${token}&l=${asLang(req.body?.lang)}`;
    return { token, oneLiner: `wget -qO- '${url}' | sh`, script, uninstall: uninstallScript };
  });

  // Fetched by the router itself; the unguessable, expiring token is the credential.
  app.get('/api/openwrt/setup.sh', async (req: any, reply: FastifyReply) => {
    const p = pendingSetup(String(req.query?.t ?? ''));
    if (!p) return reply.code(404).type('text/plain').send(`echo "Traffic Earth: ${scriptText.expired[asLang(req.query?.l)]}" >&2; exit 1\n`);
    return reply.type('text/plain; charset=utf-8').send(setupScript(p.password, p.lang));
  });

  app.get('/api/devices', { preHandler: requireAuth }, async () =>
    engine.devices
      .all(engine.deviceSeen)
      .filter((d) => d.key !== 'router')
      .sort((a, b) => b.lastSeen - a.lastSeen),
  );

  app.put('/api/devices/:key', { preHandler: requireAuth }, async (req: any) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 40);
    const icon = String(req.body?.icon ?? '').slice(0, 8);
    if (!name && !icon) db.prepare('DELETE FROM devices WHERE key = ?').run(req.params.key);
    else
      db.prepare('INSERT INTO devices (key, name, icon) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET name = excluded.name, icon = excluded.icon').run(
        req.params.key,
        name,
        icon,
      );
    engine.devices.loadManual();
    return { ok: true };
  });

  app.post('/api/geoip/update', { preHandler: requireAuth }, async () => {
    void updateGeo(true);
    return { ok: true };
  });

  app.post('/api/password', { preHandler: requireAuth }, async (req: any, reply: FastifyReply) => {
    const { old, password } = req.body ?? {};
    if (checkPassword(req.ip, String(old ?? '')) !== 'ok') throw new AppError('badOldPassword', {}, 401);
    if (typeof password !== 'string' || password.length < 8) throw new AppError('passwordShort');
    settings.set('passwordHash', hashPassword(password));
    db.prepare('DELETE FROM sessions').run();
    createSession(reply);
    audit('password');
    return { ok: true };
  });

  app.get('/api/live', { websocket: true }, (socket, req) => {
    if (!isAuthed(req)) {
      socket.close(4401, 'unauthorized');
      return;
    }
    socket.send(JSON.stringify(engine.frame()));
    clients.add(socket);
    socket.on('close', () => clients.delete(socket));
  });

  const clients = new Set<{ send(d: string): void; readyState: number }>();
  setInterval(() => {
    if (!clients.size) return;
    const msg = JSON.stringify(engine.frame());
    for (const c of clients) if (c.readyState === 1) c.send(msg);
  }, 1000).unref();
}
