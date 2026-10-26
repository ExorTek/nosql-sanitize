# @exortek/nosql-sanitize-core

## 3.2.0

### Minor Changes

- d82d6bc: - New `debug.logger` option: any object with `error`, `warn`, `info`, `debug` and `trace` methods (pino, `fastify.log`, `console`) receives the debug output instead of `console.log`. It is called pino-style, `logger[level]({ module: 'nosql-sanitize', context, data? }, message)`. `debug.level`, `logSanitizedValues` and `logPatternMatches` apply as before. Default `null` keeps the current `console.log` output.
  - Fastify: `debug.logger: 'request'` logs through each request's `request.log` (so lines carry the request id) and through `fastify.log` outside a request. Works in plugin options, route `config.mongoSanitize` and manual mode.

## 3.1.0

### Minor Changes

- 2479778: Add `allowedOperators` and `dotKeys`:

  - `allowedOperators: string[]` keeps the listed `$`-operators verbatim at every depth, for example `['$set']` on a trusted admin update route. Values under them are still sanitized. Listed operators also pass the `allowedKeys` whitelist and are never dropped by `removeMatches`; `deniedKeys` still removes them. Each entry must be a string that starts with `$`. `allowedKeys` remains a key whitelist and never let operators through.
  - `dotKeys: 'allow' | 'replace' | 'remove'` handles keys containing `.` (such as `'profile.isAdmin'`), which turn into nested writes when spread into `$set`. `'replace'` swaps each `.` for `replaceWith`. `'remove'` drops the pair and reports `onSanitize` reason `'dotKey'`. The default `'allow'` keeps the current behavior.

- 4582414: Sanitize multipart and `+json` bodies, and survive circular references:

  - `multipart/form-data` is now in the default `contentTypes`. multer and busboy parse `user[$ne]=x` into `{ user: { $ne: 'x' } }`, so multipart routes were open to operator injection. Only the parsed fields are touched, never files. To keep the old behavior, pass `contentTypes: ['application/json', 'application/x-www-form-urlencoded']`.
  - `+json` types (`application/vnd.api+json`, `application/merge-patch+json`, …) are sanitized whenever `application/json` is in `contentTypes`.
  - Circular references are cut instead of recursing forever, and reported via `onSanitize` with the new reason `'circular'`. This is required for `@fastify/multipart` with `attachFieldsToBody: true`, whose field objects point back at the body through `fields`. Those field objects no longer carry `fields` after sanitization.

- e70ccbd: Add modes for `removeEmpty` and `arrayOptions.filterNull`, which today also drop `0` and `false`:

  - `removeEmpty: 'empty'` only removes `''`, `null`, `undefined`, `{}` and `[]`, so `0` and `false` are kept.
  - `arrayOptions.filterNull: 'nullish'` only removes `null` and `undefined`.

  `true` keeps its current meaning, and `'falsy'` is a new explicit alias for it. A future major version may switch the meaning of `true` to the new modes.

- c99ba2e: Add standalone `sanitize(value, options?)` and `hasInjection(value, options?)` for data that doesn't come through an HTTP request (GraphQL arguments, WebSocket messages, queue payloads). `sanitize` returns a sanitized copy. `hasInjection` reports whether sanitizing would neutralize an injection (operator characters, prototype keys, dotted keys with `dotKeys` set) without changing anything, and scans every depth regardless of `maxDepth`. Both accept user or resolved options and resolve a user options object once.
- 851ec41: Add `onInjection: 'sanitize' | 'reject' | 'report'` (default `'sanitize'`, unchanged behavior):

  - `'reject'` answers 400 instead of stripping an injection. `handleRequest` throws `NoSQLSanitizeError` with `type: 'injection_detected'` and `statusCode: 400`, using the same rules as `hasInjection`. Requests without an injection are still sanitized as configured.
  - `'report'` is a dry run for a safe rollout: changes are reported through `onSanitize` (required) and requests are left untouched.

  `NoSQLSanitizeError` takes an optional `statusCode`. The Fastify preHandler hook now passes sanitizer errors to `done(err)`.

### Patch Changes

- a34287a: Adapter fixes:

  - Fastify: `request.sanitize(customOpts)` in manual mode no longer drops the plugin's `sanitizeObjects` default (`['body', 'params', 'query']`). Before, route params went through unsanitized whenever custom options were passed.
  - Express: the `Plugin initialized` debug log is written once at setup instead of on every request.
  - Express and Fastify: manual-mode custom options are resolved once per options object and cached, instead of on every `sanitize()` call. Don't mutate an options object after passing it.
  - All packages list the `types` condition first in `exports`.

- 6e770cb: Fix key casing, log hygiene and nested option validation:

  - `stringOptions.trim` and `stringOptions.lowercase` apply to values only. Before, they also rewrote keys, so `{ userName: 'A' }` became `{ username: 'a' }`.
  - Original and sanitized strings are logged only with `debug.logSanitizedValues: true`. Before, they were logged whenever debug logging was at `debug` level. `debug.logPatternMatches` now logs a match without the value.
  - `paramSanitizeHandler` no longer logs raw route param values (only with `debug.logSanitizedValues`).
  - Debug logging no longer throws on circular or `BigInt` data.
  - The fields of `stringOptions`, `arrayOptions` and `debug` are validated. An invalid value such as `debug.level: 'bogus'` or `stringOptions.maxLength: -1` now throws a `type_error` that names the field. `stringOptions.maxLength` must be `null` or a positive integer.

- 6536bdf: Harden option handling:

  - `patterns` must be a non-empty array of `RegExp`s. A string pattern used to silently disable sanitization, and an empty array used to match everywhere. Both now throw a `type_error`.
  - Pattern flags are kept when patterns are combined, so `/where/i` matches `WHERE`.
  - `replaceWith` is inserted literally. `$&` / `$1` are no longer expanded.
  - With `maxDepth: null`, nesting deeper than 256 levels now throws `NoSQLSanitizeError('max_depth')`. Before, a hostile payload overflowed the stack with a raw `RangeError`.
  - `DEFAULT_OPTIONS` is deeply frozen, and resolved options no longer share arrays with it.
  - With `allowPrototypeKeys: true`, `__proto__` is kept as an own key instead of swapping the result object's prototype.

- 89e58e4: Fix option resolution:

  - Options set to `undefined` now fall back to their defaults, like options that are left out. Before, `{ recursive: undefined }` turned recursion off, so nested objects went through unsanitized, and `{ replaceWith: undefined }` inserted the string `'undefined'`. The same applies to the fields of `stringOptions`, `arrayOptions` and `debug`.
  - `sanitizeObjects` given as a string (e.g. `'body'`) now throws a `type_error`. Before, it was split into `['b', 'o', 'd', 'y']` and nothing was sanitized.

- b507005: Correct documentation and type comments that described behavior the code doesn't have. `allowedKeys` is a whitelist applied at every depth, not an operator allow-list. `removeEmpty`/`filterNull` drop every falsy value. Multipart and `+json` bodies are not sanitized by default. Express route params need `paramSanitizeHandler`. Also add a production hardening guide and a threat-model section to `SECURITY.md`. No runtime changes.

## 3.0.1

### Patch Changes

- fa12cb7: Refresh published package metadata: expanded npm `keywords` and enriched READMEs (concrete attack example, compatibility matrix for Express/Fastify 4.x + 5.x, ESM/TypeScript usage, table of contents). No API changes.
- 67a11a1: Skip per-request debug allocations in `handleRequest` when `debug.enabled` is false. The timing closure and the per-field log message strings are no longer built on the hot path unless debug logging is actually turned on. No behavioural change when debug is enabled.
