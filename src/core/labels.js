// Home-row first, matching the muscle memory of Vimium-style hint labels.
export const DEFAULT_ALPHABET = 'asdfghjklqwertyuiopzxcvbnm';

export function buildLabels(count, options = {}) {
  const alphabet = options.alphabet || DEFAULT_ALPHABET;
  const chars = [...new Set(alphabet)];
  if (count <= 0) return [];
  if (count <= chars.length) return chars.slice(0, count);

  // Fixed width keeps the label set prefix-free, so every keystroke narrows
  // the candidates without ever resolving ambiguously.
  const width = Math.max(1, Math.ceil(Math.log(count) / Math.log(chars.length)));
  const labels = [];
  for (let index = 0; index < count; index += 1) {
    let value = index;
    let label = '';
    for (let position = 0; position < width; position += 1) {
      label = chars[value % chars.length] + label;
      value = Math.floor(value / chars.length);
    }
    labels.push(label);
  }
  return labels;
}
