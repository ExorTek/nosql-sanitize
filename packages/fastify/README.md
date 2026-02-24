# @exortek/fastify-mongo-sanitize

<p align="center">
  <img src="https://img.shields.io/npm/v/@exortek/fastify-mongo-sanitize?style=flat-square&color=000000" alt="npm version">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square" alt="license">
</p>

Fastify plugin for NoSQL injection prevention. Sanitizes request `body`, `params`, and `query` to protect MongoDB queries from operator injection attacks.

## 📦 Installation

```bash
npm install @exortek/fastify-mongo-sanitize
```
```bash
yarn install @exortek/fastify-mongo-sanitize
```
```bash
pnpm install @exortek/fastify-mongo-sanitize
```

## ⚡ Quick Start

```js
const fastify = require('fastify')();
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(mongoSanitize);

fastify.post('/login', async (request) => {
  // request.body is sanitized — { "$ne": "" } becomes { "ne": "" }
  return request.body;
});
```

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
  maxDepth: null,            // Max recursion depth (null = unlimited)
  onSanitize: ({ key, originalValue, sanitizedValue }) => {
    fastify.log.warn(`Sanitized ${key}`);
  }
});
```

> For the full list of options, see the [Core README](../core/README.md#configuration-options).

## 🛠 Features

### Manual Mode

If you need fine-grained control over when sanitization occurs:

```js
fastify.register(mongoSanitize, { mode: 'manual' });

fastify.post('/sensitive', async (request) => {
  request.sanitize(); // Manually trigger sanitization
  return request.body;
});
```

### Content-Type Guard

By default, only `application/json` and `application/x-www-form-urlencoded` bodies are sanitized. You can customize this:

```js
fastify.register(mongoSanitize, { contentTypes: ['application/json', 'application/graphql'] });
```

### TypeScript Support

Full TypeScript support is included out of the box, with request augmentation for the `sanitize` method:

```typescript
import fastify from 'fastify';
import mongoSanitize from '@exortek/fastify-mongo-sanitize';

const app = fastify();
app.register(mongoSanitize);

app.post('/test', async (request) => {
  request.sanitize?.();
  return request.body;
});
```

## 📜 License

[MIT](../../LICENSE) — Created by **ExorTek**
