---
"@exortek/nosql-sanitize-core": patch
---

Skip per-request debug allocations in `handleRequest` when `debug.enabled` is false. The timing closure and the per-field log message strings are no longer built on the hot path unless debug logging is actually turned on. No behavioural change when debug is enabled.
