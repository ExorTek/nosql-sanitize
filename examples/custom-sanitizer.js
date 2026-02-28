/**
 * Override the default sanitization with your own function.
 * Receives the data and resolved options, returns sanitized data.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    // Remove HTML tags and $ characters
    return value.replace(/<[^>]*>/g, '').replace(/\$/g, '');
  } else if (typeof value === 'object' && value !== null) {
    // Recursively sanitize objects and arrays
    for (const key in value) {
      value[key] = sanitizeValue(value[key]);
    }
    return value;
  }
  return value; // Return other types unchanged
};

app.use(
  mongoSanitize({
    customSanitizer: (data, options) => {
      return sanitizeValue(data);
    },
  }),
);

app.post('/api', (req, res) => {
  // Input:  { username: "<script>alert(1)</script>", role: "$admin" }
  // Output: { username: "alert(1)", role: "admin" }
  res.json({ sanitized: req.body });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/api -H "Content-Type: application/json" -d \'{"username":"<script>alert(1)</script>","role":"$admin"}\'',
  );
});
