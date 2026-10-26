// Compiled by `yarn test:types` (tsc, module node16) as a CommonJS consumer. Not run.
import express = require('express');
import mongoSanitize = require('@exortek/express-mongo-sanitize');

const app = express();
app.use(mongoSanitize());
app.use(mongoSanitize.expressMongoSanitize({ dotKeys: 'replace' }));
app.param('id', mongoSanitize.paramSanitizeHandler());

export = app;
