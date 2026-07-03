'use strict';

const { isString, isArray, isPlainObject, isPrimitive, isDate, isEmail, log } = require('./helpers');
const { NoSQLSanitizeError } = require('./errors');
const { DANGEROUS_KEYS } = require('./constants');

const REMOVE = Symbol('nosql-sanitize:remove');

const keyPath = (path, key) => (path ? `${path}.${key}` : `${key}`);

const sanitizeString = (str, options, isValue = false) => {
  if (!isString(str) || (options.preserveEmails && isEmail(str))) return str;

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

const sanitizeArray = (arr, options, depth, path = '') => {
  if (!isArray(arr)) throw new NoSQLSanitizeError('Input must be an array', 'type_error');

  const { recursive, arrayOptions, onSanitize } = options;
  const auditing = onSanitize != null;
  const len = arr.length;
  const result = new Array(len);
  let removed = 0;

  for (let i = 0; i < len; i++) {
    const item = arr[i];

    if (!recursive && (isPlainObject(item) || isArray(item))) {
      result[i] = item;
      continue;
    }

    if (isString(item)) {
      const s = sanitizeString(item, options, true);
      if (auditing && s !== item) {
        onSanitize({
          type: 'value',
          key: String(i),
          sanitizedKey: String(i),
          path: `${path}[${i}]`,
          originalValue: item,
          sanitizedValue: s,
        });
      }
      result[i] = s;
      continue;
    }

    const s = sanitizeValue(item, options, true, depth, auditing ? `${path}[${i}]` : '');
    if (s === REMOVE) {
      if (auditing) {
        onSanitize({
          type: 'removed',
          reason: 'maxDepth',
          key: String(i),
          path: `${path}[${i}]`,
          originalValue: item,
          sanitizedValue: undefined,
        });
      }
      result[i] = REMOVE;
      removed++;
      continue;
    }
    result[i] = s;
  }

  let out = result;
  if (removed) out = out.filter((x) => x !== REMOVE);
  if (arrayOptions.filterNull) out = out.filter(Boolean);
  if (arrayOptions.distinct) out = [...new Set(out)];
  return out;
};

const sanitizeObject = (obj, options, depth, path = '') => {
  if (!isPlainObject(obj)) throw new NoSQLSanitizeError('Input must be an object', 'type_error');

  const {
    removeEmpty,
    allowedKeys,
    deniedKeys,
    removeMatches,
    allowPrototypeKeys,
    preserveEmails,
    _combinedPattern,
    debug,
    recursive,
    onSanitize,
  } = options;
  const auditing = onSanitize != null;

  const acc = {};
  const keys = Object.keys(obj);

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    const val = obj[key];

    if (deniedKeys.size && deniedKeys.has(key)) {
      if (preserveEmails && isEmail(val)) {
        acc[sanitizeString(key, options)] = val;
        continue;
      }
      if (auditing)
        onSanitize({
          type: 'removed',
          reason: 'deniedKey',
          key,
          path: keyPath(path, key),
          originalValue: val,
          sanitizedValue: undefined,
        });
      log(debug, 'debug', 'OBJECT', `Key '${key}' denied`);
      continue;
    }

    if (allowedKeys.size && !allowedKeys.has(key)) {
      if (auditing)
        onSanitize({
          type: 'removed',
          reason: 'notAllowed',
          key,
          path: keyPath(path, key),
          originalValue: val,
          sanitizedValue: undefined,
        });
      log(debug, 'debug', 'OBJECT', `Key '${key}' not in allowedKeys`);
      continue;
    }

    const sanitizedKey = sanitizeString(key, options);

    // Prototype-pollution guard. Checking only the sanitized key is sufficient:
    // sanitizing never turns a dangerous key into a safe one, and a smuggled
    // "__pro\u0000to__" collapses to "__proto__" here.
    if (!allowPrototypeKeys && DANGEROUS_KEYS.has(sanitizedKey)) {
      if (auditing)
        onSanitize({
          type: 'removed',
          reason: 'prototypePollution',
          key,
          sanitizedKey,
          path: keyPath(path, key),
          originalValue: val,
          sanitizedValue: undefined,
        });
      log(debug, 'warn', 'OBJECT', `Dangerous key '${key}' removed (prototype pollution guard)`);
      continue;
    }

    if (removeMatches) {
      _combinedPattern.lastIndex = 0;
      if (_combinedPattern.test(key)) {
        if (auditing)
          onSanitize({
            type: 'removed',
            reason: 'removeMatches',
            key,
            path: keyPath(path, key),
            originalValue: val,
            sanitizedValue: undefined,
          });
        continue;
      }
    }

    if (removeEmpty && !sanitizedKey) {
      if (auditing)
        onSanitize({
          type: 'removed',
          reason: 'removeEmpty',
          key,
          path: keyPath(path, key),
          originalValue: val,
          sanitizedValue: undefined,
        });
      continue;
    }

    if (removeMatches && isString(val)) {
      _combinedPattern.lastIndex = 0;
      if (_combinedPattern.test(val)) {
        if (auditing)
          onSanitize({
            type: 'removed',
            reason: 'removeMatches',
            key,
            path: keyPath(path, key),
            originalValue: val,
            sanitizedValue: undefined,
          });
        continue;
      }
    }

    let sanitizedValue;
    let valueChanged = false;

    if (!recursive && (isPlainObject(val) || isArray(val))) {
      sanitizedValue = val;
    } else if (isString(val)) {
      sanitizedValue = sanitizeString(val, options, true);
      valueChanged = sanitizedValue !== val;
    } else {
      sanitizedValue = sanitizeValue(val, options, true, depth, auditing ? keyPath(path, sanitizedKey) : '');
    }

    if (sanitizedValue === REMOVE) {
      if (auditing)
        onSanitize({
          type: 'removed',
          reason: 'maxDepth',
          key,
          sanitizedKey,
          path: keyPath(path, sanitizedKey),
          originalValue: val,
          sanitizedValue: undefined,
        });
      continue;
    }

    if (removeEmpty && !sanitizedValue) {
      if (auditing)
        onSanitize({
          type: 'removed',
          reason: 'removeEmpty',
          key,
          sanitizedKey,
          path: keyPath(path, sanitizedKey),
          originalValue: val,
          sanitizedValue: undefined,
        });
      continue;
    }

    if (auditing) {
      const keyChanged = sanitizedKey !== key;
      if (keyChanged || valueChanged) {
        onSanitize({
          type: keyChanged && valueChanged ? 'both' : keyChanged ? 'key' : 'value',
          key,
          sanitizedKey,
          path: keyPath(path, sanitizedKey),
          originalValue: val,
          sanitizedValue,
        });
      }
    }

    acc[sanitizedKey] = sanitizedValue;
  }

  return acc;
};

const sanitizeValue = (value, options, isValue = false, depth = 0, path = '') => {
  if (value == null || isPrimitive(value) || isDate(value)) return value;
  if (isString(value)) return sanitizeString(value, options, isValue);

  if (options.maxDepth !== null && depth >= options.maxDepth) {
    switch (options.maxDepthBehavior) {
      case 'preserve':
        return value;
      case 'throw':
        throw new NoSQLSanitizeError(
          `Max sanitization depth (${options.maxDepth}) exceeded at "${path || '<root>'}"`,
          'max_depth',
        );
      case 'remove':
      default:
        return REMOVE;
    }
  }

  if (isArray(value)) return sanitizeArray(value, options, depth + 1, path);
  if (isPlainObject(value)) return sanitizeObject(value, options, depth + 1, path);
  return value;
};

module.exports = { sanitizeString, sanitizeArray, sanitizeObject, sanitizeValue, REMOVE };
