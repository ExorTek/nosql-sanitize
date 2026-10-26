'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, sanitizeValue, NoSQLSanitizeError } = require('../src/index.js');

const opts = (o) => resolveOptions(o);
const input = () => ({ s: '', n: null, u: undefined, zero: 0, f: false, o: {}, a: [], d: new Date(0), ok: 'x' });

/* ───────────────── removeEmpty modes (B2) ───────────────── */

test("removeEmpty: 'falsy' removes every falsy value", () => {
  const r = sanitizeValue(input(), opts({ removeEmpty: 'falsy' }));
  assert.deepStrictEqual(Object.keys(r), ['o', 'a', 'd', 'ok']);
});

test("removeEmpty: true is the same as 'empty'", () => {
  assert.strictEqual(opts({ removeEmpty: true }).removeEmpty, 'empty');
  assert.deepStrictEqual(
    sanitizeValue(input(), opts({ removeEmpty: true })),
    sanitizeValue(input(), opts({ removeEmpty: 'empty' })),
  );
});

test("removeEmpty: 'empty' keeps 0 and false, drops '', null, undefined, {} and []", () => {
  const r = sanitizeValue(input(), opts({ removeEmpty: 'empty' }));
  assert.deepStrictEqual(r, { zero: 0, f: false, d: new Date(0), ok: 'x' });
});

test("removeEmpty: 'empty' drops values emptied by sanitization", () => {
  const r = sanitizeValue({ q: { $where: 'x' }, s: '$', keep: 1 }, opts({ removeEmpty: 'empty', removeMatches: true }));
  assert.deepStrictEqual(r, { keep: 1 });
});

test("removeEmpty: 'empty' still drops keys that sanitize to ''", () => {
  assert.deepStrictEqual(sanitizeValue({ $: 1, ok: 2 }, opts({ removeEmpty: 'empty' })), { ok: 2 });
});

/* ───────────────── filterNull modes (B3) ───────────────── */

const arr = () => [null, undefined, 0, '', false, 'x', 1];

test("filterNull: 'falsy' removes every falsy item", () => {
  assert.deepStrictEqual(sanitizeValue(arr(), opts({ arrayOptions: { filterNull: 'falsy' } })), ['x', 1]);
});

test("filterNull: true is the same as 'nullish'", () => {
  assert.strictEqual(opts({ arrayOptions: { filterNull: true } }).arrayOptions.filterNull, 'nullish');
  assert.deepStrictEqual(sanitizeValue(arr(), opts({ arrayOptions: { filterNull: true } })), [0, '', false, 'x', 1]);
});

test("filterNull: 'nullish' only removes null and undefined", () => {
  assert.deepStrictEqual(sanitizeValue(arr(), opts({ arrayOptions: { filterNull: 'nullish' } })), [
    0,
    '',
    false,
    'x',
    1,
  ]);
});

/* ───────────────── Validation ───────────────── */

const rejects = (options, field) =>
  assert.throws(
    () => resolveOptions(options),
    (err) => err instanceof NoSQLSanitizeError && err.type === 'type_error' && err.message.includes(`"${field}"`),
  );

test('removeEmpty and filterNull modes are validated', () => {
  rejects({ removeEmpty: 'nullish' }, 'removeEmpty');
  rejects({ removeEmpty: 1 }, 'removeEmpty');
  rejects({ arrayOptions: { filterNull: 'empty' } }, 'arrayOptions.filterNull');
  rejects({ arrayOptions: { filterNull: 'yes' } }, 'arrayOptions.filterNull');
});
