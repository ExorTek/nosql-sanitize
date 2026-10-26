---
"@exortek/nosql-sanitize-core": patch
"@exortek/express-mongo-sanitize": patch
---

Fix key casing, log hygiene and nested option validation:

- `stringOptions.trim` and `stringOptions.lowercase` apply to values only. Before, they also rewrote keys, so `{ userName: 'A' }` became `{ username: 'a' }`.
- Original and sanitized strings are logged only with `debug.logSanitizedValues: true`. Before, they were logged whenever debug logging was at `debug` level. `debug.logPatternMatches` now logs a match without the value.
- `paramSanitizeHandler` no longer logs raw route param values (only with `debug.logSanitizedValues`).
- Debug logging no longer throws on circular or `BigInt` data.
- The fields of `stringOptions`, `arrayOptions` and `debug` are validated. An invalid value such as `debug.level: 'bogus'` or `stringOptions.maxLength: -1` now throws a `type_error` that names the field. `stringOptions.maxLength` must be `null` or a positive integer.
