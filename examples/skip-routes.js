/**
 * Exclude specific routes from sanitization.
 * Supports exact strings (O(1) Set lookup) and regex patterns.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

app.use(
  mongoSanitize({
    skipRoutes: [
      // Exact matches — O(1) Set.has()
      '/health',
      '/metrics',

      // Regex — any path starting with /docs/
      /^\/docs\/.*/,

      // Regex — versioned internal routes
      /^\/api\/v\d+\/internal/,
    ],
  }),
);

// Sanitized
app.post('/api/users', (req, res) => {
  // { name: "$admin" } → { name: "admin" }
  res.json({ sanitized: req.body });
});

// Skipped (exact match)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', note: 'Not sanitized', query: req.query });
});

// Skipped (regex match)
app.get('/docs/swagger', (req, res) => {
  res.json({ swagger: '3.0', note: 'Not sanitized', query: req.query });
});

// Skipped (regex match)
app.get('/api/v1/internal/debug', (req, res) => {
  res.json({ debug: true, note: 'Not sanitized', query: req.query });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api/users -H "Content-Type: application/json" -d \'{"name":"$admin"}\'',
  );
  console.log('Test: curl http://localhost:3000/health?user=$admin');
  console.log('Test: curl http://localhost:3000/docs/swagger?version=$admin');
  console.log('Test: curl http://localhost:3000/api/v1/internal/debug?mode=$admin');
});
