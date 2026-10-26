'use strict';

const { test } = require('node:test');
const assert = require('node:assert');

const core = require('@exortek/nosql-sanitize-core');

// Loads the middleware with a spy on core.resolveOptions (the adapter reads it at require time)
const loadWithSpy = () => {
  const calls = [];
  const original = core.resolveOptions;
  core.resolveOptions = (o) => {
    calls.push(o);
    return original(o);
  };
  const srcPath = require.resolve('../src');
  delete require.cache[srcPath];
  try {
    return { mod: require('../src'), calls };
  } finally {
    core.resolveOptions = original;
    delete require.cache[srcPath];
  }
};

const fakeReq = () => ({ path: '/', url: '/', headers: {}, body: { a: '$x' }, query: {} });

test('manual mode resolves each custom options object once', () => {
  const { mod, calls } = loadWithSpy();
  const middleware = mod.expressMongoSanitize({ mode: 'manual' });
  const custom = { replaceWith: '_' };
  const before = calls.length;

  for (let i = 0; i < 3; i++) {
    const req = fakeReq();
    middleware(req, {}, () => {});
    req.sanitize(custom);
    assert.deepStrictEqual(req.body, { a: '_x' });
  }
  assert.strictEqual(calls.length - before, 1);
});

test('manual mode without custom options does not re-resolve', () => {
  const { mod, calls } = loadWithSpy();
  const middleware = mod.expressMongoSanitize({ mode: 'manual' });
  const before = calls.length;
  const req = fakeReq();
  middleware(req, {}, () => {});
  req.sanitize();
  assert.deepStrictEqual(req.body, { a: 'x' });
  assert.strictEqual(calls.length, before);
});

test('"Plugin initialized" is logged once, not per request', () => {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    const { expressMongoSanitize } = require('../src');
    const middleware = expressMongoSanitize({ debug: { enabled: true, level: 'info' } });
    for (let i = 0; i < 3; i++) middleware(fakeReq(), {}, () => {});
  } finally {
    console.log = original;
  }
  assert.strictEqual(lines.filter((l) => l.includes('Plugin initialized')).length, 1);
});
