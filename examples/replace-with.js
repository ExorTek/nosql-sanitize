/**
 * By default, matched patterns are removed (replaced with '').
 * You can replace them with any string instead.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

app.use(mongoSanitize({ replaceWith: '_' }));

app.post('/api', (req, res) => {
  // Input:  { query: { "$gt": 0 }, name: "$admin" }
  // Output: { query: { "_gt": 0 }, name: "_admin" }
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server is running on port 3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"query":{"$gt":0},"name":"$admin"}\'',
  );
});
