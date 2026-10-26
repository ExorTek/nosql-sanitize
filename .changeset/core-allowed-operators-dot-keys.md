---
"@exortek/nosql-sanitize-core": minor
---

Add `allowedOperators` and `dotKeys`:

- `allowedOperators: string[]` keeps the listed `$`-operators verbatim at every depth, for example `['$set']` on a trusted admin update route. Values under them are still sanitized. Listed operators also pass the `allowedKeys` whitelist and are never dropped by `removeMatches`; `deniedKeys` still removes them. Each entry must be a string that starts with `$`. `allowedKeys` remains a key whitelist and never let operators through.
- `dotKeys: 'allow' | 'replace' | 'remove'` handles keys containing `.` (such as `'profile.isAdmin'`), which turn into nested writes when spread into `$set`. `'replace'` swaps each `.` for `replaceWith`. `'remove'` drops the pair and reports `onSanitize` reason `'dotKey'`. The default `'allow'` keeps the current behavior.
