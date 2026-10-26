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
  //   name: "root"               ← sanitized (string at any depth)
  // }                            `nested` is over the limit and dropped (maxDepthBehavior: 'remove')
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
 *   32    → default
 *   null  → unlimited (throws max_depth past 256 levels)
 *   1     → top-level only
 *   2     → 2 levels deep
 *
 * maxDepthBehavior: 'remove' (default) drops over-depth values, 'throw' rejects
 * the request, 'preserve' passes them through unsanitized (unsafe).
 */
