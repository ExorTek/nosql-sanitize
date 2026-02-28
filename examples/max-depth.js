/**
 * Limit how deep the sanitizer recurses into nested objects.
 * Prevents DoS from deeply nested payloads.
 * Strings are always sanitized regardless of depth.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

app.use(mongoSanitize({ maxDepth: 1 }));

app.post('/api', (req, res) => {
  // maxDepth: 1 → only top-level is sanitized
  //
  // Input:
  // {
  //   name: "$root",
  //   nested: { inner: "$deep", more: { hidden: "$secret" } }
  // }
  //
  // Output:
  // {
  //   name: "root",              ← sanitized (string at any depth)
  //   nested: { inner: "$deep", more: { hidden: "$secret" } }
  //                               ↑ not recursed (depth limit)
  // }
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"name":"$root","nested":{"inner":"$deep","more":{"hidden":"$secret"}}}\'',
  );
});

/**
 * maxDepth values:
 *   null | Infinity → unlimited (default)
 *   1     → top-level only
 *   2     → 2 levels deep
 *   5     → safe default for most APIs
 */
