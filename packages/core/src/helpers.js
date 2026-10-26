'use strict';

const { LOG_LEVELS, LOG_COLORS } = require('./constants');
const { NoSQLSanitizeError } = require('./errors');

const isString = (value) => typeof value === 'string';
const isArray = (value) => Array.isArray(value);
const isBoolean = (value) => typeof value === 'boolean';
const isNumber = (value) => typeof value === 'number';
const isPrimitive = (value) => value === null || typeof value === 'boolean' || typeof value === 'number';
const isDate = (value) => value instanceof Date;
const isFunction = (value) => typeof value === 'function';

const isPlainObject = (obj) => {
  if (obj === null || typeof obj !== 'object' || isArray(obj) || obj instanceof Date || obj instanceof RegExp) {
    return false;
  }
  const proto = Object.getPrototypeOf(obj);
  if (proto === Object.prototype || proto === null) return true;
  // Fastify query objects: proto is a null-prototype object (2 levels deep)
  return Object.getPrototypeOf(proto) === null;
};

const isObjectEmpty = (obj) => {
  if (!isPlainObject(obj)) return false;
  for (const key in obj) {
    if (Object.hasOwn(obj, key)) return false;
  }
  return true;
};

// '' / null / undefined / {} / []: what removeEmpty: 'empty' drops (0 and false are kept)
const isEmptyValue = (val) => val === '' || val == null || (isArray(val) ? val.length === 0 : isObjectEmpty(val));

const EMAIL_RE = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/i;
const isEmail = (val) => isString(val) && val.length > 5 && val.indexOf('@') > 0 && EMAIL_RE.test(val);

const cleanUrl = (url) => {
  if (!isString(url) || url.length === 0) return null;

  // Strip query string and hash — indexOf faster than regex
  let end = url.length;
  const qIdx = url.indexOf('?');
  const hIdx = url.indexOf('#');
  if (qIdx !== -1 && qIdx < end) end = qIdx;
  if (hIdx !== -1 && hIdx < end) end = hIdx;

  // Trim leading/trailing slashes
  let start = 0;
  while (start < end && url.charCodeAt(start) === 47) start++;
  while (end > start && url.charCodeAt(end - 1) === 47) end--;

  if (start >= end) return null;
  return '/' + url.slice(start, end);
};

/**
 * Extracts the mime type from a content-type header value.
 * "application/json; charset=utf-8" → "application/json"
 */
const extractMimeType = (contentType) => {
  if (!isString(contentType)) return null;
  const idx = contentType.indexOf(';');
  const mime = (idx === -1 ? contentType : contentType.slice(0, idx)).trim().toLowerCase();
  return mime || null;
};

// Logging must never throw: circular structures and BigInts break JSON.stringify
const safeStringify = (data) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return '[unserializable]';
  }
};

const log = (debugOpts, level, context, message, data = null) => {
  if (!debugOpts?.enabled || LOG_LEVELS[debugOpts.level || 'silent'] < LOG_LEVELS[level]) return;

  const color = LOG_COLORS[level] || '';
  const reset = LOG_COLORS.reset;
  const timestamp = new Date().toISOString();
  const logMessage = `${color}[nosql-sanitize:${level.toUpperCase()}]${reset} ${timestamp} [${context}] ${message}`;

  if (data !== null && typeof data === 'object') {
    console.log(logMessage);
    console.log(`${color}Data:${reset}`, safeStringify(data));
  } else if (data !== null) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
};

const startTiming = (debugOpts, operation) => {
  if (!debugOpts?.enabled) return () => {};
  const start = process.hrtime();
  log(debugOpts, 'trace', 'TIMING', `Started: ${operation}`);
  return () => {
    const [s, ns] = process.hrtime(start);
    log(debugOpts, 'trace', 'TIMING', `Completed: ${operation} in ${(s * 1000 + ns / 1e6).toFixed(2)}ms`);
  };
};

const validators = Object.freeze({
  replaceWith: isString,
  removeMatches: isBoolean,
  sanitizeObjects: isArray,
  mode: (v) => ['auto', 'manual'].includes(v),
  skipRoutes: isArray,
  contentTypes: (v) => v === null || isArray(v),
  customSanitizer: (v) => v === null || isFunction(v),
  onSanitize: (v) => v === null || isFunction(v),
  recursive: isBoolean,
  removeEmpty: (v) => isBoolean(v) || v === 'falsy' || v === 'empty',
  // maxDepth:0 is now valid ("only top-level string sanitization").
  maxDepth: (v) => v === null || (isNumber(v) && v >= 0),
  dotKeys: (v) => ['allow', 'replace', 'remove'].includes(v),
  maxDepthBehavior: (v) => ['preserve', 'remove', 'throw'].includes(v),
  preserveEmails: isBoolean,
  allowPrototypeKeys: isBoolean,
  patterns: (v) => isArray(v) && v.length > 0 && v.every((p) => p instanceof RegExp),
  allowedKeys: (v) => v === null || isArray(v),
  allowedOperators: (v) =>
    v === null || (isArray(v) && v.every((op) => isString(op) && op.length > 1 && op[0] === '$')),
  deniedKeys: (v) => v === null || isArray(v),
  stringOptions: isPlainObject,
  arrayOptions: isPlainObject,
  debug: isPlainObject,
});

// Fields of the nested option objects. Unknown fields are ignored, as at the top level.
const nestedValidators = Object.freeze({
  stringOptions: {
    trim: isBoolean,
    lowercase: isBoolean,
    maxLength: (v) => v === null || (Number.isInteger(v) && v > 0),
  },
  arrayOptions: {
    filterNull: isBoolean,
    distinct: isBoolean,
  },
  debug: {
    enabled: isBoolean,
    level: (v) => Object.hasOwn(LOG_LEVELS, v),
    logPatternMatches: isBoolean,
    logSanitizedValues: isBoolean,
    logSkippedRoutes: isBoolean,
  },
});

const validateOptions = (options) => {
  for (const [key, validate] of Object.entries(validators)) {
    if (options[key] !== undefined && !validate(options[key])) {
      throw new NoSQLSanitizeError(`Invalid configuration: "${key}"`, 'type_error');
    }
  }
  for (const [key, fields] of Object.entries(nestedValidators)) {
    const nested = options[key];
    if (nested === undefined) continue;
    for (const [field, validate] of Object.entries(fields)) {
      if (nested[field] !== undefined && !validate(nested[field])) {
        throw new NoSQLSanitizeError(`Invalid configuration: "${key}.${field}"`, 'type_error');
      }
    }
  }
};

module.exports = {
  isString,
  isArray,
  isPlainObject,
  isBoolean,
  isNumber,
  isPrimitive,
  isDate,
  isFunction,
  isObjectEmpty,
  isEmptyValue,
  isEmail,
  cleanUrl,
  extractMimeType,
  log,
  startTiming,
  validateOptions,
};
