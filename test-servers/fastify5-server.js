'use strict';

const Fastify = require('fastify5');
const mongoSanitize = require('@exortek/fastify-mongo-sanitize');

const PORT = process.env.PORT || 3004;

async function build() {
  const app = Fastify({ logger: false });

  app.register(async (instance) => {
    await instance.register(mongoSanitize);

    instance.post('/auto/basic', async (request) => {
      return { body: request.body, query: request.query };
    });

    instance.get('/auto/query', async (request) => {
      return { query: request.query };
    });
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { mode: 'manual' });

    instance.post('/manual/sanitize', async (request) => {
      const before = JSON.parse(JSON.stringify(request.body));
      request.sanitize();
      return { before, after: request.body };
    });

    instance.post('/manual/sanitize-custom', async (request) => {
      request.sanitize({ maxDepth: 1, maxDepthBehavior: 'remove' });
      return { body: request.body };
    });
  });

  const events = [];
  app.register(async (instance) => {
    await instance.register(mongoSanitize, {
      replaceWith: '_',
      removeEmpty: true,
      maxDepth: 3,
      maxDepthBehavior: 'remove',
      preserveEmails: true,
      deniedKeys: ['secret', 'internal_id'],
      stringOptions: { trim: true, lowercase: true, maxLength: 200 },
      arrayOptions: { filterNull: true, distinct: true },
      skipRoutes: ['/full/skip', /^\/full\/regex-skip/],
      onSanitize: (e) => events.push(e),
    });

    instance.post('/full/test', async (request) => {
      return { body: request.body, query: request.query, events: events.splice(0) };
    });

    instance.post('/full/skip', async (request) => {
      return { body: request.body, skipped: true };
    });

    instance.post('/full/regex-skip/anything', async (request) => {
      return { body: request.body, skipped: true };
    });
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, {
      customSanitizer: (data) => {
        const out = {};
        for (const [k, v] of Object.entries(data)) {
          out[k.toUpperCase()] = typeof v === 'string' ? v.toUpperCase() : v;
        }
        return out;
      },
    });

    instance.post('/custom/test', async (request) => {
      return { body: request.body };
    });
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { maxDepth: 1, maxDepthBehavior: 'throw' });

    instance.post('/throw/test', async (request) => {
      return { body: request.body };
    });

    instance.setErrorHandler((error, request, reply) => {
      reply.status(400).send({ error: error.message, code: error.code });
    });
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize);

    instance.post('/proto/test', async (request) => {
      const result = request.body;
      return {
        body: result,
        hasProto: Object.hasOwn(result, '__proto__'),
        globalPolluted: {}.isAdmin !== undefined,
      };
    });

    instance.get('/proto/query', async (request) => {
      return {
        query: request.query,
        queryProto: Object.getPrototypeOf(request.query),
      };
    });
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { allowedKeys: ['$set', '$push'] });
    instance.post('/allowed/test', async (request) => ({ body: request.body }));
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { removeMatches: true });
    instance.post('/removematches/test', async (request) => ({ body: request.body }));
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { arrayOptions: { filterNull: true, distinct: true } });
    instance.post('/arrayopts/test', async (request) => ({ body: request.body }));
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { preserveEmails: false });
    instance.post('/no-email/test', async (request) => ({ body: request.body }));
  });

  app.register(async (instance) => {
    await instance.register(mongoSanitize, { replaceWith: '_' });
    instance.post('/replace/test', async (request) => ({ body: request.body }));
  });

  // recursive: false
  app.register(async (instance) => {
    await instance.register(mongoSanitize, { recursive: false });
    instance.post('/no-recursive/test', async (request) => ({ body: request.body }));
  });

  // maxDepth preserve
  app.register(async (instance) => {
    await instance.register(mongoSanitize, { maxDepth: 1, maxDepthBehavior: 'preserve' });
    instance.post('/preserve/test', async (request) => ({ body: request.body }));
  });

  return app;
}

build().then((app) => {
  app.listen({ port: PORT }, (err) => {
    if (err) throw err;
    console.log(`[Fastify 5] listening on :${PORT}`);
  });
});

module.exports = { build, PORT };
