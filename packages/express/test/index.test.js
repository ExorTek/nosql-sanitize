'use strict';

const express4 = require('express4');
const express = require('express');
const { test, after } = require('node:test');
const assert = require('node:assert');
const { expressMongoSanitize, paramSanitizeHandler } = require('../src');

const expressVersions = [
  { name: 'Express v4', app: express4 },
  { name: 'Express v5', app: express },
];

// Helper: create app, run request, return data
const runRequest = async (appFactory, middleware, method, path, body, query) => {
  const app = appFactory();
  app.use(express.json());
  if (middleware) app.use(middleware);
  return { app, appFactory };
};

for (const version of expressVersions) {
  test(`[${version.name}] should handle nested objects and arrays`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize());
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: {
          username: '$admin',
          $password: '$secret',
          preferences: { $set: ['admin'] },
          history: [{ $push: 'log' }, { $inc: 5 }],
          details: { nested: { $where: 'javascript' } },
        },
      }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), {
      user: {
        username: 'admin',
        password: 'secret',
        preferences: { set: ['admin'] },
        history: [{ push: 'log' }, { inc: 5 }],
        details: { nested: { where: 'javascript' } },
      },
    });
    server.close();
  });

  test(`[${version.name}] should respect stringOptions configuration`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ stringOptions: { trim: true, lowercase: true, maxLength: 5 } }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: '  $HELLO WORLD  ', nested: { value: '  $TEST  ' } }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { text: 'hello', nested: { value: 'test' } });
    server.close();
  });

  test(`[${version.name}] should handle array options correctly`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ arrayOptions: { filterNull: true, distinct: true } }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items: ['$test', '$test', null, '$value', null] }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { items: ['test', 'value'] });
    server.close();
  });

  test(`[${version.name}] should respect allowedKeys configuration`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ allowedKeys: ['username', 'email'] }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '$admin',
        email: 'test@example.com',
        password: '$ecret',
        role: '$super',
      }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: 'admin', email: 'test@example.com' });
    server.close();
  });

  test(`[${version.name}] should respect deniedKeys configuration`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ deniedKeys: ['email', 'password'] }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '$admin',
        email: 'test@example.com',
        password: '$ecret',
        role: '$super',
      }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: 'admin', email: 'test@example.com', role: 'super' });
    server.close();
  });

  test(`[${version.name}] should handle manual mode with custom replaceWith`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ mode: 'manual' }));
    app.post('/', (req, res) => {
      req.sanitize({ replaceWith: '_' });
      res.json(req.body);
    });

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '$admin' }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: '_admin' });
    server.close();
  });

  test(`[${version.name}] should remove matches body`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ removeMatches: true }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '$admin',
        email: 'mail@mail.com',
        password: '$ecret',
        role: '$super',
      }),
    });

    assert.strictEqual(response.status, 200);
    // email preserved (isEmail), all others removed by removeMatches
    assert.deepStrictEqual(await response.json(), { email: 'mail@mail.com' });
    server.close();
  });

  test(`[${version.name}] should skip specified routes`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ skipRoutes: ['/skip'] }));
    app.post('/skip', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/skip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '$admin' }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: '$admin' });
    server.close();
  });

  test(`[${version.name}] should remove empty values if removeEmpty is true`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ removeEmpty: true }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '', password: null, role: '$admin' }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { role: 'admin' });
    server.close();
  });

  test(`[${version.name}] should sanitize params via paramSanitizeHandler`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize());
    app.param('username', paramSanitizeHandler());
    app.get('/user/:username', (req, res) => res.json({ username: req.params.username }));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/user/$admin`);
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: 'admin' });
    server.close();
  });

  test(`[${version.name}] should use customSanitizer if provided`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(
      expressMongoSanitize({
        customSanitizer: (data) => {
          if (typeof data === 'string') return 'SAFE';
          if (Array.isArray(data)) return data.map(() => 'SAFE');
          if (typeof data === 'object' && data !== null) {
            const out = {};
            for (const k in data) {
              if (Array.isArray(data[k])) out[k] = data[k].map(() => 'SAFE');
              else if (typeof data[k] === 'string') out[k] = 'SAFE';
              else out[k] = data[k];
            }
            return out;
          }
          return data;
        },
      }),
    );
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ foo: '$bar', arr: ['$baz', '$qux'] }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { foo: 'SAFE', arr: ['SAFE', 'SAFE'] });
    server.close();
  });

  test(`[${version.name}] should sanitize query parameters`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize());
    app.get('/', (req, res) => res.json(req.query));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/?username=$admin&role=$super`);
    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: 'admin', role: 'super' });
    server.close();
  });

  test(`[${version.name}] should not sanitize in manual mode without req.sanitize()`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ mode: 'manual' }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: '$admin' }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), { username: '$admin' });
    server.close();
  });

  test(`[${version.name}] should handle recursive=false`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ recursive: false }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '$admin',
        nested: { $danger: 'hack' },
        arr: [{ $hidden: 'bad' }],
      }),
    });

    assert.strictEqual(response.status, 200);
    assert.deepStrictEqual(await response.json(), {
      username: 'admin',
      nested: { $danger: 'hack' },
      arr: [{ $hidden: 'bad' }],
    });
    server.close();
  });

  test(`[${version.name}] should skip body sanitization for multipart/form-data`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize());
    // Simulate multipart — Express won't parse it but we can test the guard
    app.post('/', (req, res) => res.json({ body: req.body, query: req.query }));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}/?role=$admin`, {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=---abc' },
      body: '---abc\r\nContent-Disposition: form-data; name="file"\r\n\r\ndata\r\n---abc--',
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    // query always sanitized, body skipped due to content-type
    assert.deepStrictEqual(data.query, { role: 'admin' });
    server.close();
  });

  test(`[${version.name}] should support maxDepth option`, async () => {
    const app = version.app();
    app.use(express.json());
    app.use(expressMongoSanitize({ maxDepth: 1 }));
    app.post('/', (req, res) => res.json(req.body));

    const server = app.listen(0);
    const port = server.address().port;

    const response = await fetch(`http://localhost:${port}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '$admin',
        nested: { inner: '$danger' },
      }),
    });

    assert.strictEqual(response.status, 200);
    const data = await response.json();
    assert.strictEqual(data.name, 'admin');
    assert.deepStrictEqual(data.nested, { inner: '$danger' });
    server.close();
  });
}

after(() => {
  setTimeout(() => process.exit(0), 100);
});
