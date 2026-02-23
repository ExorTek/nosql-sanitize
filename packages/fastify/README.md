# @exortek/fastify-mongo-sanitize

Fastify plugin for NoSQL injection prevention. Sanitizes request `body`, `params`, and `query` to protect MongoDB queries from operator injection attacks.

Supports Fastify 4.x and 5.x.

## Installation

```bash
npm install @exortek/fastify-mongo-sanitize
```

## Quick Start

```js
const fastify = require('fastify')();
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(mongoSanitize);

fastify.post('/login', async (request) => {
  // request.body is sanitized — { "$ne": "" } becomes { "ne": "" }
  return request.body;
});

fastify.listen({ port: 3000 });
```

## Options

```js
fastify.register(mongoSanitize, {
  replaceWith: '',           // Replace matched chars with this string
  removeMatches: false,      // Remove entire key-value pair if pattern matches
  sanitizeObjects: ['body', 'params', 'query'],  // Fields to sanitize
  contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
  mode: 'auto',             // 'auto' | 'manual'
  skipRoutes: [],            // Routes to skip (string or RegExp)
  recursive: true,           // Sanitize nested objects
  maxDepth: null,            // Max recursion depth (null = unlimited)
  removeEmpty: false,        // Remove falsy values after sanitization
  allowedKeys: [],           // Whitelist keys (empty = allow all)
  deniedKeys: [],            // Blacklist keys (empty = deny none)
  customSanitizer: null,     // Custom sanitizer function
  onSanitize: null,          // Callback on each sanitization
  patterns: undefined,       // Custom regex patterns
  stringOptions: {
    trim: false,             // Trim whitespace
    lowercase: false,        // Convert to lowercase
    maxLength: null,         // Max string length
  },
  arrayOptions: {
    filterNull: false,       // Remove falsy values from arrays
    distinct: false,         // Remove duplicates
  },
  debug: {
    enabled: false,
    level: 'info',
    logSkippedRoutes: false,
    logPatternMatches: false,
    logSanitizedValues: false,
  },
});
```

> **Note:** Fastify defaults `sanitizeObjects` to `['body', 'params', 'query']` (includes `params`), unlike Express which defaults to `['body', 'query']`.

See [`@exortek/nosql-sanitize-core` README](../core/README.md) for full option details.

## Content-Type Guard

By default, **only `application/json` and `application/x-www-form-urlencoded` request bodies are sanitized**. File uploads, binary data, and other content types are automatically skipped.

Query parameters and route params are always sanitized regardless of content type.

```js
// Override to sanitize all content types
fastify.register(mongoSanitize, { contentTypes: null });

// Or add specific types
fastify.register(mongoSanitize, {
  contentTypes: ['application/json', 'application/graphql'],
});
```

## Skip Routes

Skip sanitization for specific routes using exact strings or regex patterns:

```js
fastify.register(mongoSanitize, {
  skipRoutes: [
    '/health',
    /^\/docs\/.*/,
    /^\/api\/v\d+\/internal/,
  ],
});
```

Route matching normalizes paths: trailing slashes and query strings are ignored.

> **Fastify note:** Fastify treats `/foo` and `/foo/` as different routes. The skip route normalizer treats them as the same for skipping purposes only. Make sure both routes are registered in Fastify if you want both to respond.

## Manual Mode

Control exactly when sanitization happens:

```js
fastify.register(mongoSanitize, { mode: 'manual' });

fastify.post('/sensitive', async (request) => {
  request.sanitize();                      // Use default options
  return request.body;
});

fastify.post('/custom', async (request) => {
  request.sanitize({ replaceWith: '_' });  // Override options
  return request.body;
});

fastify.post('/raw', async (request) => {
  // No sanitize() call — body untouched
  return request.body;
});
```

## Depth Limiting

Prevent deeply nested objects from causing performance issues:

```js
fastify.register(mongoSanitize, { maxDepth: 3 });

// Nested objects beyond depth 3 are returned as-is
// Strings at any depth are always sanitized
```

## Audit Callback

Log or track every sanitization event:

```js
fastify.register(mongoSanitize, {
  onSanitize: ({ key, originalValue, sanitizedValue }) => {
    fastify.log.warn(`Sanitized ${key}: "${originalValue}" → "${sanitizedValue}"`);
  },
});
```

## Key Filtering

```js
// Whitelist
fastify.register(mongoSanitize, {
  allowedKeys: ['username', 'email', 'password'],
});

// Blacklist
fastify.register(mongoSanitize, {
  deniedKeys: ['__proto__', 'constructor', '$where'],
});
```

> **Note:** Email values on denied keys are preserved.

## TypeScript

Type definitions and Fastify request augmentation are included:

```typescript
import fastify from 'fastify';
import mongoSanitize from '@exortek/fastify-mongo-sanitize';

const app = fastify();

app.register(mongoSanitize, {
  recursive: true,
  maxDepth: 5,
  debug: { enabled: true, level: 'debug' },
});

app.post('/test', async (request) => {
  request.sanitize?.();  // Available in manual mode
  return request.body;
});
```

## Compatibility

| Fastify | Supported |
|---------|-----------|
| 4.x     | ✅        |
| 5.x     | ✅        |

## License

[MIT](../../LICENSE) — ExorTek
