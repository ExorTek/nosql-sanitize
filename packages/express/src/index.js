'use strict';

const {
  resolveOptions,
  handleRequest,
  shouldSkipRoute,
  sanitizeString,
  cleanUrl,
  log,
  isString,
  NoSQLSanitizeError,
} = require('@exortek/nosql-sanitize-core');

/**
 * Express middleware factory.
 * @param {Object} [options={}]
 * @returns {Function} Express middleware
 */
const expressMongoSanitize = (options = {}) => {
  const opts = resolveOptions(options);

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

  return function (req, res, next, value, paramName) {
    const key = paramName || this?.name;
    if (key && req.params && isString(value)) {
      req.params[key] = sanitizeString(value, opts, true);
    }
    next();
  };
};

module.exports = expressMongoSanitize;
module.exports.default = expressMongoSanitize;
module.exports.expressMongoSanitize = expressMongoSanitize;
module.exports.paramSanitizeHandler = paramSanitizeHandler;
