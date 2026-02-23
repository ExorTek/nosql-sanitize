/**
 * Fastify — Advanced Usage
 *
 * Demonstrates: contentTypes guard, skipRoutes with regex,
 * maxDepth, onSanitize callback, manual mode, key filtering
 *
 * Run: node examples/fastify-advanced.js
 */
const fastify = require('fastify')({ logger: true });
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

// ─── Register with advanced options ─────────────────────────
fastify.register(mongoSanitize, {
  replaceWith: '',
  maxDepth: 5,

  // Only sanitize JSON bodies — file uploads skip automatically
  contentTypes: ['application/json', 'application/x-www-form-urlencoded'],

  // Skip health + all docs routes
  skipRoutes: ['/health', /^\/docs\/.*/, /^\/api\/v\d+\/internal/],

  // Clean up strings
  stringOptions: {
    trim: true,
    maxLength: 1000,
  },

  // Audit trail
  onSanitize: ({ key, originalValue, sanitizedValue }) => {
    fastify.log.warn({ key, originalValue, sanitizedValue }, 'NoSQL injection attempt blocked');
  },

  // Debug in dev
  debug: {
    enabled: process.env.NODE_ENV === 'development',
    level: 'debug',
    logSkippedRoutes: true,
  },
});

// ─── Routes ─────────────────────────────────────────────────
fastify.post('/api/users', async (request) => {
  return { message: 'User created', data: request.body };
});

fastify.get('/api/users/:id', async (request) => {
  return { id: request.params.id };
});

fastify.get('/health', async () => {
  // Skipped — no sanitization
  return { status: 'ok' };
});

fastify.get('/docs/swagger', async () => {
  // Regex skip — no sanitization
  return { swagger: '3.0' };
});

// ─── Manual mode plugin ─────────────────────────────────────
fastify.register(
  async function manualPlugin(instance) {
    instance.register(mongoSanitize, { mode: 'manual' });

    instance.post('/process', async (request) => {
      // Inspect raw body
      fastify.log.info({ raw: request.body }, 'Before sanitize');

      // Manually sanitize
      request.sanitize({ replaceWith: '_' });
      fastify.log.info({ sanitized: request.body }, 'After sanitize');

      return request.body;
    });
  },
  { prefix: '/manual' },
);

// ─── Key filtering plugin ───────────────────────────────────
fastify.register(
  async function strictPlugin(instance) {
    instance.register(mongoSanitize, {
      allowedKeys: ['username', 'email', 'password'],
      removeEmpty: true,
      stringOptions: { trim: true, lowercase: true },
    });

    instance.post('/register', async (request) => {
      return { sanitized: request.body };
    });
  },
  { prefix: '/strict' },
);

fastify.listen({ port: 3002 }, () => {
  console.log('Fastify advanced example running on http://localhost:3002');
  console.log('');
  console.log('Try:');
  console.log('  curl -X POST http://localhost:3002/api/users \\');
  console.log('    -H "Content-Type: application/json" \\');
  console.log('    -d \'{"username":"$admin","role":{"$ne":""}}\'');
  console.log('');
  console.log('  curl http://localhost:3002/api/users/\\$inject');
  console.log('  curl http://localhost:3002/health');
});
