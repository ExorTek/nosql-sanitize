# Migrating to v4

v4 changes defaults, not APIs: every option from v3 still exists. The new defaults are fail-closed, so most apps only
need to check that their payloads still come through as expected. Each section below shows how to get the v3 behavior
back if you need it.

All three packages move to 4.0.0 together: `@exortek/nosql-sanitize-core`, `@exortek/express-mongo-sanitize` and
`@exortek/fastify-mongo-sanitize`.

## Summary

| Change                                                         | v3                                   | v4                  | Keep the v3 behavior           |
|----------------------------------------------------------------|--------------------------------------|---------------------|--------------------------------|
| [Node.js](#nodejs-20)                                          | `>= 18`                              | `>= 20`             | —                              |
| [`maxDepth`](#depth-limit)                                     | `null`                               | `32`                | `maxDepth: null`               |
| [`maxDepthBehavior`](#depth-limit)                             | `'preserve'`                         | `'remove'`          | `maxDepthBehavior: 'preserve'` |
| [`dotKeys`](#dotted-keys)                                      | `'allow'`                            | `'replace'`         | `dotKeys: 'allow'`             |
| [`deniedKeys` vs `preserveEmails`](#denied-keys)               | email values kept                    | always removed      | —                              |
| [`removeEmpty: true`](#removeempty-and-filternull)             | drops falsy (`0`, `false` too)       | same as `'empty'`   | `removeEmpty: 'falsy'`         |
| [`arrayOptions.filterNull: true`](#removeempty-and-filternull) | drops falsy (`0`, `''`, `false` too) | same as `'nullish'` | `filterNull: 'falsy'`          |
| [Fastify `hook`](#fastify-hook)                                | `'preHandler'`                       | `'preValidation'`   | `hook: 'preHandler'`           |
| [Fastify `debug.logger`](#fastify-logging)                     | `console.log`                        | `request.log`       | `debug: { logger: null }`      |

## Node.js 20

All packages now declare `"engines": { "node": ">=20.0.0" }`. Node 18 reached end of life in April 2025.

## Depth limit

v3 recursed without a limit (up to an internal 256-level ceiling) and, when you did set `maxDepth`, passed over-depth
values through **unsanitized** by default. v4 defaults to `maxDepth: 32` with `maxDepthBehavior: 'remove'`: anything
nested deeper than 32 levels is dropped, and reported through `onSanitize` with reason `'maxDepth'`.

Real request bodies rarely go past a handful of levels, so this mostly affects attack payloads. If you do accept deeper
documents, raise the limit rather than turning it off:

```js
app.use(mongoSanitize({ maxDepth: 64 }));
```

If you had set `maxDepth` yourself and relied on over-depth data passing through raw, set `maxDepthBehavior: 'preserve'`
explicitly. This is fail-open; prefer `'remove'` or `'throw'`.

## Dotted keys

Keys containing `.` are now renamed: each `.` is replaced with `replaceWith` (`''` by default), so
`{ "profile.isAdmin": true }` becomes `{ "profileisAdmin": true }`. MongoDB treats such keys as nested paths in update
operators like `$set`, which is how they are abused.

Things to check:

- **Keys that legitimately contain dots**, such as maps keyed by email address or domain (`{ "ada@example.com": … }`
  becomes `{ "ada@examplecom": … }`). Values are not affected; only keys are.
- **`onInjection: 'reject'`** now rejects requests with dotted keys, and `hasInjection()` returns `true` for them.
- Use `dotKeys: 'remove'` to drop such pairs instead, or `dotKeys: 'allow'` for the v3 behavior (per route in Fastify
  via `config.mongoSanitize`).

## Denied keys

In v3, `preserveEmails: true` (the default) kept a key listed in `deniedKeys` when its value looked like an email. Denied
keys are now always removed:

```js
// v3: { email: 'ada@example.com' } passed through
// v4: {}
app.use(mongoSanitize({ deniedKeys: ['email'] }));
```

`preserveEmails` still exempts email-looking **values** from sanitization; it just no longer overrides `deniedKeys`. If
you depended on the old behavior, remove the key from `deniedKeys`.

## `removeEmpty` and `filterNull`

`true` now selects the safe mode that keeps `0` and `false`:

| Option                    | `true` in v3                                    | `true` in v4                                  |
|---------------------------|-------------------------------------------------|-----------------------------------------------|
| `removeEmpty`             | `''`, `null`, `undefined`, `0`, `false` removed | `''`, `null`, `undefined`, `{}`, `[]` removed |
| `arrayOptions.filterNull` | `null`, `undefined`, `0`, `''`, `false` removed | `null`, `undefined` removed                   |

Note that `removeEmpty: true` now also removes empty objects and arrays, which v3 kept. Use `'falsy'` for the v3 behavior
of either option. The explicit modes (`'falsy'`, `'empty'`, `'nullish'`) behave exactly as in 3.1.

`resolveOptions()` returns the resolved mode, so `resolveOptions({ removeEmpty: true }).removeEmpty` is `'empty'`.

## Fastify hook

The plugin now sanitizes in `preValidation` instead of `preHandler`, so your JSON schemas validate the sanitized data.
A body like `{ "name": "$abc" }` against `pattern: '^[a-z]+$'` used to fail validation (400) and now passes as
`{ "name": "abc" }`. This also means `preValidation` hooks you registered **before** the plugin see raw data, and
those registered after it see sanitized data.

To keep the v3 order:

```js
fastify.register(mongoSanitize, { hook: 'preHandler' });
```

## Fastify logging

With `debug.enabled`, the Fastify plugin now logs through `request.log` (and `fastify.log` outside a request) instead of
`console.log`. Lines are structured (`{ module: 'nosql-sanitize', context, data }`) and carry the request id. Your Fastify
logger's level applies on top of `debug.level`, so set it low enough (e.g. `logger: { level: 'debug' }`) to see debug
messages.

For the v3 console output:

```js
fastify.register(mongoSanitize, { debug: { enabled: true, logger: null } });
```

Express is unchanged: it writes to `console.log` unless you pass `debug.logger`.
