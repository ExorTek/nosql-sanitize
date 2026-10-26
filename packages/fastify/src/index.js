'use strict';

const fp = require('fastify-plugin');
const { resolveOptions, handleRequest, shouldSkipRoute, log } = require('@exortek/nosql-sanitize-core');

const fastifyMongoSanitize = (fastify, options, done) => {
  // Fastify parses params before hooks run, so they're sanitized by default here
  const baseOptions = {
    sanitizeObjects: ['body', 'params', 'query'],
    ...options,
  };
  const opts = resolveOptions(baseOptions);

  log(opts.debug, 'info', 'PLUGIN', 'Initializing nosql-sanitize plugin', {
    mode: opts.mode,
    sanitizeObjects: opts.sanitizeObjects,
  });

  if (opts.mode === 'manual') {
    // request.sanitize(customOpts) runs per request, so resolve each options object only once.
    // Options objects are treated as immutable: pass a new object to change them.
    const customCache = new WeakMap();
    const resolveCustom = (customOpts) => {
      if (typeof customOpts !== 'object') return resolveOptions({ ...baseOptions, ...customOpts });
      let resolved = customCache.get(customOpts);
      if (!resolved) {
        resolved = resolveOptions({ ...baseOptions, ...customOpts });
        customCache.set(customOpts, resolved);
      }
      return resolved;
    };

    fastify.decorateRequest('sanitize', function (customOpts = {}) {
      const finalOpts = Object.keys(customOpts).length ? resolveCustom(customOpts) : opts;
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
