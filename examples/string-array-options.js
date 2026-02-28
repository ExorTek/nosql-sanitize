/**
 * Extra transforms applied during sanitization:
 *   stringOptions: trim, lowercase, maxLength
 *   arrayOptions: filterNull, distinct
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

app.use(
  mongoSanitize({
    stringOptions: {
      trim: true, // Remove leading/trailing whitespace
      lowercase: true, // Convert to lowercase
      maxLength: 50, // Truncate to 50 chars
    },
    arrayOptions: {
      filterNull: true, // Remove null/undefined from arrays
      distinct: true, // Remove duplicate values
    },
  }),
);

app.post('/api', (req, res) => {
  // Input:  { name: "  $ADMIN  ", tags: ["$a", "$a", null, "b"] }
  // Output: { name: "admin", tags: ["a", "b"] }
  //
  // name:  trim → "$ADMIN" → lowercase → "$admin" → sanitize → "admin"
  // tags:  sanitize → ["a","a",null,"b"] → filterNull → ["a","a","b"] → distinct → ["a","b"]
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"name":"  $ADMIN  ","tags":["$a","$a",null,"b"]}\'',
  );
});
