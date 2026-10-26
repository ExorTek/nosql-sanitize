'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, sanitizeObject, sanitizeString, log, NoSQLSanitizeError } = require('../src/index.js');

const opts = (o) => resolveOptions(o);

// Collects everything written through console.log while fn runs
const captureLogs = (fn) => {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines.join('\n');
};

/* ───────────────── stringOptions apply to values only (B1) ───────────────── */

test('stringOptions.lowercase leaves keys alone', () => {
  const r = sanitizeObject({ userName: 'ADA' }, opts({ stringOptions: { lowercase: true } }), 0);
  assert.deepStrictEqual(r, { userName: 'ada' });
});

test('stringOptions.trim leaves keys alone', () => {
  const r = sanitizeObject({ ' padded ': '  value  ' }, opts({ stringOptions: { trim: true } }), 0);
  assert.deepStrictEqual(r, { ' padded ': 'value' });
});

test('stringOptions still apply to nested and array values', () => {
  const o = opts({ stringOptions: { trim: true, lowercase: true } });
  const r = sanitizeObject({ Tags: [' A ', 'B'], Profile: { City: ' PARIS ' } }, o, 0);
  assert.deepStrictEqual(r, { Tags: ['a', 'b'], Profile: { City: 'paris' } });
});

test('keys are still stripped of $ with stringOptions set', () => {
  const r = sanitizeObject({ $Where: 'X' }, opts({ stringOptions: { lowercase: true } }), 0);
  assert.deepStrictEqual(r, { Where: 'x' });
});

/* ───────────────── Logging hygiene (S11) ───────────────── */

const verbose = { enabled: true, level: 'trace' };

test('sanitized values are not logged by default, even at trace level', () => {
  const out = captureLogs(() => sanitizeString('$secret-token', opts({ debug: verbose }), true));
  assert.ok(!out.includes('secret-token'), out);
});

test('logPatternMatches logs the match without the value', () => {
  const out = captureLogs(() =>
    sanitizeString('$secret-token', opts({ debug: { ...verbose, logPatternMatches: true } }), true),
  );
  assert.match(out, /Pattern matched/);
  assert.ok(!out.includes('secret-token'), out);
});

test('logSanitizedValues logs original and result', () => {
  const out = captureLogs(() =>
    sanitizeString('$secret-token', opts({ debug: { ...verbose, logSanitizedValues: true } }), true),
  );
  assert.ok(out.includes('$secret-token'), out);
  assert.ok(out.includes('"secret-token"'), out);
});

test('log does not throw on circular or BigInt data', () => {
  const circular = { a: 1 };
  circular.self = circular;
  const out = captureLogs(() => {
    log(verbose, 'info', 'TEST', 'circular', circular);
    log(verbose, 'info', 'TEST', 'bigint', { n: 10n });
  });
  assert.match(out, /circular/);
  assert.match(out, /bigint/);
});

/* ───────────────── Nested option validation (B4) ───────────────── */

const rejects = (options, field) =>
  assert.throws(
    () => resolveOptions(options),
    (err) => err instanceof NoSQLSanitizeError && err.type === 'type_error' && err.message.includes(`"${field}"`),
  );

test('debug fields are validated', () => {
  rejects({ debug: { level: 'bogus' } }, 'debug.level');
  rejects({ debug: { enabled: 'yes' } }, 'debug.enabled');
  rejects({ debug: { logPatternMatches: 1 } }, 'debug.logPatternMatches');
  rejects({ debug: { logSanitizedValues: 'true' } }, 'debug.logSanitizedValues');
  rejects({ debug: { logSkippedRoutes: null } }, 'debug.logSkippedRoutes');
});

test('stringOptions fields are validated', () => {
  rejects({ stringOptions: { trim: 'true' } }, 'stringOptions.trim');
  rejects({ stringOptions: { lowercase: 1 } }, 'stringOptions.lowercase');
  for (const maxLength of [-1, 0, 1.5, '5', NaN, Infinity]) {
    rejects({ stringOptions: { maxLength } }, 'stringOptions.maxLength');
  }
});

test('arrayOptions fields are validated', () => {
  rejects({ arrayOptions: { filterNull: 1 } }, 'arrayOptions.filterNull');
  rejects({ arrayOptions: { distinct: 'yes' } }, 'arrayOptions.distinct');
});

test('valid nested options still resolve', () => {
  const o = resolveOptions({
    debug: { enabled: true, level: 'silent', logPatternMatches: true, logSanitizedValues: false },
    stringOptions: { trim: true, lowercase: false, maxLength: 10 },
    arrayOptions: { filterNull: true, distinct: false },
  });
  assert.strictEqual(o.stringOptions.maxLength, 10);
  assert.strictEqual(o.debug.level, 'silent');
  assert.doesNotThrow(() => resolveOptions({ stringOptions: { maxLength: null } }));
});
