// Compiled by `yarn test:types` (tsc, module node16) as a CommonJS consumer. Not run.
import Fastify = require('fastify');
import mongoSanitize = require('@exortek/fastify-mongo-sanitize');

const app = Fastify();
app.register(mongoSanitize, { mode: 'manual', removeEmpty: 'empty' });

export = app;
