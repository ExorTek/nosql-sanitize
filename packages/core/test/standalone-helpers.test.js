'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { sanitize, hasInjection, resolveOptions, NoSQLSanitizeError } = require('../src/index.js');

/* ───────────────── sanitize ───────────────── */

test('sanitize works with no options', () => {
  assert.deepStrictEqual(sanitize({ user: { $ne: 'x' } }), { user: { ne: 'x' } });
  assert.strictEqual(sanitize('$where'), 'where');
});

test('sanitize accepts user options', () => {
  assert.deepStrictEqual(sanitize({ $gt: 1 }, { replaceWith: '_' }), { _gt: 1 });
});

test('sanitize accepts resolved options', () => {
  assert.deepStrictEqual(sanitize({ $gt: 1 }, resolveOptions({ replaceWith: '_' })), { _gt: 1 });
});

test('sanitize does not mutate its input', () => {
  const input = { a: { $b: 'c' } };
  sanitize(input);
  assert.deepStrictEqual(input, { a: { $b: 'c' } });
});

test('sanitize returns an empty container when the root itself is dropped', () => {
  const o = { maxDepth: 0, maxDepthBehavior: 'remove' };
  assert.deepStrictEqual(sanitize({ a: 1 }, o), {});
  assert.deepStrictEqual(sanitize([1], o), []);
});

test('sanitize validates options', () => {
  assert.throws(() => sanitize({}, { patterns: 'x' }), NoSQLSanitizeError);
});

test('sanitize resolves an options object once and reuses it', () => {
  const o = { replaceWith: '_' };
  assert.deepStrictEqual(sanitize({ $a: 1 }, o), { _a: 1 });
  assert.deepStrictEqual(sanitize({ $b: 1 }, o), { _b: 1 });
});

/* ───────────────── hasInjection ───────────────── */

test('hasInjection is false for clean data', () => {
  assert.strictEqual(hasInjection({ name: 'ada', tags: ['a', 'b'], n: 1, d: new Date(), ok: null }), false);
  assert.strictEqual(hasInjection('hello'), false);
  assert.strictEqual(hasInjection(42), false);
});

test('hasInjection finds operator keys and values at any depth', () => {
  assert.strictEqual(hasInjection({ user: { $ne: 'x' } }), true);
  assert.strictEqual(hasInjection({ q: [{ a: [{ name: '$where' }] }] }), true);
  assert.strictEqual(hasInjection('$gt'), true);
});

test('hasInjection finds control characters', () => {
  assert.strictEqual(hasInjection({ name: 'a\u0000b' }), true);
});

test('hasInjection finds prototype keys unless allowPrototypeKeys', () => {
  const payload = JSON.parse('{"__proto__": {"isAdmin": true}}');
  assert.strictEqual(hasInjection(payload), true);
  assert.strictEqual(hasInjection({ constructor: 'x' }), true);
  assert.strictEqual(hasInjection({ constructor: 'x' }, { allowPrototypeKeys: true }), false);
});

test('hasInjection exempts emails with preserveEmails', () => {
  assert.strictEqual(hasInjection({ email: 'a$b@example.com' }), false);
  assert.strictEqual(hasInjection({ email: 'a$b@example.com' }, { preserveEmails: false }), true);
});

test('hasInjection ignores allowed operators but checks their contents', () => {
  const o = { allowedOperators: ['$set'] };
  assert.strictEqual(hasInjection({ $set: { name: 'x' } }, o), false);
  assert.strictEqual(hasInjection({ $set: { $where: 'x' } }, o), true);
});

test('hasInjection skips keys the sanitizer drops by configuration', () => {
  assert.strictEqual(hasInjection({ secret: { $ne: 1 } }, { deniedKeys: ['secret'] }), false);
  assert.strictEqual(hasInjection({ other: { $ne: 1 }, name: 'x' }, { allowedKeys: ['name'] }), false);
});

test('hasInjection flags dotted keys only when dotKeys is not allow', () => {
  assert.strictEqual(hasInjection({ 'profile.isAdmin': true }), false);
  assert.strictEqual(hasInjection({ 'profile.isAdmin': true }, { dotKeys: 'remove' }), true);
  assert.strictEqual(hasInjection({ 'profile.isAdmin': true }, { dotKeys: 'replace' }), true);
});

test('hasInjection ignores maxDepth and recursive', () => {
  const deep = { a: { b: { c: { $ne: 1 } } } };
  assert.strictEqual(hasInjection(deep, { maxDepth: 1 }), true);
  assert.strictEqual(hasInjection(deep, { recursive: false }), true);
});

test('hasInjection honors custom patterns', () => {
  assert.strictEqual(hasInjection({ q: 'DROP table' }, { patterns: [/drop/i] }), true);
  assert.strictEqual(hasInjection({ q: '$x' }, { patterns: [/drop/i] }), false);
});

test('hasInjection handles circular references', () => {
  const a = { name: 'x' };
  a.self = a;
  assert.strictEqual(hasInjection(a), false);
  a.bad = '$x';
  assert.strictEqual(hasInjection(a), true);
});

test('hasInjection throws max_depth on hostile nesting', () => {
  let deep = {};
  const root = deep;
  for (let i = 0; i < 300; i++) deep = deep.n = {};
  assert.throws(
    () => hasInjection(root),
    (err) => err instanceof NoSQLSanitizeError && err.type === 'max_depth',
  );
});
