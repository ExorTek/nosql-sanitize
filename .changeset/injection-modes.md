---
"@exortek/nosql-sanitize-core": minor
"@exortek/express-mongo-sanitize": minor
"@exortek/fastify-mongo-sanitize": minor
---

Add `onInjection: 'sanitize' | 'reject' | 'report'` (default `'sanitize'`, unchanged behavior):

- `'reject'` answers 400 instead of stripping an injection. `handleRequest` throws `NoSQLSanitizeError` with `type: 'injection_detected'` and `statusCode: 400`, using the same rules as `hasInjection`. Requests without an injection are still sanitized as configured.
- `'report'` is a dry run for a safe rollout: changes are reported through `onSanitize` (required) and requests are left untouched.

`NoSQLSanitizeError` takes an optional `statusCode`. The Fastify preHandler hook now passes sanitizer errors to `done(err)`.
