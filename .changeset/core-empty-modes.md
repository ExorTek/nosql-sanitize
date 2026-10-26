---
"@exortek/nosql-sanitize-core": minor
---

Add modes for `removeEmpty` and `arrayOptions.filterNull`, which today also drop `0` and `false`:

- `removeEmpty: 'empty'` only removes `''`, `null`, `undefined`, `{}` and `[]`, so `0` and `false` are kept.
- `arrayOptions.filterNull: 'nullish'` only removes `null` and `undefined`.

`true` keeps its current meaning, and `'falsy'` is a new explicit alias for it. A future major version may switch the meaning of `true` to the new modes.
