import './styles.css';
import { api } from './api';
import { showGlobe } from './globe';
import { showSettings } from './settings';
import { showLogin, showSetup } from './setup';

const root = document.getElementById('app')!;
let cleanup: (() => void) | undefined;
let lastView = '';

async function route() {
  const state = await api<{ setupDone: boolean; authed: boolean; passwordPreset: boolean }>('/api/state');
  const hash = location.hash || '#/';
  let view: string;
  if (!state.setupDone) view = 'setup';
  else if (!state.authed) view = 'login';
  else if (hash.startsWith('#/settings')) view = hash;
  else view = 'globe';

  // The globe is expensive to rebuild; keep it when nothing changed.
  if (view === lastView && view === 'globe') return;
  cleanup?.();
  cleanup = undefined;
  lastView = view;
  document.body.style.overflow = view === 'globe' ? '' : 'auto';

  if (view === 'setup') showSetup(root, state.passwordPreset);
  else if (view === 'login') showLogin(root);
  else if (view === 'globe') cleanup = await showGlobe(root);
  else await showSettings(root, hash.split('/')[2] ?? 'sources');
}

window.addEventListener('hashchange', () => {
  // Re-render settings sections even if the hash didn't change (after saves).
  lastView = lastView === 'globe' ? 'globe' : '';
  void route();
});
void route();
