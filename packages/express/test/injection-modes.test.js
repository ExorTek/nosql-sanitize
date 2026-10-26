'use strict';

const express4 = require('express4');
const express = require('express');
const { test } = require('node:test');
const assert = require('node:assert');
const { expressMongoSanitize } = require('../src');

for (const [name, factory] of [
  ['Express v4', express4],
  ['Express v5', express],
]) {
  test(`[${name}] onInjection: 'reject' responds 400 and never reaches the route`, async () => {
    const app = factory();
    let reached = false;
    app.use(express.json());
    app.use(expressMongoSanitize({ onInjection: 'reject' }));
    app.post('/', (req, res) => {
      reached = true;
      res.json(req.body);
    });

    const server = app.listen(0);
    try {
      const url = `http://localhost:${server.address().port}`;
      const bad = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { $ne: 'x' } }),
      });
      assert.strictEqual(bad.status, 400);
      assert.strictEqual(reached, false);

      const ok = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: 'ada' }),
      });
      assert.strictEqual(ok.status, 200);
      assert.deepStrictEqual(await ok.json(), { user: 'ada' });
    } finally {
      server.close();
    }
  });
}
