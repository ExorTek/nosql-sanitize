'use strict';

const PATTERNS = Object.freeze([/\$/g, /[\u0000-\u001F\u007F-\u009F]/g]);

/**
 * Keys that enable prototype-pollution when assigned onto a plain object.
 * These are dropped by default (see `allowPrototypeKeys` to opt out).
 */
const DANGEROUS_KEYS = Object.freeze(new Set(['__proto__', 'constructor', 'prototype']));

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

const DEFAULT_OPTIONS = Object.freeze({
  replaceWith: '',
  removeMatches: false,
  sanitizeObjects: ['body', 'query'],
  contentTypes: ['application/json', 'application/x-www-form-urlencoded'],
  mode: 'auto',
  skipRoutes: [],
  customSanitizer: null,
  onSanitize: null,
  recursive: true,
  removeEmpty: false,
  maxDepth: null,
  // What to do with values nested deeper than `maxDepth`.
  //   'preserve' → return the value UNSANITIZED (v2 compatible, default)
  //   'remove'   → drop the over-depth value (fail-closed, recommended)
  //   'throw'    → throw NoSQLSanitizeError
  maxDepthBehavior: 'preserve',
  // Email-looking values are exempt from sanitization when true.
  // NOTE: this exemption also bypasses any custom `patterns`. Set to false
  // if you supply custom patterns that must apply to email values too.
  preserveEmails: true,
  // When false (default), keys in DANGEROUS_KEYS are stripped to block
  // prototype pollution. Set true only if you fully trust the input.
  allowPrototypeKeys: false,
  patterns: PATTERNS,
  allowedKeys: [],
  deniedKeys: [],
  stringOptions: {
    trim: false,
    lowercase: false,
    maxLength: null,
  },
  arrayOptions: {
    filterNull: false,
    distinct: false,
  },
  debug: {
    enabled: false,
    level: 'info',
    logPatternMatches: false,
    logSanitizedValues: false,
    logSkippedRoutes: false,
  },
});

module.exports = { PATTERNS, DANGEROUS_KEYS, LOG_LEVELS, LOG_COLORS, DEFAULT_OPTIONS };
