/**
 * Get notified every time a value is sanitized.
 * Use for audit logging, metrics, alerting, rate limiting.
 * Only fires when a value actually changes.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

// Simple console logging
app.use(
  mongoSanitize({
    onSanitize: ({ key, originalValue, sanitizedValue, path }) => {
      console.log(`⚠️  Sanitized "${key}": "${originalValue}" → "${sanitizedValue}"`);
    },
  }),
);

app.post('/api', (req, res) => {
  // Console output:
  //   ⚠️  Sanitized "username": "$admin" → "admin"
  //   ⚠️  Sanitized "$ne": "" → ""       (key itself was sanitized)
  //
  // Note: "email" doesn't trigger — value didn't change.
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');

  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"username":"$admin","email":"$admin","$ne":""}\'',
  );
});

/**
 * Production example — increment metrics:
 *
 * mongoSanitize({
 *   onSanitize: ({ key }) => {
 *     metrics.increment('nosql.injection.blocked', { key });
 *   },
 * })
 */
