/**
 * Core — Standalone Usage
 *
 * Use the core sanitization engine directly without Express or Fastify.
 * Useful for: custom frameworks, serverless functions, unit tests,
 * sanitizing data from queues/webhooks.
 *
 * Run: node examples/core-standalone.js
 */
const {
  resolveOptions,
  sanitizeValue,
  sanitizeString,
  sanitizeObject,
  sanitizeArray,
} = require('@exortek/nosql-sanitize-core');

// ─── Basic usage ────────────────────────────────────────────
const opts = resolveOptions();

console.log('=== Basic Sanitization ===');
console.log(sanitizeValue('$admin', opts, true)); // 'admin'
console.log(sanitizeValue({ $gt: 1 }, opts)); // { gt: 1 }
console.log(sanitizeValue(['$a', 'b', '$c'], opts)); // ['a', 'b', 'c']
console.log(sanitizeValue(null, opts)); // null
console.log(sanitizeValue(42, opts)); // 42
console.log(sanitizeValue('user@mail.com', opts, true)); // 'user@mail.com' (preserved)

// ─── Custom options ─────────────────────────────────────────
console.log('\n=== Custom Options ===');

const strictOpts = resolveOptions({
  replaceWith: '_',
  stringOptions: { trim: true, lowercase: true, maxLength: 20 },
  arrayOptions: { filterNull: true, distinct: true },
});

console.log(sanitizeString('  $HELLO World  ', strictOpts, true)); // '_hello world'
console.log(sanitizeArray(['$a', '$a', null, '$b'], strictOpts)); // ['_a', '_b']

// ─── Depth limiting ─────────────────────────────────────────
console.log('\n=== Depth Limiting ===');

const shallowOpts = resolveOptions({ maxDepth: 1 });
const deepObject = {
  name: '$admin',
  nested: { inner: '$danger', deep: { hidden: '$secret' } },
};

const result = sanitizeValue(deepObject, shallowOpts);
console.log(result.name); // 'admin' (strings always sanitized)
console.log(result.nested.inner); // '$danger' (depth limit reached)
console.log(result.nested.deep.hidden); // '$secret' (not recursed)

// ─── Audit callback ─────────────────────────────────────────
console.log('\n=== Audit Callback ===');

const auditOpts = resolveOptions({
  onSanitize: ({ key, originalValue, sanitizedValue }) => {
    console.log(`  [AUDIT] ${key}: "${originalValue}" → "${sanitizedValue}"`);
  },
});

sanitizeObject({ username: '$admin', email: 'safe@mail.com', role: '$super' }, auditOpts, 0);

// ─── Webhook/queue data sanitization ────────────────────────
console.log('\n=== Webhook Sanitization ===');

const webhookPayload = {
  event: 'user.created',
  data: {
    name: '$malicious',
    query: { $where: 'function() { return true }' },
    tags: ['$admin', 'user', '$system'],
  },
};

const sanitized = sanitizeValue(webhookPayload, opts);
console.log(JSON.stringify(sanitized, null, 2));
