'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { resolveOptions, handleRequest, NoSQLSanitizeError } = require('../src/index.js');

const jsonReq = (body, query = {}) => ({ headers: { 'content-type': 'application/json' }, body, query });

/* ───────────────── onInjection: 'reject' ───────────────── */

test("onInjection: 'reject' throws injection_detected with status 400", () => {
  const req = jsonReq({ user: { $ne: 'x' } });
  assert.throws(
    () => handleRequest(req, resolveOptions({ onInjection: 'reject' })),
    (err) =>
      err instanceof NoSQLSanitizeError &&
      err.type === 'injection_detected' &&
      err.statusCode === 400 &&
      err.message.includes('"body"'),
  );
  assert.deepStrictEqual(req.body, { user: { $ne: 'x' } });
});

test("onInjection: 'reject' checks query as well", () => {
  assert.throws(
    () => handleRequest(jsonReq({}, { q: '$where' }), resolveOptions({ onInjection: 'reject' })),
    (err) => err.type === 'injection_detected' && err.message.includes('"query"'),
  );
});

test("onInjection: 'reject' still applies other transforms to clean requests", () => {
  const req = jsonReq({ name: '  ADA  ', empty: '' });
  handleRequest(req, resolveOptions({ onInjection: 'reject', removeEmpty: true, stringOptions: { trim: true } }));
  assert.deepStrictEqual(req.body, { name: 'ADA' });
});

test("onInjection: 'reject' ignores bodies outside contentTypes", () => {
  const req = { headers: { 'content-type': 'text/plain' }, body: { $ne: 1 }, query: {} };
  assert.doesNotThrow(() => handleRequest(req, resolveOptions({ onInjection: 'reject' })));
});

test("onInjection: 'reject' honors allowedOperators", () => {
  const o = resolveOptions({ onInjection: 'reject', allowedOperators: ['$set'] });
  const req = jsonReq({ $set: { name: 'x' } });
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { $set: { name: 'x' } });
});

/* ───────────────── onInjection: 'report' ───────────────── */

test("onInjection: 'report' reports through onSanitize without changing the request", () => {
  const events = [];
  const req = jsonReq({ user: { $ne: 'x' } }, { q: '$where' });
  handleRequest(req, resolveOptions({ onInjection: 'report', onSanitize: (e) => events.push(e) }));
  assert.deepStrictEqual(req.body, { user: { $ne: 'x' } });
  assert.deepStrictEqual(req.query, { q: '$where' });
  assert.deepStrictEqual(
    events.map((e) => e.path),
    ['body.user.$ne', 'query.q'],
  );
});

test("onInjection: 'report' requires onSanitize", () => {
  assert.throws(
    () => resolveOptions({ onInjection: 'report' }),
    (err) => err.type === 'type_error' && err.message.includes('"onInjection"'),
  );
});

/* ───────────────── default and validation ───────────────── */

test("onInjection defaults to 'sanitize'", () => {
  const req = jsonReq({ user: { $ne: 'x' } });
  handleRequest(req, resolveOptions());
  assert.deepStrictEqual(req.body, { user: { ne: 'x' } });
});

test('onInjection is validated', () => {
  assert.throws(
    () => resolveOptions({ onInjection: 'block' }),
    (err) => err.type === 'type_error' && err.message.includes('"onInjection"'),
  );
});
