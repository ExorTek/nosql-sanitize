/**
 * Instead of replacing the $ character, remove the entire
 * key-value pair if a pattern is found.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

app.use(mongoSanitize({ removeMatches: true }));

app.post('/api', (req, res) => {
  // Input:  { username: "admin", password: { "$ne": "" }, role: "$admin" }
  // Output: { username: "admin", password: {} }
  //
  // "$ne" key removed entirely, "role" with "$admin" value removed entirely
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"username":"admin","password":{"$ne":""},"role":"$admin"}\'',
  );
});
