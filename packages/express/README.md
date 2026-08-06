# @exortek/express-mongo-sanitize

<p align="center">
  <img src="https://img.shields.io/npm/v/@exortek/express-mongo-sanitize?style=flat-square&color=339933&logo=npm" alt="npm version">
  <img src="https://img.shields.io/npm/dm/@exortek/express-mongo-sanitize?style=flat-square&color=339933" alt="npm downloads">
  <img src="https://img.shields.io/badge/express-4.x%20%7C%205.x-000000?style=flat-square&logo=express&logoColor=white" alt="express 4 and 5">
  <img src="https://img.shields.io/badge/types-included-3178c6?style=flat-square&logo=typescript&logoColor=white" alt="typescript types included">
  <img src="https://img.shields.io/node/v/@exortek/express-mongo-sanitize?style=flat-square&color=5FA04E&logo=node.js&logoColor=white" alt="node version">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license">
</p>

Express middleware for **NoSQL injection prevention**. It recursively sanitizes request `body`, `query`, and `params` to strip the MongoDB operator characters (`$`, control bytes) attackers use to bypass your query logic — with zero configuration, on both Express 4 and Express 5.

## Contents

- [The attack it stops](#-the-attack-it-stops)
- [Installation](#-installation)
- [Quick start](#-quick-start)
- [Compatibility](#-compatibility)
- [Options](#️-options)
- [Features](#-features)
  - [Route parameter sanitization](#route-parameter-sanitization)
  - [Manual mode](#manual-mode)
  - [Content-Type guard](#content-type-guard)
- [Security defaults](#-security-defaults)
- [License](#-license)

## 🎯 The attack it stops

MongoDB treats a JSON object as a query operator. A login handler that trusts `req.body` directly is exploitable:

```jsonc
// Attacker sends this instead of a password:
{ "username": "admin", "password": { "$ne": "" } }
// → db.users.findOne({ username: "admin", password: { $ne: "" } })
// "password is not equal to empty string" matches the admin row — logged in with no password.
```

With the middleware mounted, the operator key is neutralised before your handler ever sees it:

```jsonc
// req.body after sanitization:
{ "username": "admin", "password": { "ne": "" } }
// → no $ operator, the query can never match by accident.
```

## 📦 Installation

```bash
npm install @exortek/express-mongo-sanitize
# yarn add @exortek/express-mongo-sanitize
# pnpm add @exortek/express-mongo-sanitize
```

## ⚡ Quick Start

```js
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize()); // mount once, before your routes

app.post('/login', (req, res) => {
  // req.body / req.query are already sanitized — { "$ne": "" } is now { "ne": "" }
  res.json(req.body);
});
```

ESM / TypeScript:

```ts
import express from 'express';
import mongoSanitize from '@exortek/express-mongo-sanitize';

const app = express();
app.use(express.json());
app.use(mongoSanitize());
```

> **Express 5 support:** `req.query` is a read-only getter in Express 5, so a plain `req.query = sanitized` throws. This library detects the non-writable property and falls back to `Object.defineProperty` — no extra configuration needed on either major.

## ✅ Compatibility

| Runtime      | Supported                | Notes                                                   |
| ------------ | ------------------------ | ------------------------------------------------------- |
| **Express**  | `4.x` and `5.x`          | Both majors covered by the integration test suite.      |
| **Node.js**  | `>= 18`                  | Uses only stable core APIs.                              |
| **Modules**  | CommonJS + ESM           | `require()` and `import` both work.                     |
| **Types**    | Bundled `.d.ts`          | No `@types/*` package needed.                            |

## ⚙️ Options

```js
app.use(mongoSanitize({
  replaceWith: '',           // Replace matched chars with this string
  removeMatches: false,      // Remove entire key-value pair if pattern matches
  sanitizeObjects: ['body', 'query'],  // Request fields to sanitize
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
    console.log(`Sanitized at ${event.path}: ${event.type}`);
  }
}));
```

> For the full list of options (string/array post-processing, allowed/denied keys, custom patterns, debug logging), see the [Core README](../core/README.md#configuration-options).

## 🛠 Features

### Route Parameter Sanitization

While `body` and `query` are sanitized automatically, route parameters are sanitized on demand with `paramSanitizeHandler`:

```js
const { paramSanitizeHandler } = require('@exortek/express-mongo-sanitize');

app.param('username', paramSanitizeHandler());

app.get('/user/:username', (req, res) => {
  // GET /user/$admin → req.params.username is "admin"
  res.json({ username: req.params.username });
});
```

### Manual Mode

For fine-grained control over when sanitization runs:

```js
app.use(mongoSanitize({ mode: 'manual' }));

app.post('/sensitive', (req, res) => {
  req.sanitize();                // trigger sanitization
  req.sanitize({ maxDepth: 2 }); // ...optionally with per-call overrides
  res.json(req.body);
});
```

### Content-Type Guard

By default only `application/json` and `application/x-www-form-urlencoded` bodies are sanitized, so binary uploads and multipart forms are never corrupted. `req.query` is always sanitized regardless of content type.

```js
app.use(mongoSanitize({ contentTypes: ['application/json', 'application/graphql'] }));
app.use(mongoSanitize({ contentTypes: null })); // sanitize every content type (use with care)
```

## 🔒 Security Defaults

- **Prototype pollution protection**: `__proto__`, `constructor`, `prototype` keys are stripped by default — including smuggled variants that only collapse to a dangerous key *after* sanitization.
- **Configurable depth limiting**: set `maxDepthBehavior: 'remove'` for fail-closed security on deeply nested payloads (recommended in production).
- **Email preservation**: email-looking values are passed through untouched by default, so `@` is not mangled.

> Reporting a vulnerability? See the repository [security policy](../../SECURITY.md).

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
