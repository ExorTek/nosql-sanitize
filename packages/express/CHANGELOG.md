# @exortek/express-mongo-sanitize

## 3.1.0

### Minor Changes

- 4582414: Sanitize multipart and `+json` bodies, and survive circular references:

  - `multipart/form-data` is now in the default `contentTypes`. multer and busboy parse `user[$ne]=x` into `{ user: { $ne: 'x' } }`, so multipart routes were open to operator injection. Only the parsed fields are touched, never files. To keep the old behavior, pass `contentTypes: ['application/json', 'application/x-www-form-urlencoded']`.
  - `+json` types (`application/vnd.api+json`, `application/merge-patch+json`, …) are sanitized whenever `application/json` is in `contentTypes`.
  - Circular references are cut instead of recursing forever, and reported via `onSanitize` with the new reason `'circular'`. This is required for `@fastify/multipart` with `attachFieldsToBody: true`, whose field objects point back at the body through `fields`. Those field objects no longer carry `fields` after sanitization.

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

- b507005: Correct documentation and type comments that described behavior the code doesn't have. `allowedKeys` is a whitelist applied at every depth, not an operator allow-list. `removeEmpty`/`filterNull` drop every falsy value. Multipart and `+json` bodies are not sanitized by default. Express route params need `paramSanitizeHandler`. Also add a production hardening guide and a threat-model section to `SECURITY.md`. No runtime changes.
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

- fa12cb7: Refresh published package metadata: expanded npm `keywords` and enriched READMEs (concrete attack example, compatibility matrix for Express/Fastify 4.x + 5.x, ESM/TypeScript usage, table of contents). No API changes.
- Updated dependencies [fa12cb7]
- Updated dependencies [67a11a1]
  - @exortek/nosql-sanitize-core@3.0.1
