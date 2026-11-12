import test from 'node:test';
import assert from 'node:assert/strict';

import { Mode, createModeState, isEditableElement } from '../src/core/modes.js';

test('treats text inputs as editable', () => {
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'text' }), true);
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'search' }), true);
  assert.equal(isEditableElement({ tagName: 'INPUT' }), true);
});

test('ignores non-text inputs', () => {
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'button' }), false);
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'checkbox' }), false);
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'submit' }), false);
});

test('treats textarea and select as editable, unless disabled', () => {
  assert.equal(isEditableElement({ tagName: 'TEXTAREA' }), true);
  assert.equal(isEditableElement({ tagName: 'TEXTAREA', disabled: true }), false);
  assert.equal(isEditableElement({ tagName: 'SELECT' }), true);
});

test('treats disabled or readonly inputs as not editable', () => {
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'text', disabled: true }), false);
  assert.equal(isEditableElement({ tagName: 'INPUT', type: 'text', readOnly: true }), false);
});

test('treats contenteditable elements as editable', () => {
  assert.equal(isEditableElement({ tagName: 'DIV', isContentEditable: true }), true);
  assert.equal(isEditableElement({ tagName: 'DIV', isContentEditable: false }), false);
});

test('handles missing nodes', () => {
  assert.equal(isEditableElement(null), false);
  assert.equal(isEditableElement({}), false);
});

test('notifies subscribers only on actual transitions', () => {
  const state = createModeState();
  const seen = [];
  state.subscribe((mode) => seen.push(mode));

  state.set(Mode.HINT);
  state.set(Mode.HINT);
  state.set(Mode.NORMAL);

  assert.deepEqual(seen, [Mode.HINT, Mode.NORMAL]);
  assert.equal(state.get(), Mode.NORMAL);
});
