/**
 * The simplest setup. Register the middleware and all
 * incoming body + query data is automatically sanitized.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

// Register — that's it. All requests are now protected. (body + query)
app.use(mongoSanitize());

app.post('/login', (req, res) => {
  // Input:  { username: "admin", password: { "$ne": "" } }
  // Output: { username: "admin", password: { "ne": "" } }
  res.json({ sanitized: req.body });
});

app.get('/search', (req, res) => {
  // GET /search?role=$admin&page=1
  // Output: { role: "admin", page: "1" }
  res.json({ sanitized: req.query });
});

app.listen(3000, () => {
  console.log('http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d \'{"username":"admin","password":{"$ne":""}}\'',
  );
  console.log('Test: http://localhost:3000/search?role=$admin&page=1');
});
