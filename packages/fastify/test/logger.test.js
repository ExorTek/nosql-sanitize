'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { Writable } = require('node:stream');
const Fastify = require('fastify');
const Fastify4 = require('fastify4');
const plugin = require('../src');

const versions = [
  ['Fastify v5', Fastify],
  ['Fastify v4', Fastify4],
];

// Fastify instance whose pino output is collected as parsed JSON lines
const withLogs = (factory) => {
  const lines = [];
  const stream = new Writable({
    write(chunk, _enc, cb) {
      for (const line of chunk.toString().split('\n')) if (line) lines.push(JSON.parse(line));
      cb();
    },
  });
  const fastify = factory({ logger: { level: 'trace', stream } });
  const ours = () => lines.filter((l) => l.module === 'nosql-sanitize');
  return { fastify, ours };
};

const debug = { enabled: true, level: 'trace' };
const post = (fastify, url, payload) => fastify.inject({ method: 'POST', url, payload });

for (const [name, factory] of versions) {
  test(`[${name}] debug.logger: fastify.log receives the plugin logs`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin, { debug: { ...debug, logger: fastify.log } });
    fastify.post('/t', async (request) => request.body);

    assert.deepStrictEqual((await post(fastify, '/t', { $a: 1 })).json(), { a: 1 });
    assert.ok(ours().some((l) => l.context === 'PLUGIN'));
    assert.ok(ours().some((l) => l.context === 'REQUEST'));
    await fastify.close();
  });

  test(`[${name}] debug.logger: 'request' logs through request.log`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin, { debug: { ...debug, logger: 'request' } });
    fastify.post('/t', async (request) => request.body);

    assert.deepStrictEqual((await post(fastify, '/t', { $a: 1 })).json(), { a: 1 });
    // Startup messages have no request, so they go to fastify.log
    assert.ok(ours().some((l) => l.context === 'PLUGIN' && l.reqId === undefined));
    const requestLines = ours().filter((l) => l.context === 'REQUEST');
    assert.ok(requestLines.length > 0);
    assert.ok(requestLines.every((l) => l.reqId !== undefined));
    await fastify.close();
  });

  test(`[${name}] debug.logger: 'request' in a route config`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin);
    fastify.post('/t', { config: { mongoSanitize: { debug: { ...debug, logger: 'request' } } } }, async (r) => r.body);

    assert.deepStrictEqual((await post(fastify, '/t', { $a: 1 })).json(), { a: 1 });
    const requestLines = ours().filter((l) => l.context === 'REQUEST');
    assert.ok(requestLines.length > 0);
    assert.ok(requestLines.every((l) => l.reqId !== undefined));
    await fastify.close();
  });

  test(`[${name}] debug.logger: 'request' in manual mode`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin, { mode: 'manual', debug: { ...debug, logger: 'request' } });
    fastify.post('/t', async (request) => {
      request.sanitize();
      return request.body;
    });

    assert.deepStrictEqual((await post(fastify, '/t', { $a: 1 })).json(), { a: 1 });
    const requestLines = ours().filter((l) => l.context === 'REQUEST');
    assert.ok(requestLines.length > 0);
    assert.ok(requestLines.every((l) => l.reqId !== undefined));
    await fastify.close();
  });

  test(`[${name}] skipped routes are logged through request.log`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin, { skipRoutes: ['/skip'], debug: { ...debug, logSkippedRoutes: true, logger: 'request' } });
    fastify.post('/skip', async (request) => request.body);

    await post(fastify, '/skip', { $a: 1 });
    const skipLines = ours().filter((l) => l.context === 'SKIP');
    assert.strictEqual(skipLines.length, 1);
    assert.notStrictEqual(skipLines[0].reqId, undefined);
    await fastify.close();
  });

  test(`[${name}] sanitized values stay out of request.log without logSanitizedValues`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin, { debug: { ...debug, logPatternMatches: true, logger: 'request' } });
    fastify.post('/t', async (request) => request.body);

    await post(fastify, '/t', { token: '$secret-token' });
    const logged = JSON.stringify(ours());
    assert.match(logged, /Pattern matched/);
    assert.doesNotMatch(logged, /secret-token/);
    await fastify.close();
  });

  test(`[${name}] an invalid debug.logger fails at startup`, async () => {
    const fastify = factory();
    fastify.register(plugin, { debug: { logger: 'reply' } });
    await assert.rejects(fastify.ready(), /debug\.logger/);
  });
}
