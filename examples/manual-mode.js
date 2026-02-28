/**
 * In manual mode, nothing is sanitized automatically.
 * You call req.sanitize() yourself, wherever you want.
 * Good for routes where you need the raw input first.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize({ mode: 'manual' }));

app.post('/inspect', (req, res) => {
  const raw = JSON.parse(JSON.stringify(req.body));

  // Sanitize when you're ready
  req.sanitize();

  res.json({
    before: raw,
    // { role: "$admin", $token: "abc" }
    after: req.body,
    // { role: "admin", token: "abc" }
  });
});

app.post('/with-options', (req, res) => {
  // Override options per-call
  req.sanitize({ replaceWith: '_' });

  // $admin → _admin
  res.json({ sanitized: req.body });
});

app.post('/raw', (req, res) => {
  // No sanitize() call — body stays untouched
  res.json({ raw: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/inspect -H "Content-Type: application/json" -d \'{"role":"$admin","$token":"abc"}\'',
  );
  console.log(
    'Test: curl -X POST http://localhost:3000/with-options -H "Content-Type: application/json" -d \'{"role":"$admin","token":"abc"}\'',
  );
  console.log(
    'Test: curl -X POST http://localhost:3000/raw -H "Content-Type: application/json" -d \'{"role":"$admin","token":"abc"}\'',
  );
});
