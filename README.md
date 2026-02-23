# nosql-sanitize

A high-performance monorepo for NoSQL injection prevention. Protects Express and Fastify applications from MongoDB operator injection attacks by sanitizing request data.

## Packages

| Package | Description | Version |
|---------|-------------|---------|
| [`@exortek/nosql-sanitize-core`](./packages/core) | Core sanitization engine | ![npm](https://img.shields.io/npm/v/@exortek/nosql-sanitize-core) |
| [`@exortek/express-mongo-sanitize`](./packages/express) | Express middleware | ![npm](https://img.shields.io/npm/v/@exortek/express-mongo-sanitize) |
| [`@exortek/fastify-mongo-sanitize`](./packages/fastify) | Fastify plugin | ![npm](https://img.shields.io/npm/v/@exortek/fastify-mongo-sanitize) |

## Why?

MongoDB operators like `$gt`, `$ne`, `$where` can be injected through user input:

```json
// Malicious login attempt
{ "username": "admin", "password": { "$ne": "" } }
```

This middleware removes `$` and control characters from request data before it reaches your database layer.

## Quick Start

**Express:**
```bash
npm install @exortek/express-mongo-sanitize
```
```js
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize());
```

**Fastify:**
```bash
npm install @exortek/fastify-mongo-sanitize
```
```js
const fastify = require('fastify')();
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(mongoSanitize);
```

## Architecture

```
packages/
├── core/       → Shared sanitization engine (patterns, validators, sanitizers)
├── express/    → Express middleware adapter (~60 lines)
└── fastify/    → Fastify plugin adapter (~50 lines)
```

The core package contains all sanitization logic. Express and Fastify packages are thin wrappers that adapt the core to each framework's middleware/plugin system. Bug fixes and features apply to both frameworks automatically.

## Development

```bash
git clone https://github.com/ExorTek/nosql-sanitize.git
cd nosql-sanitize
yarn install
yarn test          # Run all tests (147 tests)
yarn test:core     # Core unit tests only
yarn test:express  # Express integration tests (v4 + v5)
yarn test:fastify  # Fastify integration tests (v4 + v5)
```

## Compatibility

| Framework | Supported Versions |
|-----------|-------------------|
| Express   | 4.x, 5.x         |
| Fastify   | 4.x, 5.x         |
| Node.js   | ≥ 18.0.0         |

## License

[MIT](./LICENSE) — ExorTek
