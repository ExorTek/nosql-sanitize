---
"@exortek/nosql-sanitize-core": major
"@exortek/express-mongo-sanitize": major
"@exortek/fastify-mongo-sanitize": major
---

Fail-closed defaults. See the [migration guide](https://github.com/ExorTek/nosql-sanitize/blob/master/MIGRATION-v4.md) for how to keep any v3 behavior.

- Node.js 20 or newer is required.
- `maxDepth` defaults to `32` and `maxDepthBehavior` to `'remove'`: values nested deeper are dropped instead of passing through unsanitized.
- `dotKeys` defaults to `'replace'`: `{ "profile.isAdmin": true }` becomes `{ "profileisAdmin": true }`. With `onInjection: 'reject'`, dotted keys are rejected.
- `deniedKeys` always remove the key, even when its value looks like an email (`preserveEmails` no longer overrides them).
- `removeEmpty: true` now means `'empty'` (keeps `0` and `false`, removes `{}` and `[]`), and `arrayOptions.filterNull: true` means `'nullish'`. Use `'falsy'` for the v3 behavior.
- Fastify: sanitizes in `preValidation` by default, so schemas validate the sanitized data (`hook: 'preHandler'` restores v3).
- Fastify: debug output goes through `request.log` by default when a Fastify logger is configured (`debug.logger: null` restores `console.log`).
