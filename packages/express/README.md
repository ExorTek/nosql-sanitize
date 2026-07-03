# @exortek/express-mongo-sanitize

<p align="center">
  <img src="https://img.shields.io/npm/v/@exortek/express-mongo-sanitize?style=flat-square&color=339933" alt="npm version">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license">
</p>

Express middleware for NoSQL injection prevention. Sanitizes request `body`, `query`, and `params` to protect MongoDB queries from operator injection attacks.

## 📦 Installation

```bash
npm install @exortek/express-mongo-sanitize
```
```bash
yarn install @exortek/express-mongo-sanitize
```
```bash
pnpm install @exortek/express-mongo-sanitize
```

## ⚡ Quick Start

```js
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize());

app.post('/login', (req, res) => {
  // req.body is sanitized — { "$ne": "" } becomes { "ne": "" }
  res.json(req.body);
});
```

> **Express 5 Support**: `req.query` is read-only in Express 5. This library detects non-writable properties and uses `Object.defineProperty` to safely assign sanitized values — no extra configuration needed.

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

> For the full list of options, see the [Core README](../core/README.md#configuration-options).

## 🛠 Features

### Route Parameter Sanitization

While `body` and `query` are sanitized automatically, route parameters can be sanitized using the `paramSanitizeHandler`:

```js
const { paramSanitizeHandler } = require('@exortek/express-mongo-sanitize');

app.param('username', paramSanitizeHandler());

app.get('/user/:username', (req, res) => {
  // GET /user/$admin → req.params.username is "admin"
  res.json({ username: req.params.username });
});
```

### Manual Mode

If you need fine-grained control over when sanitization occurs:

```js
app.use(mongoSanitize({ mode: 'manual' }));

app.post('/sensitive', (req, res) => {
  req.sanitize(); // Manually trigger sanitization
  res.json(req.body);
});
```

### Content-Type Guard

By default, only `application/json` and `application/x-www-form-urlencoded` bodies are sanitized to avoid corrupting binary data or file uploads. You can customize this:

```js
app.use(mongoSanitize({ contentTypes: ['application/json', 'application/graphql'] }));
```

## 🔒 Security Defaults

- **Prototype pollution protection**: `__proto__`, `constructor`, `prototype` keys are stripped by default.
- **Configurable depth limiting**: Set `maxDepthBehavior: 'remove'` for fail-closed security (recommended).
- **Email preservation**: Email-looking values are preserved without sanitization by default.

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
