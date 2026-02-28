/**
 * Whitelist or blacklist specific keys.
 * Works alongside sanitization — keys are filtered first,
 * then remaining values are sanitized.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(express.json());

// Whitelist — only these keys pass through
const whitelist = express.Router();
whitelist.use(
  mongoSanitize({
    allowedKeys: ['username', 'email', 'password'],
  }),
);
whitelist.post('/whitelist', (req, res) => {
  // Input:  { username, email, __proto__, extra }
  // Output: { username, email }
  res.json({ sanitized: req.body });
});

// Blacklist — block dangerous keys
const blacklist = express.Router();
blacklist.use(
  mongoSanitize({
    deniedKeys: ['__proto__', 'constructor', '$where'],
  }),
);
blacklist.post('/blacklist', (req, res) => {
  // Input:  { username, __proto__, constructor }
  // Output: { username }
  res.json({ sanitized: req.body });
});

app.use(whitelist);
app.use(blacklist);

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log(
    'Test: curl -X POST http://localhost:3000/whitelist -H "Content-Type: application/json" -d \'{"username":"admin","email":"user@user.com","__proto__":"admin","extra":"admin"}\'',
  );
  console.log(
    'Test: curl -X POST http://localhost:3000/blacklist -H "Content-Type: application/json" -d \'{"username":"admin","__proto__":"admin","constructor":"admin"}\'',
  );
});
