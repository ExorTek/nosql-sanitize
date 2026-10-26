'use strict';

const fp = require('fastify-plugin');
const { resolveOptions, handleRequest, shouldSkipRoute, log, isPlainObject } = require('@exortek/nosql-sanitize-core');

const setup = (fastify, options) => {
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
      if (!isPlainObject(customOpts)) return resolveOptions({ ...baseOptions, ...customOpts });
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
      // onInjection: 'reject' and maxDepthBehavior: 'throw' throw; hand the error to Fastify
      try {
        handleRequest(request, opts);
      } catch (err) {
        return done(err);
      }
      done();
    });
  }

  log(opts.debug, 'info', 'PLUGIN', 'Plugin initialized');
};

// avvio doesn't catch a synchronous throw from a callback plugin (it crashes the process),
// so configuration errors go through done() and reject fastify.ready() instead
const fastifyMongoSanitize = (fastify, options, done) => {
  try {
    setup(fastify, options);
  } catch (err) {
    return done(err);
  }
  done();
};

module.exports = fp(fastifyMongoSanitize, {
  name: 'fastify-mongo-sanitize',
  fastify: '>=4.x.x',
});
module.exports.default = fastifyMongoSanitize;
module.exports.fastifyMongoSanitize = fastifyMongoSanitize;
