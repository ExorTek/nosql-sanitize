---
"@exortek/nosql-sanitize-core": minor
"@exortek/express-mongo-sanitize": minor
"@exortek/fastify-mongo-sanitize": minor
---

Sanitize multipart and `+json` bodies, and survive circular references:

- `multipart/form-data` is now in the default `contentTypes`. multer and busboy parse `user[$ne]=x` into `{ user: { $ne: 'x' } }`, so multipart routes were open to operator injection. Only the parsed fields are touched, never files. To keep the old behavior, pass `contentTypes: ['application/json', 'application/x-www-form-urlencoded']`.
- `+json` types (`application/vnd.api+json`, `application/merge-patch+json`, …) are sanitized whenever `application/json` is in `contentTypes`.
- Circular references are cut instead of recursing forever, and reported via `onSanitize` with the new reason `'circular'`. This is required for `@fastify/multipart` with `attachFieldsToBody: true`, whose field objects point back at the body through `fields`. Those field objects no longer carry `fields` after sanitization.
