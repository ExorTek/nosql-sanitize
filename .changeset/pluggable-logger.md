---
"@exortek/nosql-sanitize-core": minor
"@exortek/fastify-mongo-sanitize": minor
---

- New `debug.logger` option: any object with `error`, `warn`, `info`, `debug` and `trace` methods (pino, `fastify.log`, `console`) receives the debug output instead of `console.log`. It is called pino-style, `logger[level]({ module: 'nosql-sanitize', context, data? }, message)`. `debug.level`, `logSanitizedValues` and `logPatternMatches` apply as before. Default `null` keeps the current `console.log` output.
- Fastify: `debug.logger: 'request'` logs through each request's `request.log` (so lines carry the request id) and through `fastify.log` outside a request. Works in plugin options, route `config.mongoSanitize` and manual mode.
