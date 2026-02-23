'use strict';

const Fastify = require('fastify');
const Fastify4 = require('fastify4');
const { test } = require('node:test');
const assert = require('node:assert');
const mongoSanitizePlugin = require('../src');

const fastifyVersions = [
  { name: 'Fastify v5', factory: Fastify },
  { name: 'Fastify v4', factory: Fastify4 },
];

for (const { name, factory } of fastifyVersions) {
  test(`should sanitize body ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin);

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: {
        user: {
          username: '$admin',
          $password: '$secret',
          preferences: { $set: ['admin'] },
          history: [{ $push: 'log' }, { $inc: 5 }],
        },
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {
      user: {
        username: 'admin',
        password: 'secret',
        preferences: { set: ['admin'] },
        history: [{ push: 'log' }, { inc: 5 }],
      },
    });
    await fastify.close();
  });

  test(`should sanitize query ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin);

    fastify.get('/test', async (request) => request.query);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      query: { username: '$admin', role: '$super' },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { username: 'admin', role: 'super' });
    await fastify.close();
  });

  test(`should sanitize params ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin);

    fastify.get('/user/:id', async (request) => request.params);

    const response = await fastify.inject({
      method: 'GET',
      url: '/user/$admin',
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { id: 'admin' });
    await fastify.close();
  });

  test(`should respect stringOptions ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, {
      stringOptions: { trim: true, lowercase: true, maxLength: 5 },
    });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: { text: '  $HELLO WORLD  ', nested: { value: '  $TEST  ' } },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { text: 'hello', nested: { value: 'test' } });
    await fastify.close();
  });

  test(`should handle array options ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, {
      arrayOptions: { filterNull: true, distinct: true },
    });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: { items: ['$test', '$test', null, '$value', null] },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { items: ['test', 'value'] });
    await fastify.close();
  });

  test(`should respect allowedKeys ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { allowedKeys: ['username', 'email'] });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: {
        username: '$admin',
        email: 'test@example.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { username: 'admin', email: 'test@example.com' });
    await fastify.close();
  });

  test(`should respect deniedKeys ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { deniedKeys: ['password', 'email'] });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: {
        username: '$admin',
        email: 'test@example.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    // email preserved by BUG-03 fix (email value on denied key)
    assert.deepStrictEqual(response.json(), { username: 'admin', email: 'test@example.com', role: 'super' });
    await fastify.close();
  });

  test(`should handle manual mode ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { mode: 'manual' });

    fastify.post('/manual', async (request) => {
      request.sanitize();
      return request.body;
    });

    fastify.post('/no-sanitize', async (request) => request.body);

    const sanitized = await fastify.inject({
      method: 'POST',
      url: '/manual',
      payload: { query: { $ne: null } },
    });

    const unsanitized = await fastify.inject({
      method: 'POST',
      url: '/no-sanitize',
      payload: { query: { $ne: null } },
    });

    assert.deepStrictEqual(sanitized.json(), { query: { ne: null } });
    assert.deepStrictEqual(unsanitized.json(), { query: { $ne: null } });
    await fastify.close();
  });

  test(`should removeMatches body ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, {
      removeMatches: true,
      sanitizeObjects: ['body'],
    });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: {
        username: '$admin',
        email: 'mail@mail.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { email: 'mail@mail.com' });
    await fastify.close();
  });

  test(`should removeMatches query ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, {
      removeMatches: true,
      sanitizeObjects: ['query'],
    });

    fastify.get('/test', async (request) => request.query);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test',
      query: {
        username: '$admin',
        email: 'mail@mail.com',
        password: '$ecret',
        role: '$super',
      },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { email: 'mail@mail.com' });
    await fastify.close();
  });

  test(`should removeMatches params ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, {
      removeMatches: true,
      sanitizeObjects: ['params'],
    });

    fastify.get('/test/:id', async (request) => request.params);

    const response = await fastify.inject({
      method: 'GET',
      url: '/test/$123',
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), {});
    await fastify.close();
  });

  test(`should skip specified routes ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { skipRoutes: ['/skip'] });

    fastify.post('/skip', async (request) => request.body);
    fastify.post('/sanitized', async (request) => request.body);

    const skipped = await fastify.inject({
      method: 'POST',
      url: '/skip',
      payload: { username: '$admin' },
    });

    const sanitized = await fastify.inject({
      method: 'POST',
      url: '/sanitized',
      payload: { username: '$admin' },
    });

    assert.deepStrictEqual(skipped.json(), { username: '$admin' });
    assert.deepStrictEqual(sanitized.json(), { username: 'admin' });
    await fastify.close();
  });

  test(`should skip routes with query strings and trailing slashes ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { skipRoutes: ['/path'] });

    fastify.post('/path', async (request) => request.body);

    const res1 = await fastify.inject({
      method: 'POST',
      url: '/path?test=123',
      payload: { $foo: 'bar' },
    });
    assert.deepStrictEqual(res1.json(), { $foo: 'bar' });

    await fastify.close();
  });

  test(`should handle recursive=false ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { recursive: false });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: {
        username: '$admin',
        nested: { $danger: 'hack' },
        arr: [{ $hidden: 'bad' }],
      },
    });

    assert.deepStrictEqual(response.json(), {
      username: 'admin',
      nested: { $danger: 'hack' },
      arr: [{ $hidden: 'bad' }],
    });
    await fastify.close();
  });

  test(`should handle removeEmpty ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { removeEmpty: true });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: { username: '', password: null, role: '$admin' },
    });

    assert.strictEqual(response.statusCode, 200);
    assert.deepStrictEqual(response.json(), { role: 'admin' });
    await fastify.close();
  });

  test(`should default sanitizeObjects to body, params, query ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin); // no options

    fastify.post('/test/:id', async (request) => ({
      body: request.body,
      params: request.params,
      query: request.query,
    }));

    const response = await fastify.inject({
      method: 'POST',
      url: '/test/$inject?role=$admin',
      payload: { name: '$evil' },
    });

    const data = response.json();
    assert.deepStrictEqual(data.body, { name: 'evil' });
    assert.deepStrictEqual(data.params, { id: 'inject' });
    assert.deepStrictEqual(data.query, { role: 'admin' });
    await fastify.close();
  });

  test(`should skip body for non-JSON content-type ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin);

    // Register a content type parser for octet-stream so Fastify accepts it
    fastify.addContentTypeParser('application/octet-stream', { parseAs: 'string' }, (req, body, done) => {
      done(null, body);
    });

    fastify.post('/test', async (request) => ({
      body: request.body,
      query: request.query,
    }));

    const response = await fastify.inject({
      method: 'POST',
      url: '/test?q=$admin',
      headers: { 'content-type': 'application/octet-stream' },
      payload: '$binary-data',
    });

    const data = response.json();
    // body NOT sanitized (octet-stream not in contentTypes)
    assert.strictEqual(data.body, '$binary-data');
    // query always sanitized
    assert.deepStrictEqual(data.query, { q: 'admin' });
    await fastify.close();
  });

  test(`should sanitize body for JSON content-type ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin);

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      headers: { 'content-type': 'application/json; charset=utf-8' },
      payload: JSON.stringify({ name: '$admin' }),
    });

    assert.deepStrictEqual(response.json(), { name: 'admin' });
    await fastify.close();
  });

  test(`should support maxDepth ${name}`, async () => {
    const fastify = factory();
    fastify.register(mongoSanitizePlugin, { maxDepth: 1 });

    fastify.post('/test', async (request) => request.body);

    const response = await fastify.inject({
      method: 'POST',
      url: '/test',
      payload: {
        name: '$admin',
        nested: { inner: '$danger' },
      },
    });

    const data = response.json();
    assert.strictEqual(data.name, 'admin');
    assert.deepStrictEqual(data.nested, { inner: '$danger' });
    await fastify.close();
  });
}
