---
"@exortek/nosql-sanitize-core": patch
---

Harden option handling:

- `patterns` must be a non-empty array of `RegExp`s. A string pattern used to silently disable sanitization, and an empty array used to match everywhere. Both now throw a `type_error`.
- Pattern flags are kept when patterns are combined, so `/where/i` matches `WHERE`.
- `replaceWith` is inserted literally. `$&` / `$1` are no longer expanded.
- With `maxDepth: null`, nesting deeper than 256 levels now throws `NoSQLSanitizeError('max_depth')`. Before, a hostile payload overflowed the stack with a raw `RangeError`.
- `DEFAULT_OPTIONS` is deeply frozen, and resolved options no longer share arrays with it.
- With `allowPrototypeKeys: true`, `__proto__` is kept as an own key instead of swapping the result object's prototype.
