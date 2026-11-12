import { Mode, createModeState, isEditableElement } from '../core/modes.js';
import { createKeymap } from '../core/keymap.js';
import { findActionTarget, parseTarget } from '../core/pages.js';
import { detectZabbix } from '../zabbix/detect.js';
import {
  collectHintTargets,
  collectNavigationAnchors,
  findSearchInput,
} from '../zabbix/selectors.js';
import { createHints } from '../ui/hints.js';
import { createPalette } from '../ui/palette.js';
import { createHud } from '../ui/hud.js';

const HALF_PAGE = 0.85;
const SCROLL_STEP = 60;
const MESSAGE_TIMEOUT = 1600;

const NAV_BINDINGS = [
  ['gh', 'host.view'],
  ['gp', 'problem.view'],
  ['gl', 'latest.view'],
  ['gd', 'dashboard.view'],
  ['gm', 'map.view'],
];

function boot() {
  const win = window;
  const doc = document;

  if (win.top !== win.self) return;
  if (!detectZabbix(doc).isZabbix) return;

  const state = createModeState(Mode.NORMAL);
  const hud = createHud(doc);
  let messageTimer = 0;

  const hints = createHints({ doc, win, onActivate: activateTarget });
  const palette = createPalette({
    doc,
    onClose: () => {
      if (state.get() === Mode.PALETTE) state.set(Mode.NORMAL);
    },
  });

  function renderHud() {
    hud.render(state.get(), keymap.pending());
  }

  function message(text) {
    hud.render(state.get(), text);
    win.clearTimeout(messageTimer);
    messageTimer = win.setTimeout(renderHud, MESSAGE_TIMEOUT);
  }

  function activateTarget(item, options) {
    const element = item.element;
    if (options && options.newTab) {
      const href = element.href || (element.getAttribute && element.getAttribute('href'));
      if (href) {
        win.open(href, '_blank', 'noopener');
        return;
      }
    }
    if (typeof element.focus === 'function') element.focus({ preventScroll: true });
    if (typeof element.click === 'function') element.click();
  }

  function startHints(newTab) {
    const candidates = collectHintTargets(doc);
    if (!hints.start(candidates, { newTab })) {
      message('no hint targets');
      return;
    }
    state.set(Mode.HINT);
  }

  function stopHints() {
    hints.stop();
    if (state.get() === Mode.HINT) state.set(Mode.NORMAL);
  }

  function goToAction(action) {
    const target = findActionTarget(collectNavigationAnchors(doc), action);
    if (!target) {
      message(`no link for ${action}`);
      return;
    }
    win.location.assign(target.href);
  }

  function focusSearch() {
    const input = findSearchInput(doc);
    if (!input) {
      message('no search field');
      return;
    }
    input.focus();
    if (typeof input.select === 'function') input.select();
  }

  // Some navigation anchors have no text at all (icon-only menu toggles), so
  // the extracted label can be a raw URL. Fall back to the action name.
  function commandLabel(anchor, target) {
    const raw = (anchor.label || '').trim();
    const looksLikeUrl =
      raw === '' || /^(?:https?:\/\/|\/|zabbix\.php)/i.test(raw) || /\.php(?:[?#]|$)/i.test(raw);
    if (looksLikeUrl && target) return target.name;
    return raw || anchor.href;
  }

  function buildCommands() {
    const commands = [];
    const seen = new Set();
    for (const anchor of collectNavigationAnchors(doc)) {
      if (!anchor.label) continue;
      const target = parseTarget(anchor.href);
      // Deduplicate by action name: list pages link to hundreds of hosts, but
      // the palette only needs one entry per view.
      const key = target ? `${target.kind}:${target.name}` : anchor.href;
      if (seen.has(key)) continue;
      seen.add(key);
      commands.push({
        name: commandLabel(anchor, target),
        description: target ? target.name : anchor.href,
        run: () => win.location.assign(anchor.href),
      });
    }
    commands.push(
      { name: 'hints', description: 'hint mode (f)', run: () => startHints(false) },
      { name: 'hints-new-tab', description: 'hint mode in a new tab (F)', run: () => startHints(true) },
      { name: 'search', description: 'focus the Zabbix search field (/)', run: focusSearch },
      { name: 'top', description: 'scroll to top (gg)', run: () => win.scrollTo(0, 0) },
      {
        name: 'bottom',
        description: 'scroll to bottom (G)',
        run: () => win.scrollTo(0, doc.documentElement.scrollHeight),
      },
      { name: 'reload', description: 'reload the page', run: () => win.location.reload() },
    );
    return commands;
  }

  function openPalette() {
    const commands = buildCommands();
    if (commands.length === 0) return;
    state.set(Mode.PALETTE);
    palette.open(commands);
  }

  const bindings = {
    j: () => win.scrollBy(0, SCROLL_STEP),
    k: () => win.scrollBy(0, -SCROLL_STEP),
    d: () => win.scrollBy(0, Math.round(win.innerHeight * HALF_PAGE)),
    u: () => win.scrollBy(0, -Math.round(win.innerHeight * HALF_PAGE)),
    h: () => win.scrollBy(-SCROLL_STEP, 0),
    l: () => win.scrollBy(SCROLL_STEP, 0),
    gg: () => win.scrollTo(0, 0),
    G: () => win.scrollTo(0, doc.documentElement.scrollHeight),
    f: () => startHints(false),
    F: () => startHints(true),
    i: () => state.set(Mode.INSERT),
    ':': () => openPalette(),
    '/': () => focusSearch(),
    Escape: () => keymap.reset(),
  };

  for (const [sequence, action] of NAV_BINDINGS) {
    bindings[sequence] = () => goToAction(action);
  }

  const keymap = createKeymap(bindings);

  state.subscribe((mode) => {
    if (mode === Mode.NORMAL) keymap.reset();
    renderHud();
  });

  function onKeyDown(event) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    const mode = state.get();
    const key = event.key;

    if (mode === Mode.PALETTE) {
      if (key === 'Escape') {
        event.preventDefault();
        palette.close();
      }
      return;
    }

    if (mode === Mode.HINT) {
      const result = hints.handleKey(key);
      if (result !== 'ignored') {
        event.preventDefault();
        event.stopPropagation();
      }
      if (result === 'cancel') stopHints();
      return;
    }

    if (isEditableElement(event.target)) {
      if (mode !== Mode.INSERT) state.set(Mode.INSERT);
      if (key === 'Escape') {
        event.preventDefault();
        event.target.blur();
        state.set(Mode.NORMAL);
      }
      return;
    }

    if (mode === Mode.INSERT) {
      if (key === 'Escape') {
        event.preventDefault();
        state.set(Mode.NORMAL);
      }
      return;
    }

    const result = keymap.press(key);
    if (result.status !== 'none') {
      event.preventDefault();
      event.stopPropagation();
    }
    renderHud();
  }

  doc.addEventListener('keydown', onKeyDown, true);

  doc.addEventListener('focusin', (event) => {
    if (palette.isOpen() || hints.isActive()) return;
    if (isEditableElement(event.target)) state.set(Mode.INSERT);
  });

  doc.addEventListener('focusout', (event) => {
    if (!isEditableElement(event.target)) return;
    win.setTimeout(() => {
      if (palette.isOpen() || hints.isActive()) return;
      if (!isEditableElement(doc.activeElement)) state.set(Mode.NORMAL);
    }, 0);
  });

  doc.addEventListener(
    'click',
    () => {
      if (hints.isActive()) stopHints();
    },
    true,
  );
}

boot();
