---
"@exortek/nosql-sanitize-core": patch
---

Fix option resolution:

- Options set to `undefined` now fall back to their defaults, like options that are left out. Before, `{ recursive: undefined }` turned recursion off, so nested objects went through unsanitized, and `{ replaceWith: undefined }` inserted the string `'undefined'`. The same applies to the fields of `stringOptions`, `arrayOptions` and `debug`.
- `sanitizeObjects` given as a string (e.g. `'body'`) now throws a `type_error`. Before, it was split into `['b', 'o', 'd', 'y']` and nothing was sanitized.
