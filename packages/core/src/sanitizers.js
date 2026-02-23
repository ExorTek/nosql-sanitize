'use strict';

const { isString, isArray, isPlainObject, isPrimitive, isDate, isEmail, log } = require('./helpers');
const { NoSQLSanitizeError } = require('./errors');

/**
 * Sanitizes a string value.
 */
const sanitizeString = (str, options, isValue = false) => {
  if (!isString(str) || isEmail(str)) return str;

  const { replaceWith, stringOptions, debug, _combinedPattern } = options;
  const original = str;

  _combinedPattern.lastIndex = 0;
  let result = str.replace(_combinedPattern, replaceWith);

  if (stringOptions.trim) result = result.trim();
  if (stringOptions.lowercase) result = result.toLowerCase();
  if (stringOptions.maxLength && isValue) result = result.slice(0, stringOptions.maxLength);

  if (debug?.enabled && original !== result) {
    log(debug, 'debug', 'STRING', 'Sanitized', { original, result });
  }

  return result;
};

/**
 * Sanitizes an array.
 */
const sanitizeArray = (arr, options, depth) => {
  if (!isArray(arr)) {
    throw new NoSQLSanitizeError('Input must be an array', 'type_error');
  }

  const { recursive, arrayOptions } = options;
  const len = arr.length;
  const result = new Array(len);

  for (let i = 0; i < len; i++) {
    const item = arr[i];
    if (!recursive && (isPlainObject(item) || isArray(item))) {
      result[i] = item;
    } else {
      result[i] = sanitizeValue(item, options, true, depth);
    }
  }

  if (!arrayOptions.filterNull && !arrayOptions.distinct) return result;

  let out = result;
  if (arrayOptions.filterNull) out = out.filter(Boolean);
  if (arrayOptions.distinct) out = [...new Set(out)];
  return out;
};

/**
 * Sanitizes an object. Uses for..of Object.keys() — no tuple allocation.
 */
const sanitizeObject = (obj, options, depth) => {
  if (!isPlainObject(obj)) {
    throw new NoSQLSanitizeError('Input must be an object', 'type_error');
  }

  const { removeEmpty, allowedKeys, deniedKeys, removeMatches, _combinedPattern, debug, recursive, onSanitize } =
    options;

  const acc = {};
  const keys = Object.keys(obj);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = obj[key];

    // Denied key — email value korunur (BUG-03 fix)
    if (deniedKeys.size && deniedKeys.has(key)) {
      if (isEmail(val)) {
        acc[sanitizeString(key, options)] = val;
        continue;
      }
      log(debug, 'debug', 'OBJECT', `Key '${key}' denied`);
      continue;
    }

    // Allowed key filtresi
    if (allowedKeys.size && !allowedKeys.has(key)) {
      log(debug, 'debug', 'OBJECT', `Key '${key}' not in allowedKeys`);
      continue;
    }

    const sanitizedKey = sanitizeString(key, options);

    // removeMatches — tek _combinedPattern.test()
    if (removeMatches) {
      _combinedPattern.lastIndex = 0;
      if (_combinedPattern.test(key)) continue;
    }

    if (removeEmpty && !sanitizedKey) continue;

    // removeMatches — value pattern match
    if (removeMatches && isString(val)) {
      _combinedPattern.lastIndex = 0;
      if (_combinedPattern.test(val)) continue;
    }

    const sanitizedValue =
      !recursive && (isPlainObject(val) || isArray(val)) ? val : sanitizeValue(val, options, true, depth);

    if (removeEmpty && !sanitizedValue) continue;

    // onSanitize callback
    if (onSanitize && isString(val) && val !== sanitizedValue) {
      onSanitize({ key, originalValue: val, sanitizedValue, path: key });
    }

    acc[sanitizedKey] = sanitizedValue;
  }

  return acc;
};

/**
 * Main dispatch — routes to appropriate sanitizer by type.
 * @param {*} value
 * @param {Object} options
 * @param {boolean} isValue - true if this is a value (not a key)
 * @param {number} depth - current recursion depth
 */
const sanitizeValue = (value, options, isValue = false, depth = 0) => {
  if (value == null || isPrimitive(value) || isDate(value)) return value;

  // Strings are always sanitized regardless of depth
  if (isString(value)) return sanitizeString(value, options, isValue);

  // maxDepth guard — stop recursing into nested objects/arrays
  if (options.maxDepth !== null && depth >= options.maxDepth) return value;

  if (isArray(value)) return sanitizeArray(value, options, depth + 1);
  if (isPlainObject(value)) return sanitizeObject(value, options, depth + 1);
  return value;
};

module.exports = { sanitizeString, sanitizeArray, sanitizeObject, sanitizeValue };
