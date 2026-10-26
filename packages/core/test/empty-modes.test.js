'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, sanitizeValue, NoSQLSanitizeError } = require('../src/index.js');

const opts = (o) => resolveOptions(o);
const input = () => ({ s: '', n: null, u: undefined, zero: 0, f: false, o: {}, a: [], d: new Date(0), ok: 'x' });

/* ───────────────── removeEmpty modes (B2) ───────────────── */

test('removeEmpty: true keeps removing falsy values (unchanged)', () => {
  const r = sanitizeValue(input(), opts({ removeEmpty: true }));
  assert.deepStrictEqual(Object.keys(r), ['o', 'a', 'd', 'ok']);
});

test("removeEmpty: 'falsy' is the same as true", () => {
  assert.deepStrictEqual(
    sanitizeValue(input(), opts({ removeEmpty: 'falsy' })),
    sanitizeValue(input(), opts({ removeEmpty: true })),
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

test('filterNull: true keeps removing falsy items (unchanged)', () => {
  assert.deepStrictEqual(sanitizeValue(arr(), opts({ arrayOptions: { filterNull: true } })), ['x', 1]);
});

test("filterNull: 'falsy' is the same as true", () => {
  assert.deepStrictEqual(sanitizeValue(arr(), opts({ arrayOptions: { filterNull: 'falsy' } })), ['x', 1]);
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
