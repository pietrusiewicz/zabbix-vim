// Maps multi-key sequences (e.g. "gg", "gh") to actions and resolves them one
// key at a time. An exact match wins over a shorter prefix.
export function createKeymap(bindings = {}) {
  const map = new Map(Object.entries(bindings));
  const prefixes = new Set();
  for (const sequence of map.keys()) {
    for (let length = 1; length < sequence.length; length += 1) {
      prefixes.add(sequence.slice(0, length));
    }
  }
  let pending = '';

  return {
    pending() {
      return pending;
    },
    reset() {
      pending = '';
    },
    press(key) {
      const candidate = pending + key;
      if (map.has(candidate)) {
        pending = '';
        map.get(candidate)();
        return { status: 'match', sequence: candidate };
      }
      if (prefixes.has(candidate)) {
        pending = candidate;
        return { status: 'prefix', sequence: candidate };
      }
      pending = '';
      return { status: 'none', sequence: candidate };
    },
  };
}
