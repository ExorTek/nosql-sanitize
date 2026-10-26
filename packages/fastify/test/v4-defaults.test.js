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

const post = (fastify, url, payload) => fastify.inject({ method: 'POST', url, payload });

const schema = {
  body: {
    type: 'object',
    properties: { name: { type: 'string', pattern: '^[a-z]+$' } },
    required: ['name'],
  },
};

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
  return { fastify, ours: () => lines.filter((l) => l.module === 'nosql-sanitize') };
};

for (const [name, factory] of versions) {
  test(`[${name}] the default hook is preValidation: the schema sees sanitized data`, async () => {
    const fastify = factory();
    fastify.register(plugin);
    fastify.post('/t', { schema }, async (request) => request.body);
    const res = await post(fastify, '/t', { name: '$abc' });
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.json(), { name: 'abc' });
    await fastify.close();
  });

  test(`[${name}] debug logs go through request.log by default`, async () => {
    const { fastify, ours } = withLogs(factory);
    fastify.register(plugin, { debug: { enabled: true, level: 'trace' } });
    fastify.post('/t', async (request) => request.body);

    await post(fastify, '/t', { $a: 1 });
    const requestLines = ours().filter((l) => l.context === 'REQUEST');
    assert.ok(requestLines.length > 0);
    assert.ok(requestLines.every((l) => l.reqId !== undefined));
    await fastify.close();
  });

  test(`[${name}] debug.logger: null writes with console.log`, async () => {
    const { fastify, ours } = withLogs(factory);
    const lines = [];
    const original = console.log;
    console.log = (...args) => lines.push(args.join(' '));
    try {
      fastify.register(plugin, { debug: { enabled: true, level: 'trace', logger: null } });
      fastify.post('/t', async (request) => request.body);
      await post(fastify, '/t', { $a: 1 });
    } finally {
      console.log = original;
    }
    assert.strictEqual(ours().length, 0);
    assert.ok(lines.some((l) => l.includes('[REQUEST]')));
    await fastify.close();
  });
}
