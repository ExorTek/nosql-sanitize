# @exortek/express-mongo-sanitize

Express middleware for NoSQL injection prevention. Sanitizes request `body`, `query`, and `params` to protect MongoDB queries from operator injection attacks.

Supports Express 4.x and 5.x.

## Installation

```bash
npm install @exortek/express-mongo-sanitize
```

## Quick Start

```js
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize());

app.post('/login', (req, res) => {
  // req.body is sanitized — { "$ne": "" } becomes { "ne": "" }
  res.json(req.body);
});
```

## Options

```js
app.use(mongoSanitize({
  replaceWith: '',           // Replace matched chars with this string
  removeMatches: false,      // Remove entire key-value pair if pattern matches
  sanitizeObjects: ['body', 'query'],  // Fields to sanitize
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
}));
```

See [`@exortek/nosql-sanitize-core` README](../core/README.md) for full option details.

## Content-Type Guard

By default, **only `application/json` and `application/x-www-form-urlencoded` request bodies are sanitized**. File uploads (`multipart/form-data`), binary data (`application/octet-stream`), and other content types are automatically skipped.

Query parameters and route params are always sanitized regardless of content type.

```js
// Override to sanitize all content types
app.use(mongoSanitize({ contentTypes: null }));

// Or add specific types
app.use(mongoSanitize({
  contentTypes: ['application/json', 'application/graphql'],
}));
```

## Skip Routes

Skip sanitization for specific routes using exact strings or regex patterns:

```js
app.use(mongoSanitize({
  skipRoutes: [
    '/health',              // Exact match
    '/metrics',             // Exact match
    /^\/docs\/.*/,          // Regex: /docs/* and everything below
    /^\/api\/v\d+\/internal/,  // Regex: /api/v1/internal, /api/v2/internal
  ],
}));
```

Route matching normalizes paths: trailing slashes and query strings are ignored.

## Manual Mode

Control exactly when sanitization happens:

```js
app.use(mongoSanitize({ mode: 'manual' }));

app.post('/sensitive', (req, res) => {
  req.sanitize();                      // Use default options
  res.json(req.body);
});

app.post('/custom', (req, res) => {
  req.sanitize({ replaceWith: '_' });  // Override options per-route
  res.json(req.body);
});

app.post('/raw', (req, res) => {
  // No sanitize() call — body remains untouched
  res.json(req.body);
});
```

## Route Parameter Sanitization

Express `body` and `query` are sanitized automatically. For route parameters, use `paramSanitizeHandler`:

```js
const { paramSanitizeHandler } = require('@exortek/express-mongo-sanitize');

app.param('username', paramSanitizeHandler());

app.get('/user/:username', (req, res) => {
  // /user/$admin → req.params.username === 'admin'
  res.json({ username: req.params.username });
});
```

## Depth Limiting

Prevent deeply nested objects from causing performance issues:

```js
app.use(mongoSanitize({ maxDepth: 3 }));

// Nested objects beyond depth 3 are returned as-is (not sanitized)
// Strings at any depth are always sanitized
```

## Audit Callback

Log or track every sanitization event:

```js
app.use(mongoSanitize({
  onSanitize: ({ key, originalValue, sanitizedValue }) => {
    console.log(`Sanitized ${key}: "${originalValue}" → "${sanitizedValue}"`);
    // Or: metrics.increment('nosql.sanitized');
  },
}));
```

## Key Filtering

```js
// Only allow specific keys (whitelist)
app.use(mongoSanitize({
  allowedKeys: ['username', 'email', 'password'],
}));

// Block specific keys (blacklist)
app.use(mongoSanitize({
  deniedKeys: ['__proto__', 'constructor', '$where'],
}));
```

> **Note:** Email values on denied keys are preserved. `{ "email": "user@example.com" }` won't be removed even if `email` is in `deniedKeys`.

## TypeScript

Type definitions are included:

```typescript
import mongoSanitize, { paramSanitizeHandler, SanitizeOptions } from '@exortek/express-mongo-sanitize';

const options: SanitizeOptions = {
  replaceWith: '_',
  maxDepth: 5,
};

app.use(mongoSanitize(options));
```

## Compatibility

| Express | Supported |
|---------|-----------|
| 4.x     | ✅        |
| 5.x     | ✅        |

Express 5's non-writable `req.query` is handled automatically via `Object.defineProperty`.

## License

[MIT](../../LICENSE) — ExorTek
