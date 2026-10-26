'use strict';

const { DEFAULT_OPTIONS, DANGEROUS_KEYS, PATTERNS, LOG_LEVELS, LOG_COLORS } = require('./constants');
const { NoSQLSanitizeError } = require('./errors');
const {
  sanitizeString,
  sanitizeArray,
  sanitizeObject,
  sanitizeValue,
  containsInjection,
  REMOVE,
} = require('./sanitizers');
const helpers = require('./helpers');

const NESTED_OPTIONS = Object.freeze(['stringOptions', 'arrayOptions', 'debug']);

// An option set to undefined means "use the default", same as leaving it out.
// Copies only when there is something to drop; the result is only ever spread, never kept.
const withoutUndefined = (obj) => {
  let out = obj;
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    if (obj[keys[i]] !== undefined) continue;
    if (out === obj) out = { ...obj };
    delete out[keys[i]];
  }
  return out;
};

const mergeNested = (key, nested) =>
  nested === undefined ? { ...DEFAULT_OPTIONS[key] } : { ...DEFAULT_OPTIONS[key], ...withoutUndefined(nested) };

/**
 * Resolves and validates configuration options by merging user-provided options
 * with default options and applying additional validations and transformations.
 * This function ensures that nested configuration objects are properly validated,
 * and prepares the resolved options for efficient runtime use.
 *
 * @param {Object} [rawOptions={}] - The user-provided configuration options.
 * @throws {NoSQLSanitizeError} Throws an error if the provided options or nested
 * objects do not have the expected types.
 * @returns {Object} The fully resolved and validated options object, ready for use.
 */
const resolveOptions = (rawOptions = {}) => {
  // Ensure the base options argument is a valid plain object to prevent prototype pollution or type errors
  if (!helpers.isPlainObject(rawOptions)) {
    throw new NoSQLSanitizeError('Options must be an object', 'type_error');
  }
  const userOptions = withoutUndefined(rawOptions);

  // Nested objects are checked before their merge: spreading a string or array into the
  // defaults would hide the mistake from validateOptions
  for (const key of NESTED_OPTIONS) {
    const nested = userOptions[key];
    if (nested !== undefined && !helpers.isPlainObject(nested)) {
      throw new NoSQLSanitizeError(`Invalid configuration: "${key}"`, 'type_error');
    }
  }

  const opts = {
    ...DEFAULT_OPTIONS,
    ...userOptions,
    sanitizeObjects: userOptions.sanitizeObjects || DEFAULT_OPTIONS.sanitizeObjects,
    stringOptions: mergeNested('stringOptions', userOptions.stringOptions),
    arrayOptions: mergeNested('arrayOptions', userOptions.arrayOptions),
    debug: mergeNested('debug', userOptions.debug),
  };

  helpers.validateOptions(opts);

  // Copied only after validation (spreading a string would split it into characters),
  // so callers can't mutate the frozen defaults or each other's options
  opts.sanitizeObjects = [...opts.sanitizeObjects];

  // Pre-compile combined pattern (just once) for performance optimization during runtime.
  // Flags of all patterns are merged (sticky dropped, global forced) so e.g. /where/i keeps matching WHERE.
  const { patterns } = opts;
  const flags = new Set(['g']);
  for (const p of patterns) for (const f of p.flags) if (f !== 'y') flags.add(f);
  try {
    opts._combinedPattern = new RegExp(patterns.map((p) => p.source).join('|'), [...flags].join(''));
  } catch (err) {
    throw new NoSQLSanitizeError(`Invalid configuration: "patterns" (${err.message})`, 'type_error');
  }

  // Parse skipRoutes: Separate exact string matches (converted to a Set for O(1) lookup)
  // and RegExp patterns (kept in an array) for faster evaluation later
  const exactSkipRoutes = new Set();
  const regexSkipRoutes = [];

  for (const route of opts.skipRoutes) {
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
  opts.contentTypes = opts.contentTypes === null ? null : new Set(opts.contentTypes.map((ct) => ct.toLowerCase()));

  // Convert allowed and denied keys to Sets for faster inclusion checks
  // (null is accepted for these lists and means "none")
  opts.allowedKeys = new Set(opts.allowedKeys || []);
  opts.allowedOperators = new Set(opts.allowedOperators || []);
  opts.deniedKeys = new Set(opts.deniedKeys || []);

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
  if (!mime || contentTypes.has(mime)) return true;

  // Structured syntax suffix (RFC 6839): application/vnd.api+json etc. are JSON too
  return mime.endsWith('+json') && contentTypes.has('application/json');
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
  // Gate all debug work on a single check so the hot path (debug off) pays
  // nothing — no timing closure allocation, no per-field template strings.
  const debugOn = debug?.enabled === true;
  const endTiming = debugOn ? helpers.startTiming(debug, 'Request Sanitization') : null;

  if (debugOn) helpers.log(debug, 'info', 'REQUEST', 'Sanitizing request');

  // Determine early on if the 'body' payload should be processed based on its MIME type
  const shouldSanitizeBody = shouldSanitizeContentType(request, contentTypes);

  for (const field of sanitizeObjects) {
    // Skip 'body' specifically if the content-type validation failed
    if (field === 'body' && !shouldSanitizeBody) {
      if (debugOn) helpers.log(debug, 'debug', 'REQUEST', 'Skipping body — content-type not in allowed list');
      continue;
    }

    const data = request[field];

    // Skip processing if the payload field is undefined or null
    if (data == null) continue;

    // Avoid running expensive sanitization logic on completely empty objects
    if (helpers.isPlainObject(data) && helpers.isObjectEmpty(data)) continue;

    if (debugOn) helpers.log(debug, 'debug', 'REQUEST', `Sanitizing '${field}'`);

    let sanitized;
    if (customSanitizer) {
      // A shallow clone protects the caller's original object from an external
      // sanitizer that might mutate its input in place.
      const input = Array.isArray(data) ? [...data] : helpers.isPlainObject(data) ? { ...data } : data;
      sanitized = customSanitizer(input, options);
    } else {
      // The built-in sanitizer always writes into a fresh object/array and never
      // mutates its input, so no top-level clone is needed here. The field name
      // seeds the onSanitize path (e.g. "body.user.$gt").
      sanitized = sanitizeValue(data, options, false, 0, field);
    }

    // Fail-closed guard: if the root itself was dropped (e.g. maxDepth: 0 with an
    // object/array body), emit an empty container instead of leaking raw input.
    if (sanitized === REMOVE) {
      sanitized = Array.isArray(data) ? [] : {};
    }

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

  if (endTiming) endTiming();
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

// sanitize() / hasInjection() take user options or resolved ones; user options are resolved
// once per object. Options objects are treated as immutable.
const resolvedCache = new WeakMap();
let defaultResolved = null;
const toResolved = (options) => {
  if (options === undefined) return (defaultResolved ??= resolveOptions());
  if (!helpers.isPlainObject(options)) return resolveOptions(options); // throws type_error
  if (options._combinedPattern instanceof RegExp) return options;
  let resolved = resolvedCache.get(options);
  if (!resolved) {
    resolved = resolveOptions(options);
    resolvedCache.set(options, resolved);
  }
  return resolved;
};

/**
 * Sanitizes any value outside a request (GraphQL args, WebSocket messages, queue payloads).
 * Uses the built-in sanitizer (`customSanitizer` is ignored) and never mutates `value`.
 *
 * @param {*} value - The value to sanitize.
 * @param {Object} [options] - User options or options from `resolveOptions()`.
 * @returns {*} The sanitized copy. An empty object/array if the root itself is dropped.
 */
const sanitize = (value, options) => {
  const sanitized = sanitizeValue(value, toResolved(options));
  return sanitized === REMOVE ? (Array.isArray(value) ? [] : {}) : sanitized;
};

/**
 * Reports whether sanitizing `value` would neutralize an injection, without changing it.
 *
 * @param {*} value - The value to check.
 * @param {Object} [options] - User options or options from `resolveOptions()`.
 * @returns {boolean} `true` if a key or string matches `patterns`, a prototype key is present,
 * or a dotted key is present while `dotKeys` isn't `'allow'`.
 */
const hasInjection = (value, options) => containsInjection(value, toResolved(options));

module.exports = {
  resolveOptions,
  sanitize,
  hasInjection,
  handleRequest,
  shouldSkipRoute,
  shouldSanitizeContentType,
  isWritable,

  sanitizeString,
  sanitizeArray,
  sanitizeObject,
  sanitizeValue,
  REMOVE,

  ...helpers,

  DANGEROUS_KEYS,
  DEFAULT_OPTIONS,
  PATTERNS,
  LOG_LEVELS,
  LOG_COLORS,
  NoSQLSanitizeError,
};
