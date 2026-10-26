'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { expressMongoSanitize, paramSanitizeHandler } = require('../src');

// pino-shaped logger that records every call as { level, obj, msg }
const createLogger = () => {
  const calls = [];
  const logger = {};
  for (const level of ['error', 'warn', 'info', 'debug', 'trace']) {
    logger[level] = (obj, msg) => calls.push({ level, obj, msg });
  }
  return { logger, calls };
};

const debug = { enabled: true, level: 'trace' };
const fakeReq = () => ({
  path: '/',
  url: '/',
  headers: { 'content-type': 'application/json' },
  body: { a: '$x' },
  query: {},
});

test('the middleware logs through debug.logger', () => {
  const { logger, calls } = createLogger();
  const middleware = expressMongoSanitize({ debug: { ...debug, logger } });
  const req = fakeReq();
  middleware(req, {}, () => {});

  assert.deepStrictEqual(req.body, { a: 'x' });
  assert.ok(calls.some((c) => c.obj.context === 'PLUGIN'));
  assert.ok(calls.some((c) => c.obj.context === 'REQUEST'));
});

test('paramSanitizeHandler logs through debug.logger without the raw value', () => {
  const { logger, calls } = createLogger();
  const handler = paramSanitizeHandler({ debug: { ...debug, logger } });
  const req = { params: { id: '$secret-id' } };
  handler(req, {}, () => {}, req.params.id, 'id');

  assert.strictEqual(req.params.id, 'secret-id');
  const param = calls.find((c) => c.msg === 'Param sanitized');
  assert.deepStrictEqual(param.obj.data, { key: 'id' });
  assert.doesNotMatch(JSON.stringify(calls), /\$secret-id/);
});
