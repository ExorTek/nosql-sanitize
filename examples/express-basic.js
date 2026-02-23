/**
 * Express — Basic Usage
 *
 * Run: node examples/express-basic.js
 * Test: curl -X POST http://localhost:3000/login \
 *       -H "Content-Type: application/json" \
 *       -d '{"username":"admin","password":{"$ne":""}}'
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());
app.use(mongoSanitize());

app.post('/login', (req, res) => {
  console.log('Sanitized body:', req.body);
  // { username: 'admin', password: { ne: '' } }
  res.json({ received: req.body });
});

app.get('/search', (req, res) => {
  console.log('Sanitized query:', req.query);
  // ?role=$admin → { role: 'admin' }
  res.json({ query: req.query });
});

app.listen(3000, () => {
  console.log('Express basic example running on http://localhost:3000');
});
