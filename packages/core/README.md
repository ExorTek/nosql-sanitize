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

### `sanitizeValue(value, options, isValue?, depth?, path?)`

The main entry point for sanitization. It intelligently dispatches to specialized sanitizers based on the data type.

```js
const { sanitizeValue, resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions();
sanitizeValue('$admin', opts, true);           // → 'admin'
sanitizeValue({ $gt: 1 }, opts);               // → { gt: 1 }
sanitizeValue(['$a', '$b'], opts);             // → ['a', 'b']
```

**Parameters:**

| Parameter | Type      | Default | Description                                                                   |
|:----------|:----------|:--------|:------------------------------------------------------------------------------|
| `value`   | `*`       | —       | The value to sanitize (string, object, array, or primitive).                  |
| `options` | `Object`  | —       | Resolved options from `resolveOptions()`.                                     |
| `isValue` | `boolean` | `false` | When `true`, `stringOptions.maxLength` is applied (keys are never truncated). |
| `depth`   | `number`  | `0`     | Current recursion depth. Used internally.                                     |
| `path`    | `string`  | `''`    | Dotted path for `onSanitize` events (e.g., `'body.user.$gt'`).                |

### `resolveOptions(options?)`

Merges user-provided options with defaults, pre-compiles regex patterns, and validates the configuration. Call once at init time, not per-request.

```js
const { resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions({
  replaceWith: '_',
  maxDepth: 5,
  maxDepthBehavior: 'remove',
});
```

**What it does internally:**
- Validates all option types (throws `NoSQLSanitizeError` on invalid config)
- Pre-compiles `patterns` into a single `_combinedPattern` regex for performance
- Converts `skipRoutes` strings to cleaned paths in a `Set` (O(1) lookup)
- Converts `contentTypes` to a lowercase `Set`
- Converts `allowedKeys` / `deniedKeys` to `Set`s

### `handleRequest(request, options)`

Sanitizes a request object's fields (`body`, `query`, `params`) in-place. Used by Express and Fastify adapters.

- Skips `body` when the request's `Content-Type` is not in the `contentTypes` set
- Skips empty objects (no wasted work)
- Handles Express 5's non-writable `req.query` via `Object.defineProperty` fallback
- Passes a shallow clone to `customSanitizer` to prevent accidental mutation
- Fail-closed: if the root value itself is dropped by `maxDepth` (e.g., `maxDepth: 0` with an object body), an empty container (`{}` or `[]`) is assigned instead of leaking raw input

### `REMOVE` (Symbol)

Sentinel returned by `sanitizeValue` when a value is dropped by the `maxDepth` guard (`maxDepthBehavior: 'remove'`). Callers must check for `sanitized === REMOVE` and skip the value.

```js
const { sanitizeValue, resolveOptions, REMOVE } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions({ maxDepth: 1, maxDepthBehavior: 'remove' });
const result = sanitizeValue(deeplyNested, opts);
if (result === REMOVE) {
  // Value was dropped — do not assign
}
```

### `shouldSkipRoute(requestPath, skipRoutes, debug?)`

Checks if a request path should skip sanitization.

```js
const { shouldSkipRoute, resolveOptions } = require('@exortek/nosql-sanitize-core');

const opts = resolveOptions({ skipRoutes: ['/health', /^\/api\/v[0-9]+\/status/] });
shouldSkipRoute('/health', opts.skipRoutes);   // → true
shouldSkipRoute('/api/v2/status', opts.skipRoutes); // → true
shouldSkipRoute('/login', opts.skipRoutes);    // → false
```

---

## ⚙️ Configuration Options

| Option                    | Type                                | Default             | Description                                                                                                          |
|:--------------------------|:------------------------------------|:--------------------|:---------------------------------------------------------------------------------------------------------------------|
| `replaceWith`             | `string`                            | `''`                | String to replace matched patterns with.                                                                             |
| `removeMatches`           | `boolean`                           | `false`             | If `true`, removes the entire key-value pair if a match is found.                                                    |
| `sanitizeObjects`         | `string[]`                          | `['body', 'query']` | Fields on the request object to sanitize.                                                                            |
| `contentTypes`            | `string[] \| null`                  | `[...]`             | Only sanitize `body` for these MIME types (default: JSON, urlencoded, multipart; `+json` follows JSON). `null` = all. |
| `mode`                    | `'auto' \| 'manual'`                | `'auto'`            | Automatically sanitize or expose `req.sanitize()`.                                                                   |
| `skipRoutes`              | `(string \| RegExp)[]`              | `[]`                | Routes to ignore during auto-sanitization. Regexes are not auto-anchored; use `^…$`.                                 |
| `maxDepth`                | `number \| null`                    | `null`              | Maximum recursion depth. `0` = top-level strings only. `null` = unlimited.                                           |
| `maxDepthBehavior`        | `'preserve' \| 'remove' \| 'throw'` | `'preserve'`        | Action when `maxDepth` exceeded. `'remove'` is recommended (fail-closed).                                            |
| `preserveEmails`          | `boolean`                           | `true`              | Preserve email-looking values. Also bypasses custom `patterns`; set `false` if custom patterns must apply to emails. |
| `allowPrototypeKeys`      | `boolean`                           | `false`             | Allow `__proto__`, `constructor`, `prototype` keys through.                                                          |
| `recursive`               | `boolean`                           | `true`              | Whether to recursively sanitize nested objects/arrays.                                                               |
| `removeEmpty`             | `boolean`                           | `false`             | Remove keys whose value is falsy after sanitization (`''`, `null`, `0`, `false`).                                    |
| `patterns`                | `RegExp[]`                          | `[/\$/g, /[ --]/g]` | Regex patterns to match. Override to add custom patterns.                                                            |
| `customSanitizer`         | `function \| null`                  | `null`              | Replace the built-in sanitizer with your own function.                                                               |
| `onSanitize`              | `function \| null`                  | `null`              | Audit callback. Fires for value changes, key renames, and removals.                                                  |
| `allowedKeys`             | `string[]`                          | `[]`                | Key whitelist applied at every depth; unlisted keys are removed. Listed keys are still sanitized (`$` stripped).    |
| `deniedKeys`              | `string[]`                          | `[]`                | Blacklist of keys to remove. With `preserveEmails: true`, a denied key with an email-looking value is kept.         |
| `stringOptions.trim`      | `boolean`                           | `false`             | Trim whitespace from sanitized strings.                                                                              |
| `stringOptions.lowercase` | `boolean`                           | `false`             | Convert sanitized strings to lowercase.                                                                              |
| `stringOptions.maxLength` | `number \| null`                    | `null`              | Truncate string values (not keys) to this length.                                                                    |
| `arrayOptions.filterNull` | `boolean`                           | `false`             | Remove falsy values (`null`, `undefined`, `0`, `''`, `false`) from arrays after sanitization.                        |
| `arrayOptions.distinct`   | `boolean`                           | `false`             | Remove duplicate values from arrays after sanitization.                                                              |
| `debug.enabled`           | `boolean`                           | `false`             | Enable detailed logging.                                                                                             |
| `debug.level`             | `string`                            | `'info'`            | Log level: `'silent'`, `'error'`, `'warn'`, `'info'`, `'debug'`, `'trace'`.                                          |
| `debug.logSkippedRoutes`  | `boolean`                           | `false`             | Log when routes are skipped.                                                                                         |

## 🔒 Security Defaults

### Prototype Pollution Protection

`__proto__`, `constructor`, and `prototype` keys are stripped by default. The sanitized key is checked against `DANGEROUS_KEYS`, so smuggled variants (e.g., `"__pro\0to__"` after control character stripping becomes `"__proto__"`) are also caught.

Opt out with `allowPrototypeKeys: true` only if you fully trust the input.

### maxDepthBehavior

| Behavior                     | Description                | Security                                           |
|:-----------------------------|:---------------------------|:---------------------------------------------------|
| `'preserve'` (default)       | Pass through unsanitized   | **Unsafe** — injection vectors bypass sanitization |
| `'remove'` (**recommended**) | Drop the value             | **Safe** — fail-closed                             |
| `'throw'`                    | Throw `NoSQLSanitizeError` | **Safe** — rejects the request                     |

> `'preserve'` is the default for backward compatibility only. Always use `'remove'` or `'throw'` in production.

## 🔍 Default Patterns

The core engine targets common MongoDB injection vectors:

1.  **Operator Prefix**: `$` (Matches characters used for `$gt`, `$ne`, `$where`, etc.)
2.  **Control Characters**: Null bytes and C0/C1 control characters (` -`).

You can override these by passing a `patterns` array in the options.

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
