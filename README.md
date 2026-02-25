<p align="center">
  <img src="./assets/logo.png" width="320" alt="nosql-sanitize logo">
</p>

<p align="center">
  <img src="https://img.shields.io/npm/v/@exortek/express-mongo-sanitize?label=express&style=flat-square&logo=express&logoColor=white" alt="express version">
  <img src="https://img.shields.io/npm/v/@exortek/fastify-mongo-sanitize?label=fastify&style=flat-square&logo=fastify&logoColor=white" alt="fastify version">
</p>

`nosql-sanitize` is a lightweight and blazing-fast suite of tools designed to prevent **NoSQL Injection** attacks in Node.js applications. It recursively sanitizes user-supplied data to remove characters and patterns (like `$` and control characters) used in malicious MongoDB queries.

### Key Features

- **Blazing Fast**: Optimized core engine with pre-compiled regex and minimal overhead.
- **Recursive Sanitization**: Automatically cleans nested objects and arrays.
- **Framework Support**: First-class support for **Express** (4.x/5.x) and **Fastify** (4.x/5.x).
- **Highly Configurable**: Control depth, allowed/denied keys, content-types, and more.
- **TypeScript Ready**: Built-in, high-quality type definitions.
- **Security First**: Preserves sensitive data like email addresses while stripping injection vectors.

## 📦 Packages

| Package | Purpose | Installation |
|---------|---------|--------------|
| [`@exortek/express-mongo-sanitize`](./packages/express) | Express Middleware | `npm i @exortek/express-mongo-sanitize` |
| [`@exortek/fastify-mongo-sanitize`](./packages/fastify) | Fastify Plugin | `npm i @exortek/fastify-mongo-sanitize` |
| [`@exortek/nosql-sanitize-core`](./packages/core) | Core Engine | `npm i @exortek/nosql-sanitize-core` |

## 🤔 Why?

In MongoDB, operators like `$gt`, `$ne`, and `$where` can be injected via JSON input to bypass logic or extract data:

```json
// ❌ Malicious login attempt
{ "username": "admin", "password": { "$ne": "" } }
```

Without sanitization, this query might return the first user in the database (usually the admin) because `password` is "not equal to empty string". `nosql-sanitize` transforms this into:

```json
// ✅ Sanitized input
{ "username": "admin", "password": { "ne": "" } }
```

## ⚡ Quick Start

### Express

```js
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize());

app.post('/login', (req, res) => {
  // req.body is already sanitized
  res.send('Safe!');
});
```

### Fastify

```js
const fastify = require('fastify')();
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(mongoSanitize);

fastify.post('/login', async (request) => {
  // request.body is already sanitized
  return { status: 'Safe!' };
});
```

## ⚙️ Configuration Options

All packages (`express`, `fastify`) accept the same configuration options, which are passed to the core engine.

| Option | Type | Default | Description |
|:-------|:-----|:--------|:------------|
| `replaceWith` | `string` | `''` | String to replace matched patterns (like `$`) with. |
| `removeMatches` | `boolean` | `false` | If `true`, removes the entire key-value pair if a match is found. |
| `sanitizeObjects` | `string[]` | `['body', 'query']` | Fields on the request object to sanitize. |
| `contentTypes` | `string[] \| null` | `['application/json', ...]` | Only sanitize `body` for these content types. `null` = all. |
| `skipRoutes` | `(string \| RegExp)[]` | `[]` | Routes to ignore during auto-sanitization. |
| `recursive` | `boolean` | `true` | Whether to recursively sanitize nested objects/arrays. |
| `maxDepth` | `number \| null` | `null` | Maximum recursion depth for nested structures. |
| `allowedKeys` | `string[]` | `[]` | List of keys to allow without sanitization (e.g., `['$set']`). |
| `deniedKeys` | `string[]` | `[]` | List of keys to completely remove from the input. |
| `onSanitize` | `function` | `null` | Hook called when a value is sanitized: `(key, value) => { ... }`. |
| `debug.enabled` | `boolean` | `false` | Enable detailed logging for debugging. |

### Advanced Usage Examples

#### Skipping Specific Routes
```js
app.use(mongoSanitize({
  skipRoutes: ['/api/v1/webhook', /^\/public\/.*/]
}));
```

#### Allowing Specific Keys
Useful if you trust certain operators in specific contexts:
```js
app.use(mongoSanitize({
  allowedKeys: ['$set', '$push']
}));
```

#### Custom Replacement
Instead of removing `$`, replace it with an underscore:
```js
app.use(mongoSanitize({
  replaceWith: '_'
}));
// { "$gt": 5 } -> { "_gt": 5 }
```

## 🛠 Architecture

The project is structured as a monorepo for maximum consistency:

- **`core/`**: The brain. Contains the logic, default patterns, and options resolver.
- **`express/` & `fastify/`**: Thin, framework-specific wrappers that adapt the core to each ecosystem.

## 🧪 Development & Testing

```bash
# Clone and install
git clone https://github.com/ExorTek/nosql-sanitize.git
cd nosql-sanitize
yarn install

# Run tests
yarn test          # All suites
yarn test:core     # Core only
yarn test:express  # Express integration
yarn test:fastify  # Fastify integration

# Benchmark
yarn benchmark     # Performance testing
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📜 License

[MIT](./LICENSE) — Created by **ExorTek**
