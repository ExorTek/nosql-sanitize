/**
 * Register as a Fastify plugin. Body, query, and params
 * are all sanitized automatically.
 */
const fastify = require('fastify')({ logger: true });
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

// Register — all requests are now protected.
fastify.register(mongoSanitize);

fastify.post('/login', async (request) => {
  // Input:  { username: "admin", password: { "$ne": "" } }
  // Output: { username: "admin", password: { "ne": "" } }
  return { sanitized: request.body };
});

fastify.get('/search', async (request) => {
  // GET /search?role=$admin
  // Output: { role: "admin" }
  return { sanitized: request.query };
});

fastify.get('/user/:id', async (request) => {
  // GET /user/$inject
  // Output: { id: "inject" }
  return { sanitized: request.params };
});

fastify.listen({ port: 3000 }, () => {
  console.log('Fastify basic example running on http://localhost:3000');

  console.log(
    'Test: curl -X POST http://localhost:3000/login -H "Content-Type: application/json" -d \'{"username":"admin","password":{"$ne":""}}\'',
  );
  console.log('Test: http://localhost:3000/search?role=$admin');
  console.log('Test: http://localhost:3000/user/$inject');
});
