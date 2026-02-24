# @exortek/nosql-sanitize-core

> [!IMPORTANT]
> This is an internal core package for the `nosql-sanitize` monorepo. It is not intended for standalone public use.

Core sanitization engine for NoSQL injection prevention. This package provides the high-performance logic used by framework-specific adapters.

## 📦 Usage

Most users should install the framework-specific package ([`express-mongo-sanitize`](../express) or [`fastify-mongo-sanitize`](../fastify)) instead. Use this package directly only if you're building a custom integration or need standalone sanitization.

### Installation (Internal Only)

```bash
npm install @exortek/nosql-sanitize-core
```

## 🚀 API Reference

### `sanitizeValue(value, options, isValue?, depth?)`

The main entry point for sanitization. It intelligently dispatches to specialized sanitizers based on the data type.

```js
const { sanitizeValue, resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions();
sanitizeValue('$admin', opts, true);           // → 'admin'
sanitizeValue({ $gt: 1 }, opts);               // → { gt: 1 }
sanitizeValue(['$a', '$b'], opts);             // → ['a', 'b']
```

### `resolveOptions(options?)`

Merges user-provided options with defaults, pre-compiles regex patterns, and validates the configuration.

```js
const { resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions({
  replaceWith: '_',
  maxDepth: 5,
});
```

### `handleRequest(request, options)`

A utility function to sanitize a request object's fields (`body`, `query`, `params`) in-place. Used by Express and Fastify adapters.

---

## ⚙️ Configuration Options

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `replaceWith` | `string` | `''` | String to replace matched patterns with. |
| `removeMatches` | `boolean` | `false` | If `true`, removes the entire key-value pair if a match is found. |
| `sanitizeObjects` | `string[]` | `['body', 'query']` | Fields on the request object to sanitize. |
| `contentTypes` | `string[] \| null` | `[...]` | Only sanitize `body` for these content types. `null` = all. |
| `mode` | `'auto' \| 'manual'` | `'auto'` | Automatically sanitize or expose `req.sanitize()`. |
| `skipRoutes` | `(string \| RegExp)[]` | `[]` | Routes to ignore during auto-sanitization. |
| `maxDepth` | `number \| null` | `null` | Maximum recursion depth for nested structures. |
| `recursive` | `boolean` | `true` | Whether to recursively sanitize nested objects/arrays. |
| `onSanitize` | `function` | `null` | Hook called when a value is sanitized. |
| `allowedKeys` | `string[]` | `[]` | Whitelist of keys to allow without sanitization. |
| `deniedKeys` | `string[]` | `[]` | Blacklist of keys to completely remove. |

## 🔍 Default Patterns

The core engine targets common MongoDB injection vectors:

1.  **Operator Prefix**: `$` (Matches characters used for `$gt`, `$ne`, `$where`, etc.)
2.  **Control Characters**: Null bytes and C0/C1 control characters (`\u0000-\u001F`).

You can override these by passing a `patterns` array in the options.

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
