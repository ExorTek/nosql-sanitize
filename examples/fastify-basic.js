/**
 * Fastify — Basic Usage
 *
 * Run: node examples/fastify-basic.js
 * Test: curl -X POST http://localhost:3000/login \
 *       -H "Content-Type: application/json" \
 *       -d '{"username":"admin","password":{"$ne":""}}'
 */
const fastify = require('fastify')({ logger: true });
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

fastify.register(mongoSanitize);

fastify.post('/login', async (request) => {
  // request.body is sanitized
  // { username: 'admin', password: { ne: '' } }
  return { received: request.body };
});

fastify.get('/search', async (request) => {
  // ?role=$admin → { role: 'admin' }
  return { query: request.query };
});

fastify.get('/user/:id', async (request) => {
  // /user/$inject → { id: 'inject' }
  return { params: request.params };
});

fastify.listen({ port: 3000 }, () => {
  console.log('Fastify basic example running on http://localhost:3000');
});
