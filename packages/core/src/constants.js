'use strict';

const PATTERNS = Object.freeze([/\$/g, /[\u0000-\u001F\u007F-\u009F]/g]);

/**
 * Keys that enable prototype-pollution when assigned onto a plain object.
 * These are dropped by default (see `allowPrototypeKeys` to opt out).
 */
const DANGEROUS_KEYS = Object.freeze(new Set(['__proto__', 'constructor', 'prototype']));

/**
 * Internal recursion ceiling used when `maxDepth` is null (unlimited). Keeps a
 * hostile, deeply nested payload from overflowing the stack with a raw RangeError.
 */
const HARD_MAX_DEPTH = 256;

const LOG_LEVELS = Object.freeze({
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
});

const LOG_COLORS = Object.freeze({
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  trace: '\x1b[35m',
  reset: '\x1b[0m',
});

// Freezes nested plain objects and arrays. RegExps are left alone: freezing one
// makes `lastIndex` read-only and breaks global-flag matching.
const deepFreeze = (obj) => {
  for (const value of Object.values(obj)) {
    if (value !== null && typeof value === 'object' && !(value instanceof RegExp)) deepFreeze(value);
  }
  return Object.freeze(obj);
};

const DEFAULT_OPTIONS = deepFreeze({
  replaceWith: '',
  removeMatches: false,
  sanitizeObjects: ['body', 'query'],
  contentTypes: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
  mode: 'auto',
  skipRoutes: [],
  customSanitizer: null,
  // What handleRequest does when a request contains an injection:
  //   'sanitize' → strip it (default)
  //   'reject'   → throw NoSQLSanitizeError('injection_detected') with statusCode 400
  //   'report'   → only report changes through onSanitize; the request is left untouched
  onInjection: 'sanitize',
  onSanitize: null,
  recursive: true,
  // true / 'falsy' → drop falsy values ('', null, undefined, 0, false)
  // 'empty'        → drop '', null, undefined, {} and [] only
  removeEmpty: false,
  // null → no limit below the HARD_MAX_DEPTH ceiling
  maxDepth: 32,
  // What to do with values nested deeper than `maxDepth`.
  //   'preserve' → return the value UNSANITIZED (v3 default, fail-open)
  //   'remove'   → drop the over-depth value (fail-closed, default)
  //   'throw'    → throw NoSQLSanitizeError
  maxDepthBehavior: 'remove',
  // Email-looking values are exempt from sanitization when true.
  // NOTE: this exemption also bypasses any custom `patterns`. Set to false
  // if you supply custom patterns that must apply to email values too.
  preserveEmails: true,
  // When false (default), keys in DANGEROUS_KEYS are stripped to block
  // prototype pollution. Set true only if you fully trust the input.
  allowPrototypeKeys: false,
  patterns: PATTERNS,
  allowedKeys: [],
  // `$`-keys kept verbatim at every depth (e.g. ['$set'] for an admin update API).
  // Their values are still sanitized.
  allowedOperators: [],
  // Keys containing '.' (e.g. 'profile.isAdmin', dangerous when spread into $set).
  //   'allow'   → keep as-is (default)
  //   'replace' → replace each '.' with `replaceWith`
  //   'remove'  → drop the key-value pair
  dotKeys: 'allow',
  deniedKeys: [],
  stringOptions: {
    trim: false,
    lowercase: false,
    maxLength: null,
  },
  arrayOptions: {
    // true / 'falsy' → drop falsy items; 'nullish' → drop null and undefined only
    filterNull: false,
    distinct: false,
  },
  debug: {
    enabled: false,
    level: 'info',
    logPatternMatches: false,
    logSanitizedValues: false,
    logSkippedRoutes: false,
    // Object with error/warn/info/debug/trace methods (pino, fastify.log, console…); null → console.log
    logger: null,
  },
});

module.exports = { PATTERNS, DANGEROUS_KEYS, HARD_MAX_DEPTH, LOG_LEVELS, LOG_COLORS, DEFAULT_OPTIONS };
