'use strict';

const {
  resolveOptions,
  handleRequest,
  shouldSkipRoute,
  sanitizeString,
  log,
  isString,
} = require('@exortek/nosql-sanitize-core');

/**
 * Express middleware factory.
 * @param {Object} [options={}]
 * @returns {Function} Express middleware
 */
const expressMongoSanitize = (options = {}) => {
  const opts = resolveOptions(options);

  log(opts.debug, 'info', 'PLUGIN', 'Initializing nosql-sanitize plugin', {
    mode: opts.mode,
    sanitizeObjects: opts.sanitizeObjects,
  });
  log(opts.debug, 'info', 'PLUGIN', 'Plugin initialized');

  // req.sanitize(customOpts) runs per request, so resolve each options object only once.
  // Options objects are treated as immutable: pass a new object to change them.
  const customCache = new WeakMap();
  const resolveCustom = (customOpts) => {
    if (typeof customOpts !== 'object') return resolveOptions({ ...options, ...customOpts });
    let resolved = customCache.get(customOpts);
    if (!resolved) {
      resolved = resolveOptions({ ...options, ...customOpts });
      customCache.set(customOpts, resolved);
    }
    return resolved;
  };

  return (req, res, next) => {
    const requestPath = req.path || req.url;

    if (shouldSkipRoute(requestPath, opts.skipRoutes, opts.debug)) {
      return next();
    }

    if (opts.mode === 'auto') {
      handleRequest(req, opts);
    }

    if (opts.mode === 'manual') {
      req.sanitize = (customOpts) => {
        const finalOpts = customOpts ? resolveCustom(customOpts) : opts;
        handleRequest(req, finalOpts);
      };
    }

    next();
  };
};

/**
 * Route parameter sanitization handler.
 * @param {Object} [options={}]
 * @returns {Function} Express param handler
 */
const paramSanitizeHandler = (options = {}) => {
  const opts = resolveOptions(options);
  log(opts.debug, 'info', 'PLUGIN', 'Initializing nosql-sanitize param handler', {
    mode: opts.mode,
    sanitizeObjects: opts.sanitizeObjects,
  });

  return function (req, res, next, value, paramName) {
    const key = paramName || this?.name;
    if (key && req.params && isString(value)) {
      const sanitized = sanitizeString(value, opts, true);
      req.params[key] = sanitized;
      // Raw param values (ids, tokens) are only logged with logSanitizedValues
      log(
        opts.debug,
        'info',
        'PLUGIN',
        'Param sanitized',
        opts.debug.logSanitizedValues ? { key, original: value, result: sanitized } : { key },
      );
    }
    next();
  };
};

module.exports = expressMongoSanitize;
module.exports.default = expressMongoSanitize;
module.exports.expressMongoSanitize = expressMongoSanitize;
module.exports.paramSanitizeHandler = paramSanitizeHandler;
