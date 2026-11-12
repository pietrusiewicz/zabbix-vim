import { ensureRoot } from './root.js';

const MAX_VISIBLE = 50;

export function createPalette({ doc, onClose }) {
  const shadow = ensureRoot(doc);
  const layer = doc.createElement('div');
  layer.className = 'zbxvim-palette zbxvim-palette--hidden';

  const input = doc.createElement('input');
  input.className = 'zbxvim-palette__input';
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.placeholder = 'type a command…';

  const list = doc.createElement('ul');
  list.className = 'zbxvim-palette__list';

  layer.append(input, list);
  shadow.appendChild(layer);

  let commands = [];
  let filtered = [];
  let selected = 0;
  let open = false;

  function renderList() {
    list.replaceChildren();
    filtered.slice(0, MAX_VISIBLE).forEach((command, index) => {
      const item = doc.createElement('li');
      item.className =
        index === selected ? 'zbxvim-palette__item is-selected' : 'zbxvim-palette__item';
      item.textContent = command.name;
      if (command.description) {
        const hint = doc.createElement('span');
        hint.textContent = command.description;
        item.appendChild(hint);
      }
      item.addEventListener('mousedown', (event) => {
        event.preventDefault();
        selected = index;
        pick();
      });
      list.appendChild(item);
    });
  }

  function applyFilter() {
    const query = input.value.trim().toLowerCase();
    filtered = commands.filter(
      (command) =>
        !query ||
        command.name.toLowerCase().includes(query) ||
        String(command.description || '').toLowerCase().includes(query),
    );
    selected = 0;
    renderList();
  }

  function pick() {
    const command = filtered[selected];
    if (!command) return;
    close();
    if (typeof command.run === 'function') command.run();
  }

  function openPalette(next) {
    commands = next;
    filtered = commands;
    selected = 0;
    input.value = '';
    open = true;
    layer.classList.remove('zbxvim-palette--hidden');
    renderList();
    input.focus();
  }

  function close() {
    if (!open) return;
    open = false;
    layer.classList.add('zbxvim-palette--hidden');
    input.blur();
    if (typeof onClose === 'function') onClose();
  }

  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      selected = Math.min(selected + 1, Math.max(0, filtered.length - 1));
      renderList();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      selected = Math.max(selected - 1, 0);
      renderList();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      pick();
    }
  });

  return {
    open: openPalette,
    close,
    isOpen: () => open,
  };
}
