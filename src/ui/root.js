const STYLE = `
.zbxvim-hud {
  position: fixed;
  right: 12px;
  bottom: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  background: #2b2b2b;
  color: #f5f5f5;
  font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  opacity: 0.9;
  pointer-events: none;
}
.zbxvim-hud--hidden { display: none; }
.zbxvim-hints { position: fixed; inset: 0; pointer-events: none; }
.zbxvim-hint {
  position: absolute;
  padding: 1px 4px;
  border: 1px solid #b28704;
  border-radius: 3px;
  background: #ffd54f;
  color: #000;
  font: 600 11px/1.2 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.4);
}
.zbxvim-palette {
  position: fixed;
  top: 18%;
  left: 50%;
  width: min(560px, 80vw);
  transform: translateX(-50%);
  border: 1px solid #444;
  border-radius: 6px;
  background: #1f1f1f;
  color: #eee;
  font: 13px/1.4 system-ui, sans-serif;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  pointer-events: auto;
  overflow: hidden;
}
.zbxvim-palette--hidden { display: none; }
.zbxvim-palette__input {
  box-sizing: border-box;
  width: 100%;
  padding: 10px 12px;
  border: 0;
  outline: none;
  background: #2a2a2a;
  color: #fff;
  font: inherit;
}
.zbxvim-palette__list {
  max-height: 40vh;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  list-style: none;
}
.zbxvim-palette__item { padding: 6px 12px; cursor: pointer; }
.zbxvim-palette__item span { display: block; color: #999; font-size: 11px; }
.zbxvim-palette__item.is-selected { background: #3a3a3a; }
`;

const roots = new WeakMap();

export function ensureRoot(doc) {
  const existing = roots.get(doc);
  if (existing) return existing;

  const host = doc.createElement('div');
  host.id = 'zbxvim-root';
  host.setAttribute(
    'style',
    'all: initial; position: fixed; inset: 0; pointer-events: none; z-index: 2147483647;',
  );
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = STYLE;
  shadow.appendChild(style);
  (doc.body || doc.documentElement).appendChild(host);

  roots.set(doc, shadow);
  return shadow;
}
