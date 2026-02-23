'use strict';

const { DEFAULT_OPTIONS, PATTERNS, LOG_LEVELS, LOG_COLORS } = require('./constants');
const { NoSQLSanitizeError } = require('./errors');
const { sanitizeString, sanitizeArray, sanitizeObject, sanitizeValue } = require('./sanitizers');
const helpers = require('./helpers');

/**
 * Resolves and validates configuration options by merging user-provided options
 * with default options and applying additional validations and transformations.
 * This function ensures that nested configuration objects are properly validated,
 * and prepares the resolved options for efficient runtime use.
 *
 * @param {Object} [userOptions={}] - The user-provided configuration options.
 * @throws {NoSQLSanitizeError} Throws an error if the provided options or nested
 * objects do not have the expected types.
 * @returns {Object} The fully resolved and validated options object, ready for use.
 */
const resolveOptions = (userOptions = {}) => {
  // Ensure the base options argument is a valid plain object to prevent prototype pollution or type errors
  if (!helpers.isPlainObject(userOptions)) {
    throw new NoSQLSanitizeError('Options must be an object', 'type_error');
  }

  // Validate nested object types before merge to avoid corrupting the configuration structure
  if (userOptions.debug !== undefined && !helpers.isPlainObject(userOptions.debug)) {
    throw new NoSQLSanitizeError('Invalid configuration: "debug"', 'type_error');
  }
  if (userOptions.stringOptions !== undefined && !helpers.isPlainObject(userOptions.stringOptions)) {
    throw new NoSQLSanitizeError('Invalid configuration: "stringOptions"', 'type_error');
  }
  if (userOptions.arrayOptions !== undefined && !helpers.isPlainObject(userOptions.arrayOptions)) {
    throw new NoSQLSanitizeError('Invalid configuration: "arrayOptions"', 'type_error');
  }

  // Deep merge default options with user-provided options safely
  const opts = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
    stringOptions: { ...DEFAULT_OPTIONS.stringOptions, ...(userOptions.stringOptions || {}) },
    arrayOptions: { ...DEFAULT_OPTIONS.arrayOptions, ...(userOptions.arrayOptions || {}) },
    debug: { ...DEFAULT_OPTIONS.debug, ...(userOptions.debug || {}) },
  };

  helpers.validateOptions(opts);

  // Pre-compile combined pattern (just once) for performance optimization during runtime
  const patterns = opts.patterns || PATTERNS;
  opts._combinedPattern = new RegExp(patterns.map((p) => p.source).join('|'), 'g');

  // Parse skipRoutes: Separate exact string matches (converted to a Set for O(1) lookup)
  // and RegExp patterns (kept in an array) for faster evaluation later
  const rawSkipRoutes = userOptions.skipRoutes || [];
  const exactSkipRoutes = new Set();
  const regexSkipRoutes = [];

  for (const route of rawSkipRoutes) {
    if (route instanceof RegExp) {
      regexSkipRoutes.push(route);
    } else if (helpers.isString(route)) {
      const cleaned = helpers.cleanUrl(route);
      if (cleaned) exactSkipRoutes.add(cleaned);
    }
  }

  opts.skipRoutes = { exact: exactSkipRoutes, regex: regexSkipRoutes };

  // Normalize contentTypes to a Set of lowercase strings for case-insensitive O(1) lookups.
  // A null value indicates that content-type checking should be bypassed entirely.
  const rawContentTypes =
    userOptions.contentTypes !== undefined ? userOptions.contentTypes : DEFAULT_OPTIONS.contentTypes;
  opts.contentTypes = rawContentTypes === null ? null : new Set(rawContentTypes.map((ct) => ct.toLowerCase()));

  // Convert allowed and denied keys to Sets for faster inclusion checks
  opts.allowedKeys = new Set(userOptions.allowedKeys || []);
  opts.deniedKeys = new Set(userOptions.deniedKeys || []);

  // Set max depth constraint for nested object parsing to prevent stack overflow/ReDoS attacks
  opts.maxDepth = userOptions.maxDepth !== undefined ? userOptions.maxDepth : null;

  // Assign the optional custom callback for post-sanitization hooks
  opts.onSanitize = userOptions.onSanitize || null;

  return opts;
};

/**
 * Determines whether a specified property on an object is writable.
 *
 * This function checks if the property on the given object or its prototype chain
 * has a descriptor indicating it is writable (either the `writable` attribute is true
 * or a `set` accessor exists). If the property cannot be found in the chain, it defaults to true.
 *
 * @param {Object} obj - The object to inspect.
 * @param {string} prop - The name of the property to check for writability.
 * @returns {boolean} Returns `true` if the property is writable or defaults to
 * writable when no descriptor is found; otherwise, `false`.
 */
const isWritable = (obj, prop) => {
  let cur = obj;
  // Traverse up the prototype chain to find the property descriptor
  while (cur) {
    const desc = Object.getOwnPropertyDescriptor(cur, prop);
    // If the descriptor is found, check if it allows assignment (writable or has a setter)
    if (desc) return !!desc.writable || !!desc.set;
    cur = Object.getPrototypeOf(cur);
  }
  // Default to true if no descriptor restricts it in the entire prototype chain
  return true;
};

/**
 * Determines whether a request's content type should be sanitized.
 *
 * @param {Object} request - The request object, which contains headers and may include a `get` method to retrieve headers.
 * @param {Array<string>} contentTypes - A set of allowed MIME types or null to sanitize all content types.
 * @returns {boolean} - Returns true if the content type should be sanitized, otherwise false.
 */
const shouldSanitizeContentType = (request, contentTypes) => {
  // If contentTypes is explicitly null, bypass the check and sanitize everything
  if (contentTypes === null) return true;

  // Safely extract the content-type header, supporting both standard Node.js req.headers
  // and Express.js req.get() method
  const header =
    (request.headers && request.headers['content-type']) ||
    (typeof request.get === 'function' && request.get('content-type')) ||
    null;

  // If there is no content-type header (e.g., simple GET requests), default to sanitizing
  if (!header) return true;

  // Extract the base MIME type (ignoring charsets/boundaries) and check against the allowed Set
  const mime = helpers.extractMimeType(header);
  return mime ? contentTypes.has(mime) : true;
};

/**
 * Handles the sanitization of a request object based on the provided options.
 *
 * This function processes specified fields within the request (`sanitizeObjects`)
 * and sanitizes their values using either a custom sanitizer or a default sanitizer.
 * It conditionally skips sanitization for the `body` field if its content type
 * is not included in the allowed list (`contentTypes`).
 *
 * @param {Object} request - The HTTP request object to be sanitized.
 * @param {Object} options - Configuration options for the sanitization process.
 * @param {Array.<string>} options.sanitizeObjects - List of request fields to be sanitized (e.g., `body`, `query`, `params`).
 * @param {Function} [options.customSanitizer] - Optional custom function to handle the sanitization of field values.
 * @param {boolean} [options.debug] - Flag to enable or disable debug logging.
 * @param {Array.<string>} [options.contentTypes] - Allowed content types that determine whether the `body` field is sanitized.
 */
const handleRequest = (request, options) => {
  const { sanitizeObjects, customSanitizer, debug, contentTypes } = options;
  const endTiming = helpers.startTiming(debug, 'Request Sanitization');

  helpers.log(debug, 'info', 'REQUEST', 'Sanitizing request');

  // Determine early on if the 'body' payload should be processed based on its MIME type
  const shouldSanitizeBody = shouldSanitizeContentType(request, contentTypes);

  for (const field of sanitizeObjects) {
    // Skip 'body' specifically if the content-type validation failed
    if (field === 'body' && !shouldSanitizeBody) {
      helpers.log(debug, 'debug', 'REQUEST', 'Skipping body — content-type not in allowed list');
      continue;
    }

    const data = request[field];

    // Skip processing if the payload field is undefined or null
    if (data == null) continue;

    // Avoid running expensive sanitization logic on completely empty objects
    if (helpers.isPlainObject(data) && helpers.isObjectEmpty(data)) continue;

    helpers.log(debug, 'debug', 'REQUEST', `Sanitizing '${field}'`);

    // Create a shallow clone of the data to avoid mutating references unexpectedly
    // before applying the sanitization logic
    const original = Array.isArray(data) ? [...data] : helpers.isPlainObject(data) ? { ...data } : data;

    // Route the data through a custom sanitizer if provided, otherwise use the internal one
    const sanitized = customSanitizer ? customSanitizer(original, options) : sanitizeValue(original, options);

    // Specific workaround for Express 5+: 'req.query' might be defined as non-writable via getter/setter.
    // If it's writable, do a standard assignment. If not, forcefully redefine the property.
    if (isWritable(request, field)) {
      request[field] = sanitized;
    } else {
      Object.defineProperty(request, field, {
        value: sanitized,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
  }

  endTiming();
};

/**
 * Determines whether a given route should be skipped based on exact matches or regex patterns.
 *
 * @param {string} requestPath - The request path to be evaluated.
 * @param {Object} skipRoutes - An object containing route skipping criteria.
 * @param {Set<string>} skipRoutes.exact - A set of exact route paths to skip.
 * @param {RegExp[]} skipRoutes.regex - An array of regular expressions to test against the route path.
 * @param {Object} [debug] - Optional debugging configuration.
 * @param {boolean} [debug.logSkippedRoutes] - Flag indicating whether skipped routes should be logged.
 * @returns {boolean} `true` if the route should be skipped, otherwise `false`.
 */
const shouldSkipRoute = (requestPath, skipRoutes, debug) => {
  const { exact, regex } = skipRoutes;

  // Quick return if there are no skip rules configured
  if (!exact.size && !regex.length) return false;

  const cleaned = helpers.cleanUrl(requestPath);

  // Check the exact matches first (O(1) Set lookup) for better performance
  if (cleaned && exact.has(cleaned)) {
    if (debug?.logSkippedRoutes) {
      helpers.log(debug, 'info', 'SKIP', `Route skipped (exact): ${requestPath}`);
    }
    return true;
  }

  // Fallback to iterating through RegExp patterns if no exact match is found
  if (regex.length && cleaned) {
    for (const pattern of regex) {
      // Reset lastIndex to 0 to prevent issues with global (/g) regular expressions maintaining state
      pattern.lastIndex = 0;
      if (pattern.test(cleaned)) {
        if (debug?.logSkippedRoutes) {
          helpers.log(debug, 'info', 'SKIP', `Route skipped (regex ${pattern}): ${requestPath}`);
        }
        return true;
      }
    }
  }

  return false;
};

module.exports = {
  resolveOptions,
  handleRequest,
  shouldSkipRoute,
  shouldSanitizeContentType,
  isWritable,

  sanitizeString,
  sanitizeArray,
  sanitizeObject,
  sanitizeValue,

  ...helpers,

  DEFAULT_OPTIONS,
  PATTERNS,
  LOG_LEVELS,
  LOG_COLORS,
  NoSQLSanitizeError,
};
