'use strict';

const express = require('express4');
const mongoSanitize = require('@exortek/express-mongo-sanitize');
const { paramSanitizeHandler } = mongoSanitize;

const PORT = process.env.PORT || 3001;
const app = express();

const autoApp = express();
autoApp.use(express.json());
autoApp.use(mongoSanitize({ skipRoutes: ['/skip/exact', /^\/skip\/regex/] }));

autoApp.post('/basic', (req, res) => res.json({ body: req.body, query: req.query }));
autoApp.get('/query', (req, res) => res.json({ query: req.query }));
autoApp.post('/skip/exact', (req, res) => res.json({ body: req.body, skipped: true }));
autoApp.post('/skip/regex/anything', (req, res) => res.json({ body: req.body, skipped: true }));

app.use('/auto', autoApp);

const manualApp = express();
manualApp.use(express.json());
manualApp.use(mongoSanitize({ mode: 'manual' }));

manualApp.post('/sanitize', (req, res) => {
  const before = JSON.parse(JSON.stringify(req.body));
  req.sanitize();
  res.json({ before, after: req.body });
});

manualApp.post('/sanitize-custom', (req, res) => {
  req.sanitize({ maxDepth: 1, maxDepthBehavior: 'remove' });
  res.json({ body: req.body });
});

app.use('/manual', manualApp);

const events = [];
const fullApp = express();
fullApp.use(express.json());
fullApp.use(
  mongoSanitize({
    replaceWith: '_',
    removeEmpty: true,
    maxDepth: 3,
    maxDepthBehavior: 'remove',
    preserveEmails: true,
    deniedKeys: ['secret', 'internal_id'],
    stringOptions: { trim: true, lowercase: true, maxLength: 200 },
    arrayOptions: { filterNull: true, distinct: true },
    onSanitize: (e) => events.push(e),
  }),
);

fullApp.post('/test', (req, res) => {
  res.json({ body: req.body, query: req.query, events: events.splice(0) });
});

app.use('/full', fullApp);

const customApp = express();
customApp.use(express.json());
customApp.use(
  mongoSanitize({
    customSanitizer: (data) => {
      const out = {};
      for (const [k, v] of Object.entries(data)) {
        out[k.toUpperCase()] = typeof v === 'string' ? v.toUpperCase() : v;
      }
      return out;
    },
  }),
);

customApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/custom', customApp);

const throwApp = express();
throwApp.use(express.json());
throwApp.use(mongoSanitize({ maxDepth: 1, maxDepthBehavior: 'throw' }));
throwApp.post('/test', (req, res) => res.json({ body: req.body }));
throwApp.use((err, req, res, next) => {
  res.status(400).json({ error: err.message, code: err.code });
});
app.use('/throw', throwApp);

const protoApp = express();
protoApp.use(express.json());
protoApp.use(mongoSanitize());
protoApp.post('/test', (req, res) => {
  res.json({
    body: req.body,
    hasProto: Object.hasOwn(req.body, '__proto__'),
    globalPolluted: {}.isAdmin !== undefined,
  });
});
app.use('/proto', protoApp);

const allowedApp = express();
allowedApp.use(express.json());
allowedApp.use(mongoSanitize({ allowedKeys: ['$set', '$push'] }));
allowedApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/allowed', allowedApp);

const rmApp = express();
rmApp.use(express.json());
rmApp.use(mongoSanitize({ removeMatches: true }));
rmApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/removematches', rmApp);

const arrApp = express();
arrApp.use(express.json());
arrApp.use(mongoSanitize({ arrayOptions: { filterNull: true, distinct: true } }));
arrApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/arrayopts', arrApp);

const noEmailApp = express();
noEmailApp.use(express.json());
noEmailApp.use(mongoSanitize({ preserveEmails: false }));
noEmailApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/no-email', noEmailApp);

const ctApp = express();
ctApp.use(express.json());
ctApp.use(express.text());
ctApp.use(mongoSanitize({ contentTypes: ['application/json'] }));
ctApp.post('/json', (req, res) => res.json({ body: req.body }));
ctApp.post('/text', (req, res) => res.json({ body: req.body }));
app.use('/ct', ctApp);

const replApp = express();
replApp.use(express.json());
replApp.use(mongoSanitize({ replaceWith: '_' }));
replApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/replace', replApp);

const noRecApp = express();
noRecApp.use(express.json());
noRecApp.use(mongoSanitize({ recursive: false }));
noRecApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/no-recursive', noRecApp);

const preserveApp = express();
preserveApp.use(express.json());
preserveApp.use(mongoSanitize({ maxDepth: 1, maxDepthBehavior: 'preserve' }));
preserveApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/preserve', preserveApp);

const formApp = express();
formApp.use(express.urlencoded({ extended: true }));
formApp.use(mongoSanitize());
formApp.post('/test', (req, res) => res.json({ body: req.body }));
app.use('/form', formApp);

app.use(express.json());
app.param('username', paramSanitizeHandler());
app.get('/user/:username', (req, res) => res.json({ username: req.params.username }));

const server = app.listen(PORT, () => {
  console.log(`[Express 4] listening on :${PORT}`);
});

module.exports = { app, server, PORT };
