// Compiled by `yarn test:types` (tsc, module node16) as an ESM consumer. Not run.
import express from 'express';
import mongoSanitize, { paramSanitizeHandler } from '@exortek/express-mongo-sanitize';

const app = express();
app.use(mongoSanitize({ onInjection: 'reject', allowedOperators: ['$set'] }));
app.param('id', paramSanitizeHandler());
app.use(mongoSanitize({ mode: 'manual' }));
app.get('/', (req, res) => {
  req.sanitize?.({ replaceWith: '_' });
  res.json(req.body);
});

// @ts-expect-error unknown mode
mongoSanitize({ mode: 'sometimes' });
