'use strict';

const fp = require('fastify-plugin');
const { resolveOptions, handleRequest, shouldSkipRoute, log } = require('@exortek/nosql-sanitize-core');

const fastifyMongoSanitize = (fastify, options, done) => {
  const opts = resolveOptions({
    sanitizeObjects: ['body', 'params', 'query'],
    ...options,
  });

  log(opts.debug, 'info', 'PLUGIN', 'Initializing nosql-sanitize plugin', {
    mode: opts.mode,
    sanitizeObjects: [...opts.sanitizeObjects] || opts.sanitizeObjects,
  });

  if (opts.mode === 'manual') {
    fastify.decorateRequest('sanitize', function (customOpts = {}) {
      const finalOpts = Object.keys(customOpts).length ? resolveOptions({ ...options, ...customOpts }) : opts;
      handleRequest(this, finalOpts);
    });
  }

  if (opts.mode === 'auto') {
    fastify.addHook('preHandler', (request, reply, done) => {
      if (shouldSkipRoute(request.url, opts.skipRoutes, opts.debug)) {
        return done();
      }
      handleRequest(request, opts);
      done();
    });
  }

  log(opts.debug, 'info', 'PLUGIN', 'Plugin initialized');
  done();
};

module.exports = fp(fastifyMongoSanitize, {
  name: 'fastify-mongo-sanitize',
  fastify: '>=4.x.x',
});
module.exports.default = fastifyMongoSanitize;
module.exports.fastifyMongoSanitize = fastifyMongoSanitize;
