# @exortek/fastify-mongo-sanitize

<p align="center">
  <img src="https://img.shields.io/npm/v/@exortek/fastify-mongo-sanitize?style=flat-square&color=000000&logo=npm" alt="npm version">
  <img src="https://img.shields.io/npm/dm/@exortek/fastify-mongo-sanitize?style=flat-square&color=000000" alt="npm downloads">
  <img src="https://img.shields.io/badge/fastify-4.x%20%7C%205.x-000000?style=flat-square&logo=fastify&logoColor=white" alt="fastify 4 and 5">
  <img src="https://img.shields.io/badge/types-included-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="typescript types included">
  <img src="https://img.shields.io/node/v/@exortek/fastify-mongo-sanitize?style=flat-square&color=5FA04E&logo=node.js&logoColor=white" alt="node version">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license">
</p>

Fastify plugin for **NoSQL injection prevention**. It recursively sanitizes request `body`, `params`, and `query` to strip the MongoDB operator characters (`$`, control bytes) attackers use to bypass your query logic — with zero configuration, on both Fastify 4 and Fastify 5.

## Contents

- [The attack it stops](#-the-attack-it-stops)
- [Installation](#-installation)
- [Quick start](#-quick-start)
- [Compatibility](#-compatibility)
- [Options](#️-options)
- [Features](#-features)
  - [Per-route options](#per-route-options)
  - [Sanitizing before schema validation](#sanitizing-before-schema-validation)
  - [Logging through `request.log`](#logging-through-requestlog)
  - [Manual mode](#manual-mode)
  - [Content-Type guard](#content-type-guard)
  - [TypeScript support](#typescript-support)
- [Security defaults](#-security-defaults)
- [License](#-license)

## 🎯 The attack it stops

MongoDB treats a JSON object as a query operator. A login handler that trusts `request.body` directly is exploitable:

```jsonc
// Attacker sends this instead of a password:
{ "username": "admin", "password": { "$ne": "" } }
// → db.users.findOne({ username: "admin", password: { $ne: "" } })
// "password is not equal to empty string" matches the admin row — logged in with no password.
```

With the plugin registered, the operator key is neutralised before your handler ever sees it:

```jsonc
// request.body after sanitization:
{ "username": "admin", "password": { "ne": "" } }
// → no $ operator, the query can never match by accident.
```

## 📦 Installation

```bash
npm install @exortek/fastify-mongo-sanitize
# yarn add @exortek/fastify-mongo-sanitize
# pnpm add @exortek/fastify-mongo-sanitize
```

## ⚡ Quick Start

```js
const fastify = require('fastify')();
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(mongoSanitize);

fastify.post('/login', async (request) => {
  // request.body / request.query / request.params are already sanitized
  return request.body;
});
```

ESM / TypeScript:

```ts
import Fastify from 'fastify';
import mongoSanitize from '@exortek/fastify-mongo-sanitize';

const app = Fastify();
app.register(mongoSanitize);
```

> Registered as a proper [`fastify-plugin`](https://github.com/fastify/fastify-plugin), so the `preValidation` hook applies across your whole instance (it is not encapsulated to a single scope by accident).

## ✅ Compatibility

| Runtime      | Supported                | Notes                                                   |
| ------------ | ------------------------ | ------------------------------------------------------- |
| **Fastify**  | `4.x` and `5.x`          | Both majors covered by the integration test suite.      |
| **Node.js**  | `>= 20`                  | Uses only stable core APIs.                              |
| **Modules**  | CommonJS + ESM           | `require()` and `import` both work.                     |
| **Types**    | Bundled `.d.ts`          | Includes `FastifyRequest.sanitize` augmentation.        |

## ⚙️ Options

```js
fastify.register(mongoSanitize, {
  replaceWith: '',           // Replace matched chars with this string
  removeMatches: false,      // Remove entire key-value pair if pattern matches
  sanitizeObjects: ['body', 'params', 'query'],  // Fields to sanitize
  contentTypes: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
  mode: 'auto',             // 'auto' | 'manual'
  hook: 'preValidation',     // 'preValidation' (schema sees sanitized data) | 'preHandler'
  onInjection: 'sanitize',   // 'sanitize' | 'reject' (400) | 'report' (dry run, needs onSanitize)
  skipRoutes: [],            // Routes to skip (string or RegExp)
  recursive: true,           // Sanitize nested objects
  maxDepth: 32,              // Max recursion depth (0 = top-level only, null = no limit, hard ceiling 256)
  maxDepthBehavior: 'remove', // 'remove' (fail-closed) | 'throw' | 'preserve' (passes raw data through)
  dotKeys: 'replace',        // Keys with '.': 'replace' (with replaceWith) | 'remove' | 'allow'
  preserveEmails: true,      // Preserve email-looking values (also bypasses custom patterns)
  allowPrototypeKeys: false, // Block __proto__/constructor/prototype keys
  onSanitize: (event) => {
    // event: { type, reason?, key, sanitizedKey, path, originalValue, sanitizedValue }
    fastify.log.warn(`Sanitized at ${event.path}: ${event.type}`);
  }
});
```

> For the full list of options (string/array post-processing, allowed/denied keys, custom patterns, debug logging), see the [Core README](../core/README.md#configuration-options).

## 🛠 Features

### Per-route options

In auto mode, a route can opt out or use its own options through `config.mongoSanitize`:

```js
// No sanitization on this route
fastify.post('/raw-webhook', { config: { mongoSanitize: false } }, handler);

// Merged over the plugin options for this route only
fastify.patch('/admin/users/:id', {
  config: { mongoSanitize: { allowedOperators: ['$set'] } },
}, handler);
```

Route options are resolved once per route. An invalid route config fails at startup (`fastify.ready()` rejects), not on a request. `skipRoutes` still matches the request URL as before.

### Sanitizing before schema validation

By default the plugin runs in `preValidation`, before Fastify validates the request against your JSON schema, so the schema validates the sanitized data. With `hook: 'preHandler'` (the v3 default), sanitization runs after validation and the schema sees the raw input:

```js
fastify.register(mongoSanitize, { hook: 'preHandler' });
```

### Logging through `request.log`

Debug output goes through each request's `request.log` by default (`debug.logger: 'request'`), so it lands in your Fastify logger with the request id. Messages outside a request (plugin startup) go to `fastify.log`. This also applies to a route's `config.mongoSanitize` and to manual mode. If the Fastify logger is disabled (no `logger` option), output falls back to `console.log`.

```js
fastify.register(mongoSanitize, {
  debug: { enabled: true, level: 'debug' },
});
```

`debug.level` filters first, then Fastify's logger level applies. Pass another logger object (e.g. a pino instance) as `debug.logger`, or `null` for plain `console.log` output.

### Manual Mode

For fine-grained control over when sanitization runs:

```js
fastify.register(mongoSanitize, { mode: 'manual' });

fastify.post('/sensitive', async (request) => {
  request.sanitize();                // trigger sanitization
  request.sanitize({ maxDepth: 2 }); // ...optionally with per-call overrides
  return request.body;
});
```

> Per-call options are resolved once per object and cached. Define them once (e.g. `const strict = { maxDepth: 2 }`) instead of inline, so the cache is hit, and don't mutate an object after passing it in.

### Content-Type Guard

By default `application/json`, `application/x-www-form-urlencoded` and `multipart/form-data` bodies are sanitized, and `+json` types (e.g. `application/vnd.api+json`) count as JSON. `request.query` is always sanitized regardless of content type.

With `@fastify/multipart` and `attachFieldsToBody: true`, each field object has a `fields` property that points back at the body. The sanitizer cuts that circular reference (reported via `onSanitize` with reason `'circular'`) and sanitizes `value`, `fieldname` and the key. File parts keep their `toBuffer()` / `file` stream. To bypass that handling, use `attachFieldsToBody: 'keyValues'`, which gives you flat values.

> Other body types pass through **unsanitized**. Add every body type you parse to `contentTypes`.

```js
fastify.register(mongoSanitize, { contentTypes: ['application/json', 'application/graphql'] }); // replaces the default list
fastify.register(mongoSanitize, { contentTypes: null }); // sanitize every content type (use with care)
```

### TypeScript Support

Full TypeScript support ships in the box, including a `FastifyRequest.sanitize` augmentation for manual mode:

```ts
import Fastify from 'fastify';
import mongoSanitize from '@exortek/fastify-mongo-sanitize';

const app = Fastify();
app.register(mongoSanitize, { mode: 'manual' });

app.post('/test', async (request) => {
  request.sanitize?.();
  return request.body;
});
```

## 🔒 Security Defaults

- **Prototype pollution protection**: `__proto__`, `constructor`, `prototype` keys are stripped by default — including smuggled variants that only collapse to a dangerous key *after* sanitization.
- **Fail-closed depth limiting**: values nested deeper than `maxDepth` (32) are dropped by default (`maxDepthBehavior: 'remove'`).
- **Dotted keys neutralized**: keys like `profile.isAdmin` become `profileisAdmin` by default (`dotKeys: 'replace'`).
- **Email preservation**: email-looking values are passed through untouched by default, so `@` is not mangled.
- **Fastify null-proto query support**: Fastify parses query strings into null-prototype objects; the sanitizer handles them just like plain objects.

> Reporting a vulnerability? See the repository [security policy](../../SECURITY.md).

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
