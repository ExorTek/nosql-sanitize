'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Fastify = require('fastify');
const Fastify4 = require('fastify4');
const plugin = require('../src');

const versions = [
  ['Fastify v5', Fastify],
  ['Fastify v4', Fastify4],
];

const post = (fastify, url, payload) => fastify.inject({ method: 'POST', url, payload });

for (const [name, factory] of versions) {
  /* ───────────────── Route config (F3) ───────────────── */

  test(`[${name}] config.mongoSanitize: false skips that route only`, async () => {
    const fastify = factory();
    fastify.register(plugin);
    fastify.post('/raw', { config: { mongoSanitize: false } }, async (request) => request.body);
    fastify.post('/clean', async (request) => request.body);

    assert.deepStrictEqual((await post(fastify, '/raw', { $set: 1 })).json(), { $set: 1 });
    assert.deepStrictEqual((await post(fastify, '/clean', { $set: 1 })).json(), { set: 1 });
    await fastify.close();
  });

  test(`[${name}] config.mongoSanitize options override the plugin options for that route`, async () => {
    const fastify = factory();
    fastify.register(plugin, { replaceWith: '-' });
    fastify.post('/admin', { config: { mongoSanitize: { allowedOperators: ['$set'] } } }, async (r) => r.body);
    fastify.post('/other', async (request) => request.body);

    const payload = { $set: { name: '$x' }, $inc: 1 };
    assert.deepStrictEqual((await post(fastify, '/admin', payload)).json(), { $set: { name: '-x' }, '-inc': 1 });
    assert.deepStrictEqual((await post(fastify, '/other', payload)).json(), { '-set': { name: '-x' }, '-inc': 1 });
    await fastify.close();
  });

  test(`[${name}] config.mongoSanitize: true uses the plugin options`, async () => {
    const fastify = factory();
    fastify.register(plugin);
    fastify.post('/t', { config: { mongoSanitize: true } }, async (request) => request.body);
    assert.deepStrictEqual((await post(fastify, '/t', { $a: 1 })).json(), { a: 1 });
    await fastify.close();
  });

  test(`[${name}] invalid route options fail at startup`, async () => {
    for (const mongoSanitize of [{ patterns: 'x' }, 'off']) {
      const fastify = factory();
      fastify.register(plugin);
      fastify.register(async (instance) => {
        instance.post('/t', { config: { mongoSanitize } }, async () => 'ok');
      });
      await assert.rejects(fastify.ready(), (err) => err.name === 'NoSQLSanitizeError' && err.type === 'type_error');
      await fastify.close();
    }
  });

  /* ───────────────── hook option (F4) ───────────────── */

  const schema = {
    body: {
      type: 'object',
      properties: { name: { type: 'string', pattern: '^[a-z]+$' } },
      required: ['name'],
    },
  };

  test(`[${name}] hook: 'preHandler' validates the raw body`, async () => {
    const fastify = factory();
    fastify.register(plugin, { hook: 'preHandler' });
    fastify.post('/t', { schema }, async (request) => request.body);
    assert.strictEqual((await post(fastify, '/t', { name: '$abc' })).statusCode, 400);
    await fastify.close();
  });

  test(`[${name}] hook: 'preValidation' lets the schema validate sanitized data`, async () => {
    const fastify = factory();
    fastify.register(plugin, { hook: 'preValidation' });
    fastify.post('/t', { schema }, async (request) => request.body);
    const res = await post(fastify, '/t', { name: '$abc' });
    assert.strictEqual(res.statusCode, 200);
    assert.deepStrictEqual(res.json(), { name: 'abc' });
    await fastify.close();
  });

  test(`[${name}] hook is validated`, async () => {
    const fastify = factory();
    fastify.register(plugin, { hook: 'onRequest' });
    await assert.rejects(fastify.ready(), (err) => err.type === 'type_error' && err.message.includes('"hook"'));
    await fastify.close();
  });
}

test('invalid plugin options reject ready() instead of crashing', async () => {
  const fastify = Fastify();
  fastify.register(plugin, { patterns: 'x' });
  await assert.rejects(fastify.ready(), (err) => err.type === 'type_error' && err.message.includes('"patterns"'));
  await fastify.close();
});
