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
    sanitizeObjects: [...opts.sanitizeObjects] || opts.sanitizeObjects,
  });

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
        const finalOpts = customOpts ? resolveOptions({ ...options, ...customOpts }) : opts;
        handleRequest(req, finalOpts);
      };
    }

    log(opts.debug, 'info', 'PLUGIN', 'Plugin initialized');
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
    sanitizeObjects: [...opts.sanitizeObjects] || opts.sanitizeObjects,
  });

  return function (req, res, next, value, paramName) {
    const key = paramName || this?.name;
    if (key && req.params && isString(value)) {
      req.params[key] = sanitizeString(value, opts, true);
    }
    log(opts.debug, 'info', 'PLUGIN', 'Param sanitized', { key, value });
    next();
  };
};

module.exports = expressMongoSanitize;
module.exports.default = expressMongoSanitize;
module.exports.expressMongoSanitize = expressMongoSanitize;
module.exports.paramSanitizeHandler = paramSanitizeHandler;
