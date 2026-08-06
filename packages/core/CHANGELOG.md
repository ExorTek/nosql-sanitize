# @exortek/nosql-sanitize-core

## 3.0.1

### Patch Changes

- fa12cb7: Refresh published package metadata: expanded npm `keywords` and enriched READMEs (concrete attack example, compatibility matrix for Express/Fastify 4.x + 5.x, ESM/TypeScript usage, table of contents). No API changes.
- 67a11a1: Skip per-request debug allocations in `handleRequest` when `debug.enabled` is false. The timing closure and the per-field log message strings are no longer built on the hot path unless debug logging is actually turned on. No behavioural change when debug is enabled.
