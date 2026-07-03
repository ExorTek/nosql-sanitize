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
- **Prototype Pollution Protection**: Blocks `__proto__`, `constructor`, and `prototype` keys by default.
- **Configurable Depth Limiting**: Control what happens to values beyond `maxDepth` — preserve, remove, or throw.
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
{ "username": "admin", "password": { "$ne": "" } }
```

Without sanitization, this query might return the first user in the database (usually the admin) because `password` is "not equal to empty string". `nosql-sanitize` transforms this into:

```json
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

> **Express 5 Support**: `req.query` is read-only in Express 5. This library automatically detects non-writable properties and uses `Object.defineProperty` to safely override them — no extra configuration needed.

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

| Option               | Type                     | Default                     | Description                                                                            |
|:---------------------|:-------------------------|:----------------------------|:---------------------------------------------------------------------------------------|
| `replaceWith`        | `string`                 | `''`                        | String to replace matched patterns (like `$`) with.                                    |
| `removeMatches`      | `boolean`                | `false`                     | If `true`, removes the entire key-value pair if a match is found.                      |
| `sanitizeObjects`    | `string[]`               | `['body', 'query']`         | Fields on the request object to sanitize.                                              |
| `contentTypes`       | `string[]` \| `null`     | `['application/json', ...]` | Only sanitize `body` for these content types. `null` = all.                            |
| `skipRoutes`         | `(string` \| `RegExp)[]` | `[]`                        | Routes to ignore during auto-sanitization.                                             |
| `recursive`          | `boolean`                | `true`                      | Whether to recursively sanitize nested objects/arrays.                                 |
| `maxDepth`           | `number` \| `null`       | `null`                      | Maximum recursion depth. `0` = top-level strings only. `null` = unlimited.             |
| `maxDepthBehavior`   | `string`                 | `'preserve'`                | Action when `maxDepth` exceeded: `'preserve'`, `'remove'` (recommended), or `'throw'`. |
| `preserveEmails`     | `boolean`                | `true`                      | Preserve email-looking values without sanitizing.                                      |
| `allowPrototypeKeys` | `boolean`                | `false`                     | Allow `__proto__` / `constructor` / `prototype` keys.                                  |
| `allowedKeys`        | `string[]`               | `[]`                        | List of keys to allow without sanitization (e.g., `['$set']`).                         |
| `deniedKeys`         | `string[]`               | `[]`                        | List of keys to completely remove from the input.                                      |
| `onSanitize`         | `function`               | `null`                      | Comprehensive audit callback. See [onSanitize Events](#onsanitize-events).             |
| `debug.enabled`      | `boolean`                | `false`                     | Enable detailed logging for debugging.                                                 |

### onSanitize Events

The `onSanitize` callback fires for value changes, key renames, array string changes, and removals. Each event includes:

```js
app.use(mongoSanitize({
  onSanitize: (event) => {
    console.log(event);
  }
}));
```

**Event shape:**

| Field            | Description                                                                                                                   |
|:-----------------|:------------------------------------------------------------------------------------------------------------------------------|
| `type`           | `'value'`, `'key'`, `'both'`, or `'removed'`                                                                                  |
| `reason`         | Only for `'removed'`: `'deniedKey'`, `'notAllowed'`, `'prototypePollution'`, `'removeMatches'`, `'removeEmpty'`, `'maxDepth'` |
| `key`            | Original key (e.g., `'$gt'`)                                                                                                  |
| `sanitizedKey`   | Key after sanitization (e.g., `'gt'`)                                                                                         |
| `path`           | Full dotted path (e.g., `'body.user.$gt'`)                                                                                    |
| `originalValue`  | Value before sanitization                                                                                                     |
| `sanitizedValue` | Value after sanitization                                                                                                      |

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

#### Depth Limiting
```js
app.use(mongoSanitize({
  maxDepth: 3,
  maxDepthBehavior: 'remove',
}));
```

## 🔒 Security

### Prototype Pollution Protection

By default, `__proto__`, `constructor`, and `prototype` keys are stripped from all objects. This prevents attacks like:

```json
{ "__proto__": { "isAdmin": true } }
```

Smuggled variants (e.g., `"__pro to__"` after control character stripping) are also caught. To opt out (only if you fully trust the input):

```js
app.use(mongoSanitize({ allowPrototypeKeys: true }));
```

### Express 5 Compatibility

Express 5 defines `req.query` as a non-writable getter. This library detects non-writable properties and uses `Object.defineProperty` to safely assign sanitized values — no workarounds or extra configuration required.

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
