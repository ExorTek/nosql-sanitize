---
"@exortek/fastify-mongo-sanitize": minor
---

- Route-level `config.mongoSanitize`: `false` turns sanitization off for a route, and an options object is merged over the plugin options for that route. Route options are resolved once per route, and an invalid route config fails at startup.
- New `hook: 'preHandler' | 'preValidation'` option (default `'preHandler'`). With `'preValidation'`, the schema validates the sanitized data instead of the raw input.
- Invalid plugin options now reject `fastify.ready()`. Before, they crashed the process with an uncaught exception.
