import test from 'node:test';
import assert from 'node:assert/strict';

import { buildLabels, DEFAULT_ALPHABET } from '../src/core/labels.js';

test('returns one label per target', () => {
  assert.equal(buildLabels(5).length, 5);
});

test('returns no labels for no targets', () => {
  assert.deepEqual(buildLabels(0), []);
});

test('uses single characters while they fit the alphabet', () => {
  const labels = buildLabels(10);
  assert.ok(labels.every((label) => label.length === 1));
  assert.equal(new Set(labels).size, labels.length);
});

test('grows to two characters past the alphabet size', () => {
  const labels = buildLabels(DEFAULT_ALPHABET.length + 4);
  assert.ok(labels.every((label) => label.length === 2));
  assert.equal(new Set(labels).size, labels.length);
});

test('labels are prefix-free so typing never resolves ambiguously', () => {
  const labels = buildLabels(40);
  for (const label of labels) {
    for (const other of labels) {
      if (label === other) continue;
      assert.ok(!other.startsWith(label), `${other} is prefixed by ${label}`);
    }
  }
});
