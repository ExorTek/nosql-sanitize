---
"@exortek/nosql-sanitize-core": patch
"@exortek/express-mongo-sanitize": patch
"@exortek/fastify-mongo-sanitize": patch
---

Correct documentation and type comments that described behavior the code doesn't have. `allowedKeys` is a whitelist applied at every depth, not an operator allow-list. `removeEmpty`/`filterNull` drop every falsy value. Multipart and `+json` bodies are not sanitized by default. Express route params need `paramSanitizeHandler`. Also add a production hardening guide and a threat-model section to `SECURITY.md`. No runtime changes.
