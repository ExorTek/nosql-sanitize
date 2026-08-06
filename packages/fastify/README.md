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

> Registered as a proper [`fastify-plugin`](https://github.com/fastify/fastify-plugin), so the `preHandler` hook applies across your whole instance (it is not encapsulated to a single scope by accident).

## ✅ Compatibility

| Runtime      | Supported                | Notes                                                   |
| ------------ | ------------------------ | ------------------------------------------------------- |
| **Fastify**  | `4.x` and `5.x`          | Both majors covered by the integration test suite.      |
| **Node.js**  | `>= 18`                  | Uses only stable core APIs.                              |
| **Modules**  | CommonJS + ESM           | `require()` and `import` both work.                     |
| **Types**    | Bundled `.d.ts`          | Includes `FastifyRequest.sanitize` augmentation.        |

## ⚙️ Options

```js
fastify.register(mongoSanitize, {
  replaceWith: '',           // Replace matched chars with this string
  removeMatches: false,      // Remove entire key-value pair if pattern matches
  sanitizeObjects: ['body', 'params', 'query'],  // Fields to sanitize
  contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
  mode: 'auto',             // 'auto' | 'manual'
  skipRoutes: [],            // Routes to skip (string or RegExp)
  recursive: true,           // Sanitize nested objects
  maxDepth: null,            // Max recursion depth (0 = top-level only, null = unlimited)
  maxDepthBehavior: 'preserve', // 'preserve' (default) | 'remove' (recommended) | 'throw'
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

### Content-Type Guard

By default only `application/json` and `application/x-www-form-urlencoded` bodies are sanitized, so binary uploads and multipart forms are never corrupted. `request.query` is always sanitized regardless of content type.

```js
fastify.register(mongoSanitize, { contentTypes: ['application/json', 'application/graphql'] });
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
- **Configurable depth limiting**: set `maxDepthBehavior: 'remove'` for fail-closed security on deeply nested payloads (recommended in production).
- **Email preservation**: email-looking values are passed through untouched by default, so `@` is not mangled.
- **Fastify null-proto query support**: Fastify parses query strings into null-prototype objects; the sanitizer handles them just like plain objects.

> Reporting a vulnerability? See the repository [security policy](../../SECURITY.md).

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
