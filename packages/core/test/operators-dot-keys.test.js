'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, sanitizeValue, handleRequest, NoSQLSanitizeError } = require('../src/index.js');

const opts = (o) => resolveOptions(o);

const rejects = (options, field) =>
  assert.throws(
    () => resolveOptions(options),
    (err) => err instanceof NoSQLSanitizeError && err.type === 'type_error' && err.message.includes(`"${field}"`),
  );

/* ───────────────── allowedOperators (S3 / F1) ───────────────── */

test('allowedOperators keeps listed operators verbatim', () => {
  const r = sanitizeValue({ $set: { name: 'x' }, $inc: { n: 1 } }, opts({ allowedOperators: ['$set'] }));
  assert.deepStrictEqual(r, { $set: { name: 'x' }, inc: { n: 1 } });
});

test('allowedOperators still sanitizes values and nested keys under the operator', () => {
  const r = sanitizeValue({ $set: { name: '$x', $where: 'sleep(1)' } }, opts({ allowedOperators: ['$set'] }));
  assert.deepStrictEqual(r, { $set: { name: 'x', where: 'sleep(1)' } });
});

test('allowedOperators applies at every depth and inside arrays', () => {
  const o = opts({ allowedOperators: ['$and', '$gt'] });
  const r = sanitizeValue({ $and: [{ age: { $gt: 18 } }, { role: { $ne: 'x' } }] }, o);
  assert.deepStrictEqual(r, { $and: [{ age: { $gt: 18 } }, { role: { ne: 'x' } }] });
});

test('allowedOperators is exact-match', () => {
  const r = sanitizeValue({ $SET: 1, $settings: 2 }, opts({ allowedOperators: ['$set'] }));
  assert.deepStrictEqual(r, { SET: 1, settings: 2 });
});

test('allowed operators pass the allowedKeys whitelist', () => {
  const o = opts({ allowedOperators: ['$set'], allowedKeys: ['name'] });
  const r = sanitizeValue({ $set: { name: 'x', role: 'admin' }, other: 1 }, o);
  assert.deepStrictEqual(r, { $set: { name: 'x' } });
});

test('deniedKeys wins over allowedOperators', () => {
  const r = sanitizeValue({ $set: { a: 1 } }, opts({ allowedOperators: ['$set'], deniedKeys: ['$set'] }));
  assert.deepStrictEqual(r, {});
});

test('removeMatches does not drop allowed operators', () => {
  const o = opts({ allowedOperators: ['$set'], removeMatches: true });
  const r = sanitizeValue({ $set: { a: 1 }, $inc: { b: 1 } }, o);
  assert.deepStrictEqual(r, { $set: { a: 1 } });
});

test('allowed operators fire no onSanitize event', () => {
  const events = [];
  const o = opts({ allowedOperators: ['$set'], onSanitize: (e) => events.push(e) });
  sanitizeValue({ $set: { a: 1 } }, o);
  assert.deepStrictEqual(events, []);
});

test('allowedOperators works through handleRequest', () => {
  const req = { body: { $set: { name: '$x' } }, query: {}, headers: { 'content-type': 'application/json' } };
  handleRequest(req, opts({ allowedOperators: ['$set'] }));
  assert.deepStrictEqual(req.body, { $set: { name: 'x' } });
});

test('allowedOperators is validated', () => {
  rejects({ allowedOperators: '$set' }, 'allowedOperators');
  rejects({ allowedOperators: ['set'] }, 'allowedOperators');
  rejects({ allowedOperators: [1] }, 'allowedOperators');
  rejects({ allowedOperators: ['$'] }, 'allowedOperators');
  assert.doesNotThrow(() => resolveOptions({ allowedOperators: [] }));
  assert.doesNotThrow(() => resolveOptions({ allowedOperators: null }));
});

/* ───────────────── dotKeys (S10 / F5) ───────────────── */

test("dotKeys: 'allow' keeps dotted keys", () => {
  const r = sanitizeValue({ 'profile.isAdmin': true }, opts({ dotKeys: 'allow' }));
  assert.deepStrictEqual(r, { 'profile.isAdmin': true });
});

test("dotKeys: 'replace' also applies to email-looking keys (values are untouched)", () => {
  const r = sanitizeValue({ 'ada@example.com': 'bob@example.com' }, opts());
  assert.deepStrictEqual(r, { 'ada@examplecom': 'bob@example.com' });
});

test("dotKeys: 'replace' replaces dots in keys with replaceWith", () => {
  assert.deepStrictEqual(sanitizeValue({ 'profile.isAdmin': true }, opts({ dotKeys: 'replace' })), {
    profileisAdmin: true,
  });
  assert.deepStrictEqual(sanitizeValue({ 'a.b.c': 1 }, opts({ dotKeys: 'replace', replaceWith: '_' })), {
    a_b_c: 1,
  });
});

test("dotKeys: 'remove' drops keys containing dots, at every depth", () => {
  const r = sanitizeValue({ user: { 'profile.isAdmin': true, name: 'a' }, ok: 1 }, opts({ dotKeys: 'remove' }));
  assert.deepStrictEqual(r, { user: { name: 'a' }, ok: 1 });
});

test('dotKeys leaves dots in values alone', () => {
  const r = sanitizeValue({ host: 'example.com' }, opts({ dotKeys: 'remove', preserveEmails: false }));
  assert.deepStrictEqual(r, { host: 'example.com' });
});

test("dotKeys: 'replace' cannot assemble a prototype key", () => {
  const r = sanitizeValue(JSON.parse('{"__pro.to__": {"isAdmin": true}, "ok": 1}'), opts({ dotKeys: 'replace' }));
  assert.deepStrictEqual(r, { ok: 1 });
  assert.strictEqual(Object.getPrototypeOf(r), Object.prototype);
});

test("dotKeys: 'remove' reports reason 'dotKey'", () => {
  const events = [];
  sanitizeValue({ 'a.b': 1 }, opts({ dotKeys: 'remove', onSanitize: (e) => events.push(e) }));
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'removed');
  assert.strictEqual(events[0].reason, 'dotKey');
  assert.strictEqual(events[0].key, 'a.b');
});

test("dotKeys: 'replace' reports a key rename", () => {
  const events = [];
  sanitizeValue({ 'a.b': 1 }, opts({ dotKeys: 'replace', onSanitize: (e) => events.push(e) }));
  assert.strictEqual(events.length, 1);
  assert.strictEqual(events[0].type, 'key');
  assert.strictEqual(events[0].sanitizedKey, 'ab');
});

test('dotKeys is validated', () => {
  rejects({ dotKeys: 'strip' }, 'dotKeys');
  rejects({ dotKeys: true }, 'dotKeys');
});

test("dotKeys: 'replace' inserts replaceWith literally", () => {
  const r = sanitizeValue({ 'a.b': 1 }, opts({ dotKeys: 'replace', replaceWith: '$&' }));
  assert.deepStrictEqual(Object.keys(r), ['a$&b']);
});
