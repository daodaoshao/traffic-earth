import './styles.css';
import { api } from './api';
import { showGlobe } from './globe';
import { applyDocument } from './i18n';
import { showSettings } from './settings';
import { showLogin, showSetup } from './setup';

const root = document.getElementById('app')!;
let cleanup: (() => void) | undefined;
let lastView = '';

async function route(force = false) {
  const state = await api<{ setupDone: boolean; authed: boolean; passwordPreset: boolean }>('/api/state');
  const hash = location.hash || '#/';
  let view: string;
  if (!state.setupDone) view = 'setup';
  else if (!state.authed) view = 'login';
  else if (hash.startsWith('#/settings')) view = hash;
  else view = 'globe';

  // The globe is expensive to rebuild; keep it unless something really changed.
  if (!force && view === lastView && view === 'globe') return;
  cleanup?.();
  cleanup = undefined;
  lastView = view;
  document.body.classList.toggle('scrollable', view !== 'globe');

  if (view === 'setup') showSetup(root, state.passwordPreset);
  else if (view === 'login') showLogin(root);
  else if (view === 'globe') cleanup = await showGlobe(root);
  else await showSettings(root, hash.split('/')[2] ?? 'sources');
}

applyDocument();
// Settings pages re-render after saves via a synthetic hashchange; the globe stays put.
window.addEventListener('hashchange', () => void route(lastView !== 'globe'));
// Every piece of text is rendered through t(), so a language switch rebuilds the view.
window.addEventListener('langchange', () => void route(true));
void route();
