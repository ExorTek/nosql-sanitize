'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  resolveOptions,
  handleRequest,
  sanitizeString,
  log,
  NoSQLSanitizeError,
  DEFAULT_OPTIONS,
} = require('../src/index.js');

const LEVELS = ['error', 'warn', 'info', 'debug', 'trace'];

// pino-shaped logger that records every call as { level, obj, msg }
const createLogger = () => {
  const calls = [];
  const logger = {};
  for (const level of LEVELS) logger[level] = (obj, msg) => calls.push({ level, obj, msg });
  return { logger, calls };
};

// Collects everything written through console.log while fn runs
const captureConsole = (fn) => {
  const lines = [];
  const original = console.log;
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    fn();
  } finally {
    console.log = original;
  }
  return lines;
};

test('debug.logger defaults to null', () => {
  assert.strictEqual(DEFAULT_OPTIONS.debug.logger, null);
  assert.strictEqual(resolveOptions().debug.logger, null);
});

test('log sends messages to debug.logger instead of console', () => {
  const { logger, calls } = createLogger();
  const lines = captureConsole(() => {
    log({ enabled: true, level: 'trace', logger }, 'warn', 'TEST', 'hello');
  });
  assert.deepStrictEqual(lines, []);
  assert.deepStrictEqual(calls, [{ level: 'warn', obj: { module: 'nosql-sanitize', context: 'TEST' }, msg: 'hello' }]);
});

test('log passes data to the logger as a field', () => {
  const { logger, calls } = createLogger();
  log({ enabled: true, level: 'info', logger }, 'info', 'TEST', 'with data', { a: 1 });
  assert.deepStrictEqual(calls[0].obj, { module: 'nosql-sanitize', context: 'TEST', data: { a: 1 } });
});

test('debug.level still filters before the logger is called', () => {
  const { logger, calls } = createLogger();
  const debug = { enabled: true, level: 'warn', logger };
  for (const level of LEVELS) log(debug, level, 'TEST', level);
  assert.deepStrictEqual(
    calls.map((c) => c.level),
    ['error', 'warn'],
  );
});

test('the logger is not called while debug is disabled', () => {
  const { logger, calls } = createLogger();
  log({ enabled: false, level: 'trace', logger }, 'info', 'TEST', 'nope');
  assert.strictEqual(calls.length, 0);
});

test('handleRequest logs through debug.logger', () => {
  const { logger, calls } = createLogger();
  const opts = resolveOptions({ debug: { enabled: true, level: 'trace', logger } });
  const lines = captureConsole(() => {
    handleRequest({ body: { $gt: 1 }, query: {}, headers: { 'content-type': 'application/json' } }, opts);
  });
  assert.deepStrictEqual(lines, []);
  assert.ok(calls.some((c) => c.obj.context === 'REQUEST'));
  assert.ok(calls.some((c) => c.obj.context === 'TIMING' && c.level === 'trace'));
});

test('sanitized values reach the logger only with logSanitizedValues', () => {
  const run = (extra) => {
    const { logger, calls } = createLogger();
    sanitizeString(
      '$secret-token',
      resolveOptions({ debug: { enabled: true, level: 'trace', logger, ...extra } }),
      true,
    );
    return JSON.stringify(calls);
  };
  assert.doesNotMatch(run({}), /secret-token/);
  const matches = run({ logPatternMatches: true });
  assert.match(matches, /Pattern matched/);
  assert.doesNotMatch(matches, /secret-token/);
  assert.match(run({ logSanitizedValues: true }), /secret-token/);
});

test('console works as a logger', () => {
  assert.doesNotThrow(() => resolveOptions({ debug: { logger: console } }));
});

test('debug.logger is validated', () => {
  const rejects = (logger) =>
    assert.throws(
      () => resolveOptions({ debug: { logger } }),
      (err) => err instanceof NoSQLSanitizeError && err.message.includes('debug.logger'),
    );
  rejects('pino');
  rejects(true);
  rejects(() => {});
  rejects({ info: () => {} });
  const { logger } = createLogger();
  rejects({ ...logger, trace: 'nope' });
});

test('a user logger is not frozen or copied by resolveOptions', () => {
  const { logger } = createLogger();
  const opts = resolveOptions({ debug: { logger } });
  assert.strictEqual(opts.debug.logger, logger);
  assert.ok(!Object.isFrozen(logger));
});
