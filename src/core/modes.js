export const Mode = Object.freeze({
  NORMAL: 'normal',
  INSERT: 'insert',
  HINT: 'hint',
  PALETTE: 'palette',
});

const NON_TEXT_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);

export function isEditableElement(el) {
  if (!el || typeof el.tagName !== 'string') return false;
  const tag = el.tagName.toUpperCase();
  if (tag === 'TEXTAREA' || tag === 'SELECT') return !el.disabled;
  if (tag === 'INPUT') {
    const type = String(el.type || 'text').toLowerCase();
    return !NON_TEXT_INPUT_TYPES.has(type) && !el.disabled && !el.readOnly;
  }
  return el.isContentEditable === true;
}

export function createModeState(initial = Mode.NORMAL) {
  let mode = initial;
  const listeners = new Set();
  return {
    get() {
      return mode;
    },
    set(next) {
      if (next === mode) return;
      mode = next;
      for (const listener of listeners) listener(mode);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
