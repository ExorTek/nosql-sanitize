/**
 * Use the sanitization engine directly without Express or Fastify.
 * For: serverless functions, webhooks, queue consumers, unit tests.
 */
const { resolveOptions, sanitizeValue, sanitizeObject } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions();

// String
console.log(sanitizeValue('$admin', opts, true));
// → "admin"

// Object
console.log(sanitizeValue({ $gt: 1, name: '$test' }, opts));
// → { gt: 1, name: "test" }

// Array
console.log(sanitizeValue(['$a', 'b', '$c'], opts));
// → ["a", "b", "c"]

// Email preserved
console.log(sanitizeValue('user@example.com', opts, true));
// → "user@example.com"

// Primitives pass through
console.log(sanitizeValue(42, opts)); // → 42
console.log(sanitizeValue(null, opts)); // → null
console.log(sanitizeValue(true, opts)); // → true

// Webhook payload
const payload = {
  event: 'user.created',
  data: {
    name: '$malicious',
    query: { $where: 'function() { return true }' },
    tags: ['$admin', 'user'],
  },
};

console.log('\nWebhook sanitized:');
console.log(JSON.stringify(sanitizeValue(payload, opts), null, 2));
