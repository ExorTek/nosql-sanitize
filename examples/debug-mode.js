/**
 * Enable verbose logging for development.
 * Shows skipped routes, pattern matches, and sanitized values.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

app.use(
  mongoSanitize({
    skipRoutes: ['/health'],
    debug: {
      enabled: true,
      level: 'debug', // silent | error | warn | info | debug | trace
      logSkippedRoutes: true, // Log when a route is skipped
      logPatternMatches: true, // Log regex pattern matches
      logSanitizedValues: true, // Log before/after values
    },
  }),
);

app.post('/api', (req, res) => {
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"username":"$admin","email":"$admin","$ne":""}\'',
  );
});

/**
 * Tip: Only enable in development
 *
 * debug: {
 *   enabled: process.env.NODE_ENV === 'development',
 *   ...
 * }
 */
