---
"@exortek/nosql-sanitize-core": minor
---

Add standalone `sanitize(value, options?)` and `hasInjection(value, options?)` for data that doesn't come through an HTTP request (GraphQL arguments, WebSocket messages, queue payloads). `sanitize` returns a sanitized copy. `hasInjection` reports whether sanitizing would neutralize an injection (operator characters, prototype keys, dotted keys with `dotKeys` set) without changing anything, and scans every depth regardless of `maxDepth`. Both accept user or resolved options and resolve a user options object once.
