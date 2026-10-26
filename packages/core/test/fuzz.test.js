'use strict';

// Property tests over random nested payloads. Seeded, so a failure is reproducible:
// FUZZ_SEED=<seed from the failure message> FUZZ_RUNS=<n> node --test test/fuzz.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { sanitize, hasInjection, NoSQLSanitizeError } = require('../src/index.js');

const RUNS = Number(process.env.FUZZ_RUNS) || 500;
const SEED = Number(process.env.FUZZ_SEED) || 0x5eed;

// mulberry32: tiny deterministic PRNG
const prng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const KEYS = ['name', 'user', '$gt', '$ne', '$where', 'a.b', '__proto__', 'constructor', 'prototype', 'x\u0000y', 'ok'];
const STRINGS = ['', 'plain', '$admin', 'a$b$c', 'tab\tnul\u0000', 'ada@example.com', '$', '\u007f', 'üñí'];

const generate = (rand, depth = 0) => {
  const pick = (list) => list[Math.floor(rand() * list.length)];
  const r = rand();
  // The root is always a container; deeper levels end in leaves more and more often
  if (depth > 5 || (depth > 0 && r < 0.35)) {
    const leaf = rand();
    if (leaf < 0.5) return pick(STRINGS);
    if (leaf < 0.65) return Math.floor(rand() * 100) - 50;
    if (leaf < 0.75) return rand() < 0.5;
    if (leaf < 0.85) return null;
    return pick(STRINGS) + pick(STRINGS);
  }
  if (r < 0.6) return Array.from({ length: Math.floor(rand() * 4) }, () => generate(rand, depth + 1));
  const obj = {};
  const n = Math.floor(rand() * 5);
  for (let i = 0; i < n; i++) {
    const key = rand() < 0.2 ? pick(KEYS) + pick(KEYS) : pick(KEYS);
    // defineProperty keeps "__proto__" as an own key, like JSON.parse does
    Object.defineProperty(obj, key, {
      value: generate(rand, depth + 1),
      enumerable: true,
      writable: true,
      configurable: true,
    });
  }
  return obj;
};

const DANGEROUS = new Set(['__proto__', 'constructor', 'prototype']);
const UNSAFE = /[$\u0000-\u001F\u007F-\u009F]/;

// Every key and string in the output must be free of $ and control characters
const assertClean = (value, path = '<root>') => {
  if (typeof value === 'string') {
    assert.ok(!UNSAFE.test(value), `unsafe string at ${path}: ${JSON.stringify(value)}`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => assertClean(item, `${path}[${i}]`));
  } else if (value !== null && typeof value === 'object') {
    assert.ok(Object.getPrototypeOf(value) === Object.prototype, `prototype changed at ${path}`);
    for (const key of Object.keys(value)) {
      assert.ok(!UNSAFE.test(key), `unsafe key at ${path}: ${JSON.stringify(key)}`);
      assert.ok(!DANGEROUS.has(key), `dangerous key at ${path}: ${key}`);
      assertClean(value[key], `${path}.${key}`);
    }
  }
};

const runs = (name, fn) =>
  test(name, () => {
    const rand = prng(SEED);
    for (let i = 0; i < RUNS; i++) {
      const input = generate(rand);
      try {
        fn(input);
      } catch (err) {
        err.message = `${err.message}\n  seed=${SEED} run=${i} input=${JSON.stringify(input)}`;
        throw err;
      }
    }
  });

// preserveEmails: false so the clean-output check doesn't have to special-case emails
const options = { preserveEmails: false };

runs('fuzz: output never contains operators, control characters or prototype keys', (input) => {
  assertClean(sanitize(input, options));
});

runs('fuzz: input is never mutated', (input) => {
  const before = JSON.stringify(input);
  sanitize(input, options);
  hasInjection(input, options);
  assert.strictEqual(JSON.stringify(input), before);
});

runs('fuzz: sanitize is idempotent and its output has no injection', (input) => {
  const once = sanitize(input, options);
  assert.deepStrictEqual(sanitize(once, options), once);
  assert.strictEqual(hasInjection(once, options), false);
});

runs('fuzz: hasInjection is true exactly when sanitize changes something', (input) => {
  const changed = JSON.stringify(sanitize(input, options)) !== JSON.stringify(input);
  assert.strictEqual(hasInjection(input, options), changed);
});

runs('fuzz: only NoSQLSanitizeError is ever thrown, even with strict options', (input) => {
  for (const o of [
    { maxDepth: 2, maxDepthBehavior: 'throw' },
    { removeMatches: true, removeEmpty: 'empty' },
  ]) {
    let out;
    try {
      out = sanitize(input, { ...options, ...o });
    } catch (err) {
      if (!(err instanceof NoSQLSanitizeError)) throw err;
      assert.strictEqual(err.type, 'max_depth');
      continue;
    }
    assertClean(out);
  }
});
