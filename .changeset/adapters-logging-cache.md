---
"@exortek/express-mongo-sanitize": patch
"@exortek/fastify-mongo-sanitize": patch
"@exortek/nosql-sanitize-core": patch
---

Adapter fixes:

- Fastify: `request.sanitize(customOpts)` in manual mode no longer drops the plugin's `sanitizeObjects` default (`['body', 'params', 'query']`). Before, route params went through unsanitized whenever custom options were passed.
- Express: the `Plugin initialized` debug log is written once at setup instead of on every request.
- Express and Fastify: manual-mode custom options are resolved once per options object and cached, instead of on every `sanitize()` call. Don't mutate an options object after passing it.
- All packages list the `types` condition first in `exports`.
