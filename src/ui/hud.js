import { ensureRoot } from './root.js';

export function createHud(doc) {
  const shadow = ensureRoot(doc);
  const el = doc.createElement('div');
  el.className = 'zbxvim-hud zbxvim-hud--hidden';
  shadow.appendChild(el);

  function render(mode, detail = '') {
    el.textContent = detail ? `${mode} · ${detail}` : mode;
    el.classList.toggle('zbxvim-hud--hidden', mode === 'normal' && !detail);
  }

  return { render };
}
