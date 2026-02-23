'use strict';

const PATTERNS = Object.freeze([/\$/g, /[\u0000-\u001F\u007F-\u009F]/g]);

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

module.exports = { PATTERNS, LOG_LEVELS, LOG_COLORS, DEFAULT_OPTIONS };
