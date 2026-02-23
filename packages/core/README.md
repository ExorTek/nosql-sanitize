# @exortek/nosql-sanitize-core

Core sanitization engine for NoSQL injection prevention. This package provides the sanitization logic used by both `@exortek/express-mongo-sanitize` and `@exortek/fastify-mongo-sanitize`.

## Installation

```bash
npm install @exortek/nosql-sanitize-core
```

> **Note:** Most users should install the framework-specific package (`express-mongo-sanitize` or `fastify-mongo-sanitize`) instead. Use this package directly only if you're building a custom integration.

## API

### `resolveOptions(options?)`

Merges user options with defaults, pre-compiles regex patterns, and validates configuration.

```js
const { resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions({
  replaceWith: '_',
  maxDepth: 5,
  contentTypes: ['application/json'],
});
```

### `sanitizeValue(value, options, isValue?, depth?)`

Main entry point. Dispatches to the appropriate sanitizer based on type.

```js
const { sanitizeValue, resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions();
sanitizeValue('$admin', opts, true);           // → 'admin'
sanitizeValue({ $gt: 1 }, opts);               // → { gt: 1 }
sanitizeValue(['$a', '$b'], opts);             // → ['a', 'b']
sanitizeValue(null, opts);                     // → null
sanitizeValue(42, opts);                       // → 42
```

### `sanitizeString(str, options, isValue?)`

Sanitizes a single string. Preserves email addresses.

### `sanitizeObject(obj, options, depth?)`

Sanitizes all keys and values of a plain object.

### `sanitizeArray(arr, options, depth?)`

Sanitizes all elements of an array.

### `handleRequest(request, options)`

Sanitizes a request object's `body`, `query`, and/or `params` fields in-place. Includes content-type guard and Express 5 non-writable property support.

### `shouldSkipRoute(requestPath, skipRoutes, debug?)`

Checks if a request path matches any skip route (exact string or regex).

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `replaceWith` | `string` | `''` | Replacement for matched patterns |
| `removeMatches` | `boolean` | `false` | Remove entire key-value pair if pattern found |
| `sanitizeObjects` | `string[]` | `['body', 'query']` | Request fields to sanitize |
| `contentTypes` | `string[]` \| `null` | `['application/json', 'application/x-www-form-urlencoded']` | Only sanitize body for these content types. `null` = all types |
| `mode` | `'auto'` \| `'manual'` | `'auto'` | Auto-sanitize or expose `req.sanitize()` |
| `skipRoutes` | `(string \| RegExp)[]` | `[]` | Routes to skip. Supports exact strings and regex patterns |
| `customSanitizer` | `function` \| `null` | `null` | Custom sanitizer `(data, options) => sanitizedData` |
| `onSanitize` | `function` \| `null` | `null` | Callback when a value is sanitized `({ key, originalValue, sanitizedValue }) => void` |
| `recursive` | `boolean` | `true` | Recursively sanitize nested objects/arrays |
| `removeEmpty` | `boolean` | `false` | Remove falsy values after sanitization |
| `maxDepth` | `number` \| `null` | `null` | Max recursion depth for nested objects. `null` = unlimited |
| `patterns` | `RegExp[]` | `[/\$/g, /[\u0000-\u001F\u007F-\u009F]/g]` | Patterns to match and replace |
| `allowedKeys` | `string[]` | `[]` | Only allow these keys (empty = allow all) |
| `deniedKeys` | `string[]` | `[]` | Remove these keys (empty = deny none) |
| `stringOptions` | `object` | `{ trim: false, lowercase: false, maxLength: null }` | String transform options |
| `arrayOptions` | `object` | `{ filterNull: false, distinct: false }` | Array transform options |
| `debug` | `object` | `{ enabled: false, level: 'info', ... }` | Debug logging configuration |

## Sanitization Patterns

Default patterns target MongoDB injection vectors:

| Pattern | Matches | Purpose |
|---------|---------|---------|
| `/\$/g` | `$` character | MongoDB operator prefix (`$gt`, `$ne`, `$where`, etc.) |
| `/[\u0000-\u001F\u007F-\u009F]/g` | Control characters | Null bytes and C0/C1 control chars |

Custom patterns can be provided to extend or replace defaults:

```js
const opts = resolveOptions({
  patterns: [
    /\$/g,                              // Keep $ removal
    /[\u0000-\u001F\u007F-\u009F]/g,   // Keep control chars
    /\{/g,                              // Also remove {
  ],
});
```

## License

[MIT](../../LICENSE) — ExorTek
