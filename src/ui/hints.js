import { buildLabels } from '../core/labels.js';
import { ensureRoot } from './root.js';

const HINT_KEY = /^[a-z0-9]$/i;

export function createHints({ doc, win, onActivate }) {
  const shadow = ensureRoot(doc);
  const layer = doc.createElement('div');
  layer.className = 'zbxvim-hints';
  shadow.appendChild(layer);

  let items = [];
  let typed = '';
  let active = false;
  let newTab = false;

  function reposition() {
    if (active) render();
  }

  function render() {
    layer.replaceChildren();
    for (const item of items) {
      if (!item.label.startsWith(typed)) continue;
      const rect = item.element.getBoundingClientRect();
      if (!rect || (rect.width === 0 && rect.height === 0)) continue;
      const tag = doc.createElement('span');
      tag.className = 'zbxvim-hint';
      tag.textContent = item.label;
      tag.style.left = `${Math.max(0, rect.left - 2)}px`;
      tag.style.top = `${Math.max(0, rect.top - 2)}px`;
      layer.appendChild(tag);
    }
  }

  function stop() {
    if (!active) return;
    active = false;
    items = [];
    typed = '';
    newTab = false;
    layer.replaceChildren();
    doc.removeEventListener('scroll', reposition, true);
    win.removeEventListener('resize', reposition);
  }

  function start(candidates, options = {}) {
    stop();
    if (!candidates || candidates.length === 0) return false;
    const labels = buildLabels(candidates.length);
    items = candidates.map((candidate, index) => ({ ...candidate, label: labels[index] }));
    typed = '';
    newTab = Boolean(options.newTab);
    active = true;
    doc.addEventListener('scroll', reposition, true);
    win.addEventListener('resize', reposition);
    render();
    return true;
  }

  function handleKey(key) {
    if (!active) return 'ignored';
    if (key === 'Escape') {
      stop();
      return 'cancel';
    }
    if (key === 'Backspace') {
      typed = typed.slice(0, -1);
      render();
      return 'typed';
    }
    if (!HINT_KEY.test(key)) return 'ignored';

    typed += key.toLowerCase();
    const matches = items.filter((item) => item.label.startsWith(typed));
    if (matches.length === 1 && matches[0].label === typed) {
      const [item] = matches;
      const options = { newTab };
      stop();
      onActivate(item, options);
      return 'activated';
    }
    if (matches.length === 0) {
      stop();
      return 'cancel';
    }
    render();
    return 'typed';
  }

  return {
    start,
    stop,
    handleKey,
    isActive: () => active,
  };
}
