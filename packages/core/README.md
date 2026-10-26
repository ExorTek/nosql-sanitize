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

### `sanitize(value, options?)` / `hasInjection(value, options?)`

Standalone helpers for data that doesn't come through an HTTP request (GraphQL arguments, WebSocket messages, queue payloads). Both accept user options or options from `resolveOptions()`. A user options object is resolved once and cached, so don't mutate it after the first call.

```js
const { sanitize, hasInjection } = require('@exortek/nosql-sanitize-core');

sanitize({ user: { $ne: 'x' } });       // → { user: { ne: 'x' } }
hasInjection({ user: { $ne: 'x' } });   // → true
hasInjection({ name: 'ada' });          // → false
```

- `sanitize` runs the built-in sanitizer (`customSanitizer` is ignored), never mutates its input, and returns an empty object/array if the root itself is dropped.
- `hasInjection` returns `true` when sanitizing would neutralize an injection: a key or string matching `patterns` (emails are exempt with `preserveEmails`), a prototype key, or a dotted key while `dotKeys` isn't `'allow'`. Keys dropped by `deniedKeys` / `allowedKeys` and `allowedOperators` don't count. It scans every depth, regardless of `maxDepth` and `recursive`, and throws `max_depth` past 256 levels.

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

| Parameter | Type      | Default | Description                                                                                 |
|:----------|:----------|:--------|:--------------------------------------------------------------------------------------------|
| `value`   | `*`       | —       | The value to sanitize (string, object, array, or primitive).                                |
| `options` | `Object`  | —       | Resolved options from `resolveOptions()`.                                                   |
| `isValue` | `boolean` | `false` | When `true`, `stringOptions` are applied (keys are never trimmed, lowercased or truncated). |
| `depth`   | `number`  | `0`     | Current recursion depth. Used internally.                                                   |
| `path`    | `string`  | `''`    | Dotted path for `onSanitize` events, built from sanitized keys (e.g., `'body.user.gt'`).    |

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
- Converts `allowedKeys` / `allowedOperators` / `deniedKeys` to `Set`s

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

| Option                     | Type                                | Default             | Description                                                                                                           |
|:---------------------------|:------------------------------------|:--------------------|:----------------------------------------------------------------------------------------------------------------------|
| `replaceWith`              | `string`                            | `''`                | String to replace matched patterns with.                                                                              |
| `removeMatches`            | `boolean`                           | `false`             | If `true`, removes the entire key-value pair if a match is found.                                                     |
| `sanitizeObjects`          | `string[]`                          | `['body', 'query']` | Fields on the request object to sanitize.                                                                             |
| `contentTypes`             | `string[] \| null`                  | `[...]`             | Only sanitize `body` for these MIME types (default: JSON, urlencoded, multipart; `+json` follows JSON). `null` = all. |
| `mode`                     | `'auto' \| 'manual'`                | `'auto'`            | Automatically sanitize or expose `req.sanitize()`.                                                                    |
| `skipRoutes`               | `(string \| RegExp)[]`              | `[]`                | Routes to ignore during auto-sanitization. Regexes are not auto-anchored; use `^…$`.                                  |
| `maxDepth`                 | `number \| null`                    | `null`              | Maximum recursion depth. `0` = top-level strings only. `null` = no limit (throws `max_depth` past 256 levels).        |
| `maxDepthBehavior`         | `'preserve' \| 'remove' \| 'throw'` | `'preserve'`        | Action when `maxDepth` exceeded. `'remove'` is recommended (fail-closed).                                             |
| `preserveEmails`           | `boolean`                           | `true`              | Preserve email-looking values. Also bypasses custom `patterns`; set `false` if custom patterns must apply to emails.  |
| `allowPrototypeKeys`       | `boolean`                           | `false`             | Allow `__proto__`, `constructor`, `prototype` keys through.                                                           |
| `recursive`                | `boolean`                           | `true`              | Whether to recursively sanitize nested objects/arrays.                                                                |
| `removeEmpty`              | `boolean \| 'falsy' \| 'empty'`     | `false`             | `true` / `'falsy'`: remove keys whose value is falsy after sanitization (`''`, `null`, `0`, `false`). `'empty'`: keep `0` / `false`, remove `''`, `null`, `{}`, `[]`. |
| `patterns`                 | `RegExp[]`                          | `[/\$/g, /[ --]/g]` | Non-empty array of `RegExp`s, combined into one regex (flags merged). Override to add custom patterns.                |
| `customSanitizer`          | `function \| null`                  | `null`              | Replace the built-in sanitizer with your own function.                                                                |
| `onSanitize`               | `function \| null`                  | `null`              | Audit callback. Fires for value changes, key renames, and removals.                                                   |
| `onInjection`              | `'sanitize' \| 'reject' \| 'report'` | `'sanitize'`        | `'reject'` throws `injection_detected` (`statusCode` 400); `'report'` only emits `onSanitize` events (required) and leaves the request untouched. |
| `allowedKeys`              | `string[]`                          | `[]`                | Key whitelist applied at every depth; unlisted keys are removed. Listed keys are still sanitized (`$` stripped).      |
| `deniedKeys`               | `string[]`                          | `[]`                | Blacklist of keys to remove. With `preserveEmails: true`, a denied key with an email-looking value is kept.           |
| `allowedOperators`         | `string[]`                          | `[]`                | `$`-operators kept verbatim at every depth (exact match). Values under them are still sanitized.                      |
| `dotKeys`                  | `'allow' \| 'replace' \| 'remove'`  | `'allow'`           | Keys containing `.`: keep, replace each `.` with `replaceWith`, or remove the pair.                                   |
| `stringOptions.trim`       | `boolean`                           | `false`             | Trim whitespace from string values (not keys).                                                                        |
| `stringOptions.lowercase`  | `boolean`                           | `false`             | Convert string values (not keys) to lowercase.                                                                        |
| `stringOptions.maxLength`  | `number \| null`                    | `null`              | Truncate string values (not keys) to this length. Must be a positive integer.                                         |
| `arrayOptions.filterNull`  | `boolean \| 'falsy' \| 'nullish'`   | `false`             | `true` / `'falsy'`: remove falsy values (`null`, `undefined`, `0`, `''`, `false`) from arrays. `'nullish'`: only `null` / `undefined`. |
| `arrayOptions.distinct`    | `boolean`                           | `false`             | Remove duplicate values from arrays after sanitization.                                                               |
| `debug.enabled`            | `boolean`                           | `false`             | Enable detailed logging.                                                                                              |
| `debug.level`              | `string`                            | `'info'`            | Log level: `'silent'`, `'error'`, `'warn'`, `'info'`, `'debug'`, `'trace'`.                                           |
| `debug.logSkippedRoutes`   | `boolean`                           | `false`             | Log when routes are skipped.                                                                                          |
| `debug.logPatternMatches`  | `boolean`                           | `false`             | Log when a pattern changes a string, without the value.                                                               |
| `debug.logSanitizedValues` | `boolean`                           | `false`             | Log original and sanitized values. They may contain tokens or PII; keep off in production.                            |
| `debug.logger`             | `object \| null`                    | `null`              | Logger with `error`/`warn`/`info`/`debug`/`trace` methods (pino, `fastify.log`, `console`). `null` writes with `console.log`. Fastify also accepts `'request'`. |

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
