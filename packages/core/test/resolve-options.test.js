'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, sanitizeValue, DEFAULT_OPTIONS } = require('../src/index.js');

test('options set to undefined fall back to their defaults', () => {
  const r = resolveOptions({
    replaceWith: undefined,
    recursive: undefined,
    preserveEmails: undefined,
    maxDepthBehavior: undefined,
    dotKeys: undefined,
    maxDepth: undefined,
    onSanitize: undefined,
  });
  assert.strictEqual(r.replaceWith, DEFAULT_OPTIONS.replaceWith);
  assert.strictEqual(r.recursive, true);
  assert.strictEqual(r.preserveEmails, true);
  assert.strictEqual(r.maxDepthBehavior, DEFAULT_OPTIONS.maxDepthBehavior);
  assert.strictEqual(r.dotKeys, 'allow');
  assert.strictEqual(r.maxDepth, null);
  assert.strictEqual(r.onSanitize, null);
});

test('recursive: undefined still sanitizes nested objects', () => {
  const r = sanitizeValue({ user: { $ne: 'x' } }, resolveOptions({ recursive: undefined }));
  assert.deepStrictEqual(r, { user: { ne: 'x' } });
});

test('replaceWith: undefined strips instead of inserting "undefined"', () => {
  assert.deepStrictEqual(sanitizeValue({ a: '$x' }, resolveOptions({ replaceWith: undefined })), { a: 'x' });
});

test('nested options set to undefined fall back to their defaults', () => {
  const r = resolveOptions({
    debug: { level: undefined, enabled: undefined },
    stringOptions: { maxLength: undefined },
    arrayOptions: { distinct: undefined },
  });
  assert.strictEqual(r.debug.level, 'info');
  assert.strictEqual(r.debug.enabled, false);
  assert.strictEqual(r.stringOptions.maxLength, null);
  assert.strictEqual(r.arrayOptions.distinct, false);
});

test('array and list options set to undefined fall back to their defaults', () => {
  const r = resolveOptions({
    sanitizeObjects: undefined,
    contentTypes: undefined,
    patterns: undefined,
    skipRoutes: undefined,
    allowedKeys: undefined,
  });
  assert.deepStrictEqual(r.sanitizeObjects, ['body', 'query']);
  assert.ok(r.contentTypes.has('application/json'));
  assert.strictEqual(r.skipRoutes.exact.size, 0);
  assert.strictEqual(r.allowedKeys.size, 0);
  assert.deepStrictEqual(sanitizeValue('$x', r), 'x');
});
