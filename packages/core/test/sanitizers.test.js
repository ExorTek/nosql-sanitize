'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const {
  sanitizeValue,
  sanitizeString,
  sanitizeArray,
  sanitizeObject,
  resolveOptions,
  handleRequest,
  shouldSkipRoute,
  isWritable,
  NoSQLSanitizeError,
  cleanUrl,
  isEmail,
  isPlainObject,
  isPrimitive,
} = require('../src');

const opts = (overrides = {}) => resolveOptions(overrides);

test('sanitizeValue — strips $ from string', () => {
  assert.strictEqual(sanitizeValue('$admin', opts(), true), 'admin');
});

test('sanitizeValue — strips $ from key in object', () => {
  const result = sanitizeValue({ $gt: 1 }, opts());
  assert.deepStrictEqual(result, { gt: 1 });
});

test('sanitizeValue — null/undefined pass through', () => {
  assert.strictEqual(sanitizeValue(null, opts()), null);
  assert.strictEqual(sanitizeValue(undefined, opts()), undefined);
});

test('sanitizeValue — falsy values (0, false, "") not skipped', () => {
  assert.strictEqual(sanitizeValue(0, opts()), 0);
  assert.strictEqual(sanitizeValue(false, opts()), false);
  assert.strictEqual(sanitizeValue('', opts(), true), '');
});

test('sanitizeValue — preserves Date objects', () => {
  const d = new Date('2025-01-01');
  assert.strictEqual(sanitizeValue(d, opts()), d);
});

test('sanitizeValue — preserves numbers', () => {
  assert.strictEqual(sanitizeValue(42, opts()), 42);
  assert.strictEqual(sanitizeValue(-1, opts()), -1);
  assert.strictEqual(sanitizeValue(3.14, opts()), 3.14);
});

test('sanitizeValue — nested objects', () => {
  const input = {
    user: {
      username: '$admin',
      $password: '$secret',
      preferences: { $set: ['admin'] },
      history: [{ $push: 'log' }, { $inc: 5 }],
      details: { nested: { $where: 'javascript' } },
    },
  };
  const result = sanitizeValue(input, opts());
  assert.deepStrictEqual(result, {
    user: {
      username: 'admin',
      password: 'secret',
      preferences: { set: ['admin'] },
      history: [{ push: 'log' }, { inc: 5 }],
      details: { nested: { where: 'javascript' } },
    },
  });
});

test('sanitizeValue — arrays with mixed types', () => {
  const input = ['$admin', 'normal', '$test', 42, null, true];
  const result = sanitizeValue(input, opts());
  assert.deepStrictEqual(result, ['admin', 'normal', 'test', 42, null, true]);
});

test('sanitizeString — preserves emails', () => {
  const o = opts();
  assert.strictEqual(sanitizeString('test@example.com', o, true), 'test@example.com');
  assert.strictEqual(sanitizeString('user.name+tag@domain.co.uk', o, true), 'user.name+tag@domain.co.uk');
});

test('sanitizeString — replaceWith option', () => {
  const o = opts({ replaceWith: '_' });
  assert.strictEqual(sanitizeString('$admin', o, true), '_admin');
});

test('sanitizeString — stringOptions.trim', () => {
  const o = opts({ stringOptions: { trim: true } });
  assert.strictEqual(sanitizeString('  hello  ', o, true), 'hello');
});

test('sanitizeString — stringOptions.lowercase', () => {
  const o = opts({ stringOptions: { lowercase: true } });
  assert.strictEqual(sanitizeString('HELLO', o, true), 'hello');
});

test('sanitizeString — stringOptions.maxLength', () => {
  const o = opts({ stringOptions: { maxLength: 5 } });
  assert.strictEqual(sanitizeString('hello world', o, true), 'hello');
});

test('sanitizeString — maxLength only applies to values, not keys', () => {
  const o = opts({ stringOptions: { maxLength: 3 } });
  assert.strictEqual(sanitizeString('longkey', o, false), 'longkey');
  assert.strictEqual(sanitizeString('longvalue', o, true), 'lon');
});

test('sanitizeString — combined stringOptions', () => {
  const o = opts({ stringOptions: { trim: true, lowercase: true, maxLength: 5 } });
  assert.strictEqual(sanitizeString('  $HELLO WORLD  ', o, true), 'hello');
});

test('sanitizeString — non-string input returns as-is', () => {
  const o = opts();
  assert.strictEqual(sanitizeString(42, o), 42);
  assert.strictEqual(sanitizeString(null, o), null);
  assert.strictEqual(sanitizeString(undefined, o), undefined);
});

test('sanitizeString — strips control characters', () => {
  const o = opts();
  assert.strictEqual(sanitizeString('hello\x00world', o, true), 'helloworld');
  assert.strictEqual(sanitizeString('test\x1Fdata', o, true), 'testdata');
});

test('sanitizeArray — filterNull removes falsy', () => {
  const o = opts({ arrayOptions: { filterNull: true } });
  const result = sanitizeArray(['a', null, '', 0, false, 'b'], o);
  assert.deepStrictEqual(result, ['a', 'b']);
});

test('sanitizeArray — distinct removes duplicates', () => {
  const o = opts({ arrayOptions: { distinct: true } });
  const result = sanitizeArray(['a', 'b', 'a', 'c', 'b'], o);
  assert.deepStrictEqual(result, ['a', 'b', 'c']);
});

test('sanitizeArray — combined filterNull + distinct', () => {
  const o = opts({ arrayOptions: { filterNull: true, distinct: true } });
  const result = sanitizeArray(['$test', '$test', null, '$value', null], o);
  assert.deepStrictEqual(result, ['test', 'value']);
});

test('sanitizeArray — recursive=false skips nested objects/arrays', () => {
  const o = opts({ recursive: false });
  const input = [{ $danger: 'hack' }, ['$nested']];
  const result = sanitizeArray(input, o);
  assert.deepStrictEqual(result, [{ $danger: 'hack' }, ['$nested']]);
});

test('sanitizeArray — throws on non-array', () => {
  assert.throws(() => sanitizeArray('not-array', opts()), NoSQLSanitizeError);
});

test('sanitizeObject — allowedKeys filters', () => {
  const o = opts({ allowedKeys: ['username', 'email'] });
  const result = sanitizeObject(
    { username: '$admin', email: 'test@example.com', password: '$secret', role: '$super' },
    o,
  );
  assert.deepStrictEqual(result, { username: 'admin', email: 'test@example.com' });
});

test('sanitizeObject — deniedKeys filters', () => {
  const o = opts({ deniedKeys: ['password', 'email'] });
  const result = sanitizeObject(
    { username: '$admin', email: 'test@example.com', password: '$secret', role: '$super' },
    o,
  );
  // email value is an email → preserved even though key is denied
  assert.deepStrictEqual(result, { username: 'admin', email: 'test@example.com', role: 'super' });
});

test('sanitizeObject — BUG-03 fix: deniedKey with email value preserved', () => {
  const o = opts({ deniedKeys: ['contact'] });
  const result = sanitizeObject({ contact: 'user@example.com', name: '$admin' }, o);
  assert.deepStrictEqual(result, { contact: 'user@example.com', name: 'admin' });
});

test('sanitizeObject — removeMatches removes keys matching patterns', () => {
  const o = opts({ removeMatches: true });
  const result = sanitizeObject({ $admin: 'value', normal: '$test', email: 'mail@mail.com' }, o);
  assert.deepStrictEqual(result, { email: 'mail@mail.com' });
});

test('sanitizeObject — removeEmpty removes empty values', () => {
  const o = opts({ removeEmpty: true });
  const result = sanitizeObject({ username: '', password: null, role: '$admin' }, o);
  assert.deepStrictEqual(result, { role: 'admin' });
});

test('sanitizeObject — recursive=false skips nested', () => {
  const o = opts({ recursive: false });
  const result = sanitizeObject({ username: '$admin', nested: { $danger: 'hack' }, arr: [{ $hidden: 'bad' }] }, o);
  assert.deepStrictEqual(result, {
    username: 'admin',
    nested: { $danger: 'hack' },
    arr: [{ $hidden: 'bad' }],
  });
});

test('sanitizeObject — throws on non-object', () => {
  assert.throws(() => sanitizeObject('not-object', opts()), NoSQLSanitizeError);
});

test('resolveOptions — returns valid defaults', () => {
  const o = resolveOptions();
  assert.strictEqual(o.replaceWith, '');
  assert.strictEqual(o.removeMatches, false);
  assert.strictEqual(o.mode, 'auto');
  assert.strictEqual(o.recursive, true);
  assert.ok(o._combinedPattern instanceof RegExp);
  assert.ok(o.skipRoutes.exact instanceof Set);
  assert.ok(Array.isArray(o.skipRoutes.regex));
  assert.ok(o.allowedKeys instanceof Set);
  assert.ok(o.deniedKeys instanceof Set);
});

test('resolveOptions — merges user options', () => {
  const o = resolveOptions({ replaceWith: '_', recursive: false });
  assert.strictEqual(o.replaceWith, '_');
  assert.strictEqual(o.recursive, false);
});

test('resolveOptions — deep merges nested options', () => {
  const o = resolveOptions({ stringOptions: { trim: true } });
  assert.strictEqual(o.stringOptions.trim, true);
  assert.strictEqual(o.stringOptions.lowercase, false);
});

test('resolveOptions — throws on non-object', () => {
  assert.throws(() => resolveOptions('invalid'), NoSQLSanitizeError);
  assert.throws(() => resolveOptions(42), NoSQLSanitizeError);
});

test('resolveOptions — validates debug option', () => {
  assert.throws(() => resolveOptions({ debug: 'invalid' }), NoSQLSanitizeError);
});

test('resolveOptions — validates boolean options strictly', () => {
  assert.throws(() => resolveOptions({ removeMatches: null }), NoSQLSanitizeError);
  assert.throws(() => resolveOptions({ recursive: 'yes' }), NoSQLSanitizeError);
  assert.doesNotThrow(() => resolveOptions({ removeMatches: true }));
  assert.doesNotThrow(() => resolveOptions({ removeMatches: false }));
});

test('resolveOptions — pre-compiles combined pattern', () => {
  const o = resolveOptions({ patterns: [/abc/g, /def/g] });
  assert.ok(o._combinedPattern instanceof RegExp);
  assert.strictEqual(o._combinedPattern.source, 'abc|def');
});

test('resolveOptions — converts skipRoutes to cleaned Set', () => {
  const o = resolveOptions({ skipRoutes: ['/health', '/metrics/', '///api///'] });
  assert.ok(o.skipRoutes.exact.has('/health'));
  assert.ok(o.skipRoutes.exact.has('/metrics'));
  assert.ok(o.skipRoutes.exact.has('/api'));
  assert.strictEqual(o.skipRoutes.regex.length, 0);
});

test('resolveOptions — skipRoutes accepts mixed string and RegExp', () => {
  const o = resolveOptions({
    skipRoutes: ['/health', /^\/docs\/.*/, /^\/api\/v\d+\/internal/],
  });
  assert.ok(o.skipRoutes.exact.has('/health'));
  assert.strictEqual(o.skipRoutes.exact.size, 1);
  assert.strictEqual(o.skipRoutes.regex.length, 2);
  assert.ok(o.skipRoutes.regex[0] instanceof RegExp);
});

test('handleRequest — sanitizes body and query', () => {
  const req = { body: { username: '$admin' }, query: { role: '$super' } };
  handleRequest(req, opts());
  assert.deepStrictEqual(req.body, { username: 'admin' });
  assert.deepStrictEqual(req.query, { role: 'super' });
});

test('handleRequest — skips null/undefined fields', () => {
  const req = { body: null, query: undefined };
  assert.doesNotThrow(() => handleRequest(req, opts()));
});

test('handleRequest — skips empty objects', () => {
  const req = { body: {}, query: {} };
  handleRequest(req, opts());
  assert.deepStrictEqual(req.body, {});
  assert.deepStrictEqual(req.query, {});
});

test('handleRequest — handles array body correctly', () => {
  const req = { body: [{ username: '$admin' }, { role: '$user' }], query: {} };
  handleRequest(req, opts());
  assert.ok(Array.isArray(req.body));
  assert.deepStrictEqual(req.body, [{ username: 'admin' }, { role: 'user' }]);
});

test('handleRequest — customSanitizer receives data and options', () => {
  let receivedOpts = null;
  const o = opts({
    customSanitizer: (data, options) => {
      receivedOpts = options;
      return { sanitized: true };
    },
  });
  const req = { body: { test: 'value' }, query: {} };
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { sanitized: true });
  assert.ok(receivedOpts !== null);
});

test('handleRequest — non-writable property uses defineProperty', () => {
  const req = {};
  Object.defineProperty(req, 'query', {
    value: { role: '$admin' },
    writable: false,
    enumerable: true,
    configurable: true,
  });
  handleRequest(req, opts());
  assert.deepStrictEqual(req.query, { role: 'admin' });
});

test('shouldSkipRoute — exact match with cleaned paths', () => {
  const skipRoutes = { exact: new Set(['/health', '/metrics']), regex: [] };
  assert.strictEqual(shouldSkipRoute('/health', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/health/', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/health?ping=1', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/other', skipRoutes), false);
});

test('shouldSkipRoute — empty skipRoutes always returns false', () => {
  const skipRoutes = { exact: new Set(), regex: [] };
  assert.strictEqual(shouldSkipRoute('/anything', skipRoutes), false);
});

test('shouldSkipRoute — regex match /docs/*', () => {
  const skipRoutes = { exact: new Set(), regex: [/^\/docs\/.*/] };
  assert.strictEqual(shouldSkipRoute('/docs/swagger', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/docs/static/style.css', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/docs', skipRoutes), false);
  assert.strictEqual(shouldSkipRoute('/other', skipRoutes), false);
});

test('shouldSkipRoute — regex match /api/v*/health', () => {
  const skipRoutes = { exact: new Set(), regex: [/^\/api\/v\d+\/health$/] };
  assert.strictEqual(shouldSkipRoute('/api/v1/health', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/api/v2/health', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/api/v1/users', skipRoutes), false);
  assert.strictEqual(shouldSkipRoute('/api/health', skipRoutes), false);
});

test('shouldSkipRoute — mixed exact + regex', () => {
  const skipRoutes = {
    exact: new Set(['/health']),
    regex: [/^\/docs\/.*/, /^\/internal\/.*/],
  };
  assert.strictEqual(shouldSkipRoute('/health', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/docs/api', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/internal/admin', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/api/users', skipRoutes), false);
});

test('shouldSkipRoute — regex with global flag does not leak lastIndex', () => {
  const skipRoutes = { exact: new Set(), regex: [/^\/docs\/.*/g] };
  assert.strictEqual(shouldSkipRoute('/docs/a', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/docs/b', skipRoutes), true);
  assert.strictEqual(shouldSkipRoute('/docs/c', skipRoutes), true);
});

test('isWritable — writable property', () => {
  assert.strictEqual(isWritable({ a: 1 }, 'a'), true);
});

test('isWritable — non-writable property', () => {
  const obj = {};
  Object.defineProperty(obj, 'a', { value: 1, writable: false });
  assert.strictEqual(isWritable(obj, 'a'), false);
});

test('isWritable — undefined property', () => {
  assert.strictEqual(isWritable({}, 'nonexistent'), true);
});

test('cleanUrl — normalizes paths', () => {
  assert.strictEqual(cleanUrl('/health'), '/health');
  assert.strictEqual(cleanUrl('/health/'), '/health');
  assert.strictEqual(cleanUrl('///health///'), '/health');
  assert.strictEqual(cleanUrl('/path?query=1'), '/path');
  assert.strictEqual(cleanUrl('/path#anchor'), '/path');
});

test('cleanUrl — invalid input returns null', () => {
  assert.strictEqual(cleanUrl(''), null);
  assert.strictEqual(cleanUrl(null), null);
  assert.strictEqual(cleanUrl(42), null);
});

test('isEmail — valid emails', () => {
  assert.strictEqual(isEmail('test@example.com'), true);
  assert.strictEqual(isEmail('user.name+tag@domain.co.uk'), true);
});

test('isEmail — invalid values', () => {
  assert.strictEqual(isEmail('not-an-email'), false);
  assert.strictEqual(isEmail(''), false);
  assert.strictEqual(isEmail(42), false);
  assert.strictEqual(isEmail(null), false);
});

test('isPlainObject — correct detection', () => {
  assert.strictEqual(isPlainObject({}), true);
  assert.strictEqual(isPlainObject({ a: 1 }), true);
  assert.strictEqual(isPlainObject([]), false);
  assert.strictEqual(isPlainObject(null), false);
  assert.strictEqual(isPlainObject('str'), false);
  assert.strictEqual(isPlainObject(new Date()), false);
});

test('isPrimitive — correct detection', () => {
  assert.strictEqual(isPrimitive(null), true);
  assert.strictEqual(isPrimitive(true), true);
  assert.strictEqual(isPrimitive(false), true);
  assert.strictEqual(isPrimitive(42), true);
  assert.strictEqual(isPrimitive('str'), false);
  assert.strictEqual(isPrimitive({}), false);
  assert.strictEqual(isPrimitive([]), false);
});

test('sanitizeString — no lastIndex leakage across calls', () => {
  const o = opts();
  assert.strictEqual(sanitizeString('$first', o, true), 'first');
  assert.strictEqual(sanitizeString('$second', o, true), 'second');
  assert.strictEqual(sanitizeString('$third', o, true), 'third');
});

test('removeMatches — no lastIndex leakage in pattern.test', () => {
  const o = opts({ removeMatches: true });
  const r1 = sanitizeObject({ $a: '1', normal: 'ok' }, o);
  const r2 = sanitizeObject({ $b: '2', safe: 'yes' }, o);
  assert.deepStrictEqual(r1, { normal: 'ok' });
  assert.deepStrictEqual(r2, { safe: 'yes' });
});

test('maxDepth — stops recursion at limit', () => {
  const o = opts({ maxDepth: 1 });
  const input = {
    level1: '$admin',
    nested: { level2: '$danger', deep: { level3: '$hidden' } },
  };
  const result = sanitizeValue(input, o);
  // depth 0 → object keys/values sanitized (strings always sanitized)
  assert.strictEqual(result.level1, 'admin');
  // depth 1 → nested object NOT recursed into
  assert.deepStrictEqual(result.nested, { level2: '$danger', deep: { level3: '$hidden' } });
});

test('maxDepth — null means unlimited', () => {
  const o = opts({ maxDepth: null });
  const input = { a: { b: { c: { d: '$deep' } } } };
  const result = sanitizeValue(input, o);
  assert.strictEqual(result.a.b.c.d, 'deep');
});

test('maxDepth — depth 2 sanitizes 2 levels deep', () => {
  const o = opts({ maxDepth: 2 });
  const input = { a: { b: '$ok', c: { d: '$stop' } } };
  const result = sanitizeValue(input, o);
  assert.strictEqual(result.a.b, 'ok'); // string at depth 1 — always sanitized
  assert.strictEqual(result.a.c.d, '$stop'); // depth 2 → object not recursed
});

test('maxDepth — arrays count as depth', () => {
  const o = opts({ maxDepth: 1 });
  const input = [{ name: '$admin' }];
  const result = sanitizeValue(input, o);
  // array at depth 0 → enters array (depth 1), object inside at depth 1 >= maxDepth → not recursed
  assert.deepStrictEqual(result, [{ name: '$admin' }]);
});

test('onSanitize — called for each sanitized string value', () => {
  const calls = [];
  const o = opts({
    onSanitize: (info) => calls.push(info),
  });
  sanitizeObject({ username: '$admin', safe: 'ok' }, o, 0);
  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].key, 'username');
  assert.strictEqual(calls[0].originalValue, '$admin');
  assert.strictEqual(calls[0].sanitizedValue, 'admin');
});

test('onSanitize — not called when value unchanged', () => {
  const calls = [];
  const o = opts({ onSanitize: (info) => calls.push(info) });
  sanitizeObject({ safe: 'hello', also: 'fine' }, o, 0);
  assert.strictEqual(calls.length, 0);
});

test('onSanitize — null means no callback', () => {
  const o = opts({ onSanitize: null });
  assert.doesNotThrow(() => sanitizeObject({ a: '$b' }, o, 0));
});

test('handleRequest — skips body when content-type not in allowed list', () => {
  const o = opts({ sanitizeObjects: ['body', 'query'] });
  const req = {
    headers: { 'content-type': 'multipart/form-data; boundary=---abc' },
    body: { file: '$evil' },
    query: { role: '$admin' },
  };
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { file: '$evil' }); // NOT sanitized
  assert.deepStrictEqual(req.query, { role: 'admin' }); // sanitized
});

test('handleRequest — sanitizes body when content-type is application/json', () => {
  const o = opts();
  const req = {
    headers: { 'content-type': 'application/json; charset=utf-8' },
    body: { name: '$admin' },
    query: {},
  };
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { name: 'admin' });
});

test('handleRequest — sanitizes body when content-type is x-www-form-urlencoded', () => {
  const o = opts();
  const req = {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: { name: '$admin' },
    query: {},
  };
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { name: 'admin' });
});

test('handleRequest — contentTypes null allows all content types', () => {
  const o = opts({ contentTypes: null });
  const req = {
    headers: { 'content-type': 'multipart/form-data' },
    body: { name: '$admin' },
    query: {},
  };
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { name: 'admin' });
});

test('handleRequest — no content-type header still sanitizes body', () => {
  const o = opts();
  const req = {
    headers: {},
    body: { name: '$admin' },
    query: {},
  };
  handleRequest(req, o);
  assert.deepStrictEqual(req.body, { name: 'admin' });
});

test('extractMimeType — extracts from content-type header', () => {
  const { extractMimeType } = require('../src');
  assert.strictEqual(extractMimeType('application/json'), 'application/json');
  assert.strictEqual(extractMimeType('application/json; charset=utf-8'), 'application/json');
  assert.strictEqual(extractMimeType('multipart/form-data; boundary=---abc'), 'multipart/form-data');
  assert.strictEqual(extractMimeType('TEXT/HTML'), 'text/html');
  assert.strictEqual(extractMimeType(null), null);
  assert.strictEqual(extractMimeType(42), null);
});

// isPlainObject — null prototype (Fastify compat)
test('isPlainObject — handles null-prototype objects', () => {
  const nullProto = Object.create(null);
  nullProto.a = 1;
  assert.strictEqual(isPlainObject(nullProto), true);
});

test('isPlainObject — handles 2-level null-prototype (Fastify query)', () => {
  // Fastify creates objects with proto = Object.create(null)
  const base = Object.create(null);
  const fastifyQuery = Object.create(base);
  fastifyQuery.a = 1;
  assert.strictEqual(isPlainObject(fastifyQuery), true);
});

test('isPlainObject — rejects RegExp and Date', () => {
  assert.strictEqual(isPlainObject(/test/), false);
  assert.strictEqual(isPlainObject(new Date()), false);
});
