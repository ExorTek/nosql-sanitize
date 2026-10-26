'use strict';

const fp = require('fastify-plugin');
const {
  resolveOptions,
  handleRequest,
  shouldSkipRoute,
  log,
  isPlainObject,
  NoSQLSanitizeError,
} = require('@exortek/nosql-sanitize-core');

// 'preValidation' (default) sanitizes before schema validation, so the schema checks the sanitized data
const HOOKS = Object.freeze(['preHandler', 'preValidation']);

// debug.logger: 'request' (default) logs through each request's request.log, and through fastify.log
// outside a request. A logger object or null (console.log) opts out.
const REQUEST_LOGGER = 'request';

const setup = (fastify, options) => {
  // Fastify parses params before hooks run, so they're sanitized by default here
  const baseOptions = {
    sanitizeObjects: ['body', 'params', 'query'],
    ...options,
  };

  const requestLogged = new WeakSet();
  const resolve = (raw) => {
    const debug = raw.debug === undefined ? {} : raw.debug;
    // Anything else (including an invalid debug option) is left to resolveOptions
    if (!isPlainObject(debug) || (debug.logger !== undefined && debug.logger !== REQUEST_LOGGER)) {
      return resolveOptions(raw);
    }
    const resolved = resolveOptions({ ...raw, debug: { ...debug, logger: fastify.log } });
    requestLogged.add(resolved);
    return resolved;
  };
  // Copies the options only when debug is on, so the default path allocates nothing
  const forRequest = (resolved, request) =>
    resolved.debug.enabled && requestLogged.has(resolved)
      ? { ...resolved, debug: { ...resolved.debug, logger: request.log } }
      : resolved;

  const opts = resolve(baseOptions);

  log(opts.debug, 'info', 'PLUGIN', 'Initializing nosql-sanitize plugin', {
    mode: opts.mode,
    sanitizeObjects: opts.sanitizeObjects,
  });

  if (opts.mode === 'manual') {
    // request.sanitize(customOpts) runs per request, so resolve each options object only once.
    // Options objects are treated as immutable: pass a new object to change them.
    const customCache = new WeakMap();
    const resolveCustom = (customOpts) => {
      if (!isPlainObject(customOpts)) return resolve({ ...baseOptions, ...customOpts });
      let resolved = customCache.get(customOpts);
      if (!resolved) {
        resolved = resolve({ ...baseOptions, ...customOpts });
        customCache.set(customOpts, resolved);
      }
      return resolved;
    };

    fastify.decorateRequest('sanitize', function (customOpts = {}) {
      const finalOpts = Object.keys(customOpts).length ? resolveCustom(customOpts) : opts;
      handleRequest(this, forRequest(finalOpts, this));
    });
  }

  const hook = options.hook === undefined ? 'preValidation' : options.hook;
  if (!HOOKS.includes(hook)) throw new NoSQLSanitizeError('Invalid configuration: "hook"', 'type_error');

  if (opts.mode === 'auto') {
    // Route-level config.mongoSanitize: false skips the route, an object overrides the plugin options
    const resolveRoute = (config) => {
      const route = config?.mongoSanitize;
      if (route === undefined || route === true) return opts;
      if (route === false) return null;
      if (!isPlainObject(route)) {
        throw new NoSQLSanitizeError('Invalid configuration: "config.mongoSanitize"', 'type_error');
      }
      return resolve({ ...baseOptions, ...route });
    };

    // Resolve at registration too, so a bad route config fails at startup instead of on a request
    fastify.addHook('onRoute', (routeOptions) => {
      resolveRoute(routeOptions.config);
    });

    // A route's config object is the same on every request, so resolve it once
    const routeCache = new WeakMap();
    const optionsFor = (request) => {
      const config = request.routeOptions?.config;
      if (!config) return opts;
      let resolved = routeCache.get(config);
      if (resolved === undefined) {
        resolved = resolveRoute(config);
        routeCache.set(config, resolved);
      }
      return resolved;
    };

    fastify.addHook(hook, (request, reply, done) => {
      if (shouldSkipRoute(request.url, opts.skipRoutes, forRequest(opts, request).debug)) {
        return done();
      }
      // onInjection: 'reject' and maxDepthBehavior: 'throw' throw; hand the error to Fastify
      try {
        const routeOpts = optionsFor(request);
        if (routeOpts) handleRequest(request, forRequest(routeOpts, request));
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
