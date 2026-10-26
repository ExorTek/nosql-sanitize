'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Fastify = require('fastify');
const plugin = require('../src');

test("onInjection: 'reject' responds 400 and never reaches the route", async () => {
  const fastify = Fastify();
  let reached = false;
  fastify.register(plugin, { onInjection: 'reject' });
  fastify.post('/', async (request) => {
    reached = true;
    return request.body;
  });

  const bad = await fastify.inject({ method: 'POST', url: '/', payload: { user: { $ne: 'x' } } });
  assert.strictEqual(bad.statusCode, 400);
  assert.strictEqual(reached, false);
  assert.match(bad.json().message, /injection/i);

  const ok = await fastify.inject({ method: 'POST', url: '/', payload: { user: 'ada' } });
  assert.strictEqual(ok.statusCode, 200);
  assert.deepStrictEqual(ok.json(), { user: 'ada' });
  await fastify.close();
});

test("onInjection: 'reject' checks route params", async () => {
  const fastify = Fastify();
  fastify.register(plugin, { onInjection: 'reject' });
  fastify.get('/user/:id', async (request) => request.params);
  const res = await fastify.inject({ method: 'GET', url: '/user/$admin' });
  assert.strictEqual(res.statusCode, 400);
  await fastify.close();
});
