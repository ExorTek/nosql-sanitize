// Compiled by `yarn test:types` (tsc, module node16) as an ESM consumer. Not run.
import Fastify from 'fastify';
import mongoSanitize from '@exortek/fastify-mongo-sanitize';

const app = Fastify();
app.register(mongoSanitize, { hook: 'preValidation', onInjection: 'reject' });
app.post('/raw', { config: { mongoSanitize: false } }, async () => 'ok');
app.patch('/admin', { config: { mongoSanitize: { allowedOperators: ['$set'] } } }, async (request) => {
  request.sanitize?.({ maxDepth: 2 });
  return request.body;
});

// @ts-expect-error invalid hook
app.register(mongoSanitize, { hook: 'onRequest' });

app.register(mongoSanitize, { debug: { enabled: true, logger: 'request' } });
app.register(mongoSanitize, { debug: { enabled: true, logger: app.log } });
app.get('/logged', { config: { mongoSanitize: { debug: { logger: 'request' } } } }, async () => 'ok');

// @ts-expect-error unknown logger name
app.register(mongoSanitize, { debug: { logger: 'reply' } });
