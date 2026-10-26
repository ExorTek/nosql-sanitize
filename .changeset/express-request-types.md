---
"@exortek/express-mongo-sanitize": patch
---

`req.sanitize()` (manual mode) is now visible to TypeScript. The type augmentation targeted `module 'express'`, which never reached the `req` that route handlers receive; it now augments the global `Express.Request`.
