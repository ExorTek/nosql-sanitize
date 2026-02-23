const express = require('express');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const { paramSanitizeHandler } = mongoSanitize;

const app = express();
app.use(express.json());

app.use(
  mongoSanitize({
    replaceWith: '',
    maxDepth: 5,

    // Only sanitize JSON and form bodies — skip file uploads
    contentTypes: ['application/json', 'application/x-www-form-urlencoded'],

    // Skip health checks and all doc routes
    skipRoutes: ['/health', /^\/docs\/.*/, /^\/api\/v\d+\/internal/],

    // String cleanup
    stringOptions: {
      trim: true,
      maxLength: 1000,
    },

    // Track sanitization events
    onSanitize: ({ key, originalValue, sanitizedValue }) => {
      console.log(`⚠️  Sanitized "${key}": "${originalValue}" → "${sanitizedValue}"`);
    },

    // Debug in development
    debug: {
      enabled: process.env.NODE_ENV === 'development',
      level: 'debug',
      logSkippedRoutes: true,
      logSanitizedValues: true,
    },
  }),
);

app.param('userId', paramSanitizeHandler());

app.post('/api/users', (req, res) => {
  res.json({ message: 'User created', data: req.body });
});

app.get('/api/users/:userId', (req, res) => {
  res.json({ userId: req.params.userId });
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/docs/swagger', (req, res) => {
  res.json({ swagger: '3.0' });
});

const manualRouter = express.Router();
manualRouter.use(mongoSanitize({ mode: 'manual' }));

manualRouter.post('/process', (req, res) => {
  console.log('Before sanitize:', req.body);

  req.sanitize({ replaceWith: '_' });
  console.log('After sanitize:', req.body);

  res.json(req.body);
});

app.use('/manual', manualRouter);

const strictRouter = express.Router();
strictRouter.use(express.json());
strictRouter.use(
  mongoSanitize({
    allowedKeys: ['username', 'email', 'password'],
    removeEmpty: true,
    stringOptions: { trim: true, lowercase: true },
  }),
);

strictRouter.post('/register', (req, res) => {
  res.json({ sanitized: req.body });
});

app.use('/strict', strictRouter);

app.listen(3001, () => {
  console.log('Express advanced example running on http://localhost:3001');
  console.log('');
  console.log('Try:');
  console.log('  curl -X POST http://localhost:3001/api/users \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"username":"$admin","role":{"$ne":""}}\'');
  console.log('');
  console.log('  curl http://localhost:3001/api/users/\\$inject');
  console.log('  curl http://localhost:3001/health');
  console.log('');
  console.log('  curl -X POST http://localhost:3001/manual/process \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"query":{"$gt":0}}\'');
});
