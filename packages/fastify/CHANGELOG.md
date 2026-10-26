# @exortek/fastify-mongo-sanitize

## 4.0.0

### Major Changes

- 685775d: Fail-closed defaults. See the [migration guide](https://github.com/ExorTek/nosql-sanitize/blob/master/MIGRATION-v4.md) for how to keep any v3 behavior.

  - Node.js 20 or newer is required.
  - `maxDepth` defaults to `32` and `maxDepthBehavior` to `'remove'`: values nested deeper are dropped instead of passing through unsanitized.
  - `dotKeys` defaults to `'replace'`: `{ "profile.isAdmin": true }` becomes `{ "profileisAdmin": true }`. With `onInjection: 'reject'`, dotted keys are rejected.
  - `deniedKeys` always remove the key, even when its value looks like an email (`preserveEmails` no longer overrides them).
  - `removeEmpty: true` now means `'empty'` (keeps `0` and `false`, removes `{}` and `[]`), and `arrayOptions.filterNull: true` means `'nullish'`. Use `'falsy'` for the v3 behavior.
  - Fastify: sanitizes in `preValidation` by default, so schemas validate the sanitized data (`hook: 'preHandler'` restores v3).
  - Fastify: debug output goes through `request.log` by default when a Fastify logger is configured (`debug.logger: null` restores `console.log`).

### Patch Changes

- Updated dependencies [685775d]
  - @exortek/nosql-sanitize-core@4.0.0

## 3.2.0

### Minor Changes

- d82d6bc: - New `debug.logger` option: any object with `error`, `warn`, `info`, `debug` and `trace` methods (pino, `fastify.log`, `console`) receives the debug output instead of `console.log`. It is called pino-style, `logger[level]({ module: 'nosql-sanitize', context, data? }, message)`. `debug.level`, `logSanitizedValues` and `logPatternMatches` apply as before. Default `null` keeps the current `console.log` output.
  - Fastify: `debug.logger: 'request'` logs through each request's `request.log` (so lines carry the request id) and through `fastify.log` outside a request. Works in plugin options, route `config.mongoSanitize` and manual mode.

### Patch Changes

- Updated dependencies [d82d6bc]
  - @exortek/nosql-sanitize-core@3.2.0

## 3.1.0

### Minor Changes

- 4582414: Sanitize multipart and `+json` bodies, and survive circular references:

  - `multipart/form-data` is now in the default `contentTypes`. multer and busboy parse `user[$ne]=x` into `{ user: { $ne: 'x' } }`, so multipart routes were open to operator injection. Only the parsed fields are touched, never files. To keep the old behavior, pass `contentTypes: ['application/json', 'application/x-www-form-urlencoded']`.
  - `+json` types (`application/vnd.api+json`, `application/merge-patch+json`, …) are sanitized whenever `application/json` is in `contentTypes`.
  - Circular references are cut instead of recursing forever, and reported via `onSanitize` with the new reason `'circular'`. This is required for `@fastify/multipart` with `attachFieldsToBody: true`, whose field objects point back at the body through `fields`. Those field objects no longer carry `fields` after sanitization.

- e85a17d: - Route-level `config.mongoSanitize`: `false` turns sanitization off for a route, and an options object is merged over the plugin options for that route. Route options are resolved once per route, and an invalid route config fails at startup.
  - New `hook: 'preHandler' | 'preValidation'` option (default `'preHandler'`). With `'preValidation'`, the schema validates the sanitized data instead of the raw input.
  - Invalid plugin options now reject `fastify.ready()`. Before, they crashed the process with an uncaught exception.
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

- b507005: Correct documentation and type comments that described behavior the code doesn't have. `allowedKeys` is a whitelist applied at every depth, not an operator allow-list. `removeEmpty`/`filterNull` drop every falsy value. Multipart and `+json` bodies are not sanitized by default. Express route params need `paramSanitizeHandler`. Also add a production hardening guide and a threat-model section to `SECURITY.md`. No runtime changes.
- 367ce07: Bump `fastify-plugin` to `^6.0.1`.
- Updated dependencies [a34287a]
- Updated dependencies [2479778]
- Updated dependencies [4582414]
- Updated dependencies [e70ccbd]
- Updated dependencies [6e770cb]
- Updated dependencies [6536bdf]
- Updated dependencies [89e58e4]
- Updated dependencies [c99ba2e]
- Updated dependencies [b507005]
- Updated dependencies [851ec41]
  - @exortek/nosql-sanitize-core@3.1.0

## 3.0.1

### Patch Changes

- fa12cb7: Bump the `fastify-plugin` dependency to v6. The plugin wrapper API is unchanged and the Fastify 4/5 integration suites pass on it.
- fa12cb7: Refresh published package metadata: expanded npm `keywords` and enriched READMEs (concrete attack example, compatibility matrix for Express/Fastify 4.x + 5.x, ESM/TypeScript usage, table of contents). No API changes.
- Updated dependencies [fa12cb7]
- Updated dependencies [67a11a1]
  - @exortek/nosql-sanitize-core@3.0.1
