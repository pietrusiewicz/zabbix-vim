import test from 'node:test';
import assert from 'node:assert/strict';

import { createKeymap } from '../src/core/keymap.js';

function fixture() {
  const calls = [];
  const keymap = createKeymap({
    j: () => calls.push('j'),
    gg: () => calls.push('gg'),
    gh: () => calls.push('gh'),
  });
  return { calls, keymap };
}

test('runs an exact single-key binding', () => {
  const { calls, keymap } = fixture();
  assert.equal(keymap.press('j').status, 'match');
  assert.deepEqual(calls, ['j']);
});

test('holds a prefix until the next key resolves it', () => {
  const { calls, keymap } = fixture();
  assert.equal(keymap.press('g').status, 'prefix');
  assert.equal(keymap.pending(), 'g');
  assert.deepEqual(calls, []);
  assert.equal(keymap.press('g').status, 'match');
  assert.deepEqual(calls, ['gg']);
  assert.equal(keymap.pending(), '');
});

test('resolves different sequences after the same prefix', () => {
  const { calls, keymap } = fixture();
  keymap.press('g');
  keymap.press('h');
  assert.deepEqual(calls, ['gh']);
});

test('drops the pending sequence on an unknown key', () => {
  const { calls, keymap } = fixture();
  keymap.press('g');
  assert.equal(keymap.press('x').status, 'none');
  assert.equal(keymap.pending(), '');
  assert.equal(keymap.press('g').status, 'prefix');
  assert.deepEqual(calls, []);
});

test('reset clears the pending sequence', () => {
  const { keymap } = fixture();
  keymap.press('g');
  keymap.reset();
  assert.equal(keymap.pending(), '');
  assert.equal(keymap.press('j').status, 'match');
});
