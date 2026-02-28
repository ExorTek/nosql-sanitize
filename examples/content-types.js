/**
 * By default, only application/json and application/x-www-form-urlencoded
 * bodies are sanitized. File uploads and binary data skip automatically.
 * Query and params are ALWAYS sanitized regardless of content type.
 */
const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');

const simpleMultipartParser = (req, res, next) => {
  const contentType = req.headers['content-type'];

  if (!contentType || !contentType.includes('multipart/form-data')) {
    return next();
  }

  let rawData = '';

  req.on('data', (chunk) => {
    rawData += chunk.toString();
  });

  req.on('end', () => {
    req.body = req.body || {};
    req.files = req.files || {};
    const boundary = '--' + contentType.split('boundary=')[1];
    const parts = rawData.split(boundary);
    parts.forEach((part) => {
      if (!part || part.trim() === '' || part === '--\r\n' || part === '--') return;

      if (part.includes('filename=')) {
        const fileMatch = part.match(/name="([^"]+)"; filename="([^"]+)"/);
        if (fileMatch) {
          req.files[fileMatch[1]] = `File: ${fileMatch[2]} (content not parsed in this simple example)`;
        }
      } else if (part.includes('name=')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        const valueSplit = part.split(/\r?\n\r?\n/);

        if (nameMatch && valueSplit.length > 1) {
          const fieldName = nameMatch[1];
          const fieldValue = valueSplit[1].replace(/\r?\n$/, '');
          try {
            req.body[fieldName] = JSON.parse(fieldValue);
          } catch (e) {
            req.body[fieldName] = fieldValue;
          }
        }
      }
    });

    next();
  });
};

const app = express();
app.use(express.json());
app.use(express.urlencoded());
app.use(simpleMultipartParser);

// Default: only JSON + form-urlencoded (if middleware used) bodies sanitized
app.use(mongoSanitize());

app.post('/upload', (req, res) => {
  res.json({
    contentType: req.headers['content-type'],
    body: req.body,
    query: req.query,
    params: req.params,
    files: req.files,
  });
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');

  console.log(
    'Test: curl -X POST http://localhost:3000/upload -H "Content-Type: application/json" -d \'{"username": {"$ne": "admin"}}\'',
  );
  console.log(
    'Test: curl -X POST http://localhost:3000/upload -H "Content-Type: application/x-www-form-urlencoded" -d \'username=$admin\'',
  );
  console.log(
    `Test: curl -X POST http://localhost:3000/upload -F 'maliciousField={"$ne": "admin"}' -F "file=@package.json"`,
  );
});

/**
 * To override, pass contentTypes option:
 *
 * // Sanitize ALL content types
 * mongoSanitize({ contentTypes: null })
 *
 * // Add GraphQL
 * mongoSanitize({ contentTypes: ['application/json', 'application/graphql'] })
 */
