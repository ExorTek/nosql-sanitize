'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, sanitize, sanitizeValue, DEFAULT_OPTIONS } = require('../src/index.js');

const opts = (o) => resolveOptions(o);

// { a: { a: { … { leaf } } } } with `depth` levels of nesting
const nested = (depth, leaf) => {
  let value = leaf;
  for (let i = 0; i < depth; i++) value = { a: value };
  return value;
};

/* ───────────────── maxDepth: 32 + 'remove' (fail-closed) ───────────────── */

test('maxDepth defaults to 32 with maxDepthBehavior: remove', () => {
  assert.strictEqual(DEFAULT_OPTIONS.maxDepth, 32);
  assert.strictEqual(DEFAULT_OPTIONS.maxDepthBehavior, 'remove');
});

test('payloads deeper than 32 levels lose the over-depth part instead of passing raw', () => {
  const out = sanitize(nested(40, { $where: 'x' }));
  assert.ok(!JSON.stringify(out).includes('$where'));
  assert.ok(!JSON.stringify(out).includes('where'));
});

test('payloads within 32 levels are sanitized as before', () => {
  assert.deepStrictEqual(sanitize(nested(20, { $where: 'x' })), nested(20, { where: 'x' }));
});

test("maxDepth: null still means no limit (hard ceiling) and 'preserve' can be opted into", () => {
  assert.deepStrictEqual(sanitize(nested(40, { $a: 1 }), { maxDepth: null }), nested(40, { a: 1 }));
  const raw = nested(3, { $a: 1 });
  assert.deepStrictEqual(sanitize(raw, { maxDepth: 1, maxDepthBehavior: 'preserve' }), raw);
});

/* ───────────────── deniedKeys beat preserveEmails ───────────────── */

test('a denied key is removed even when its value looks like an email', () => {
  const out = sanitizeValue({ email: 'ada@example.com', name: 'Ada' }, opts({ deniedKeys: ['email'] }));
  assert.deepStrictEqual(out, { name: 'Ada' });
});

test('preserveEmails still exempts email values of other keys', () => {
  const out = sanitizeValue({ contact: 'ada@example.com' }, opts({ deniedKeys: ['email'], patterns: [/@/] }));
  assert.deepStrictEqual(out, { contact: 'ada@example.com' });
});

/* ───────────────── removeEmpty / filterNull: true ───────────────── */

const input = () => ({ s: '', n: null, u: undefined, zero: 0, f: false, o: {}, a: [], ok: 'x' });

test("removeEmpty: true means 'empty' (keeps 0 and false)", () => {
  assert.deepStrictEqual(sanitizeValue(input(), opts({ removeEmpty: true })), { zero: 0, f: false, ok: 'x' });
});

test("removeEmpty: 'falsy' keeps the v3 behavior", () => {
  assert.deepStrictEqual(Object.keys(sanitizeValue(input(), opts({ removeEmpty: 'falsy' }))), ['o', 'a', 'ok']);
});

test("filterNull: true means 'nullish' (keeps 0, false and '')", () => {
  const out = sanitizeValue({ list: [0, false, '', null, undefined, 1] }, opts({ arrayOptions: { filterNull: true } }));
  assert.deepStrictEqual(out, { list: [0, false, '', 1] });
});

test("filterNull: 'falsy' keeps the v3 behavior", () => {
  const out = sanitizeValue({ list: [0, false, '', null, 1] }, opts({ arrayOptions: { filterNull: 'falsy' } }));
  assert.deepStrictEqual(out, { list: [1] });
});

/* ───────────────── dotKeys: 'replace' ───────────────── */

test("dotKeys defaults to 'replace'", () => {
  assert.strictEqual(DEFAULT_OPTIONS.dotKeys, 'replace');
  assert.deepStrictEqual(sanitize({ 'profile.isAdmin': true }), { profileisAdmin: true });
  assert.deepStrictEqual(sanitize({ 'a.b': 1 }, { replaceWith: '_' }), { a_b: 1 });
});

test("dotKeys: 'allow' keeps dotted keys", () => {
  assert.deepStrictEqual(sanitize({ 'a.b': 1 }, { dotKeys: 'allow' }), { 'a.b': 1 });
});
