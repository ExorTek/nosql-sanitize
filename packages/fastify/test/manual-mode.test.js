'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const Fastify = require('fastify');
const core = require('@exortek/nosql-sanitize-core');

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
    return { plugin: require('../src'), calls };
  } finally {
    core.resolveOptions = original;
    delete require.cache[srcPath];
  }
};

test('manual mode with custom options still sanitizes params', async () => {
  const fastify = Fastify();
  fastify.register(require('../src'), { mode: 'manual' });
  fastify.get('/user/:id', async (request) => {
    request.sanitize({ replaceWith: '_' });
    return request.params;
  });
  const res = await fastify.inject({ method: 'GET', url: '/user/$admin' });
  assert.deepStrictEqual(res.json(), { id: '_admin' });
  await fastify.close();
});

test('manual mode resolves each custom options object once', async () => {
  const { plugin, calls } = loadWithSpy();
  const fastify = Fastify();
  fastify.register(plugin, { mode: 'manual' });
  const custom = { replaceWith: '_' };
  fastify.post('/', async (request) => {
    request.sanitize(custom);
    return request.body;
  });
  await fastify.ready();
  const before = calls.length;
  for (let i = 0; i < 3; i++) {
    const res = await fastify.inject({ method: 'POST', url: '/', payload: { a: '$x' } });
    assert.deepStrictEqual(res.json(), { a: '_x' });
  }
  assert.strictEqual(calls.length - before, 1);
  await fastify.close();
});
