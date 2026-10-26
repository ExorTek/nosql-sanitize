'use strict';

const { isString, isArray, isPlainObject, isPrimitive, isDate, isEmail, log } = require('./helpers');
const { NoSQLSanitizeError } = require('./errors');
const { DANGEROUS_KEYS, HARD_MAX_DEPTH } = require('./constants');

const REMOVE = Symbol('nosql-sanitize:remove');
// Internal sentinel for a reference back to an object currently being sanitized.
const CIRCULAR = Symbol('nosql-sanitize:circular');

// Containers on the current recursion path. Sanitization is synchronous, so one
// module-level stack is enough; entries are always popped on the way back up.
const ancestors = [];

const keyPath = (path, key) => (path ? `${path}.${key}` : `${key}`);

// Reports a dropped pair to onSanitize. sanitizedKey is only set once the key has been sanitized.
const emitRemoved = (onSanitize, reason, key, path, originalValue, sanitizedKey) => {
  const event = { type: 'removed', reason, key, path, originalValue, sanitizedValue: undefined };
  if (sanitizedKey !== undefined) event.sanitizedKey = sanitizedKey;
  onSanitize(event);
};

const sanitizeString = (str, options, isValue = false) => {
  if (!isString(str) || (options.preserveEmails && isEmail(str))) return str;

  const { replaceWith, stringOptions, debug, _combinedPattern } = options;
  const original = str;

  _combinedPattern.lastIndex = 0;
  // Function replacer: `replaceWith` is inserted literally, never expanded as $& / $1
  let result = str.replace(_combinedPattern, () => replaceWith);

  // stringOptions shape values only; keys keep their casing and whitespace
  if (isValue) {
    if (stringOptions.trim) result = result.trim();
    if (stringOptions.lowercase) result = result.toLowerCase();
    if (stringOptions.maxLength) result = result.slice(0, stringOptions.maxLength);
  }

  // Values may carry tokens or PII: only log them when explicitly asked to
  if (debug?.enabled && original !== result) {
    if (debug.logSanitizedValues) log(debug, 'debug', 'STRING', 'Sanitized', { original, result });
    else if (debug.logPatternMatches) log(debug, 'debug', 'STRING', 'Pattern matched');
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
    if (s === REMOVE || s === CIRCULAR) {
      if (auditing) emitRemoved(onSanitize, s === CIRCULAR ? 'circular' : 'maxDepth', String(i), `${path}[${i}]`, item);
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
    allowedOperators,
    deniedKeys,
    removeMatches,
    allowPrototypeKeys,
    preserveEmails,
    dotKeys,
    replaceWith,
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
      if (auditing) emitRemoved(onSanitize, 'deniedKey', key, keyPath(path, key), val);
      log(debug, 'debug', 'OBJECT', `Key '${key}' denied`);
      continue;
    }

    // Allowed operators skip the whitelist and key sanitization; their values are still sanitized
    const isOperator = allowedOperators.size !== 0 && allowedOperators.has(key);

    if (!isOperator && allowedKeys.size && !allowedKeys.has(key)) {
      if (auditing) emitRemoved(onSanitize, 'notAllowed', key, keyPath(path, key), val);
      log(debug, 'debug', 'OBJECT', `Key '${key}' not in allowedKeys`);
      continue;
    }

    let sanitizedKey = isOperator ? key : sanitizeString(key, options);

    // Before the prototype guard, so 'replace' can't assemble '__proto__' from '__pro.to__'
    if (dotKeys !== 'allow' && sanitizedKey.includes('.')) {
      if (dotKeys === 'remove') {
        if (auditing) emitRemoved(onSanitize, 'dotKey', key, keyPath(path, key), val, sanitizedKey);
        continue;
      }
      sanitizedKey = sanitizedKey.replaceAll('.', () => replaceWith);
    }

    if (!allowPrototypeKeys && DANGEROUS_KEYS.has(sanitizedKey)) {
      if (auditing) emitRemoved(onSanitize, 'prototypePollution', key, keyPath(path, key), val, sanitizedKey);
      log(debug, 'warn', 'OBJECT', `Dangerous key '${key}' removed (prototype pollution guard)`);
      continue;
    }

    if (removeMatches && !isOperator) {
      _combinedPattern.lastIndex = 0;
      if (_combinedPattern.test(key)) {
        if (auditing) emitRemoved(onSanitize, 'removeMatches', key, keyPath(path, key), val);
        continue;
      }
    }

    if (removeEmpty && !sanitizedKey) {
      if (auditing) emitRemoved(onSanitize, 'removeEmpty', key, keyPath(path, key), val);
      continue;
    }

    if (removeMatches && isString(val)) {
      _combinedPattern.lastIndex = 0;
      if (_combinedPattern.test(val)) {
        if (auditing) emitRemoved(onSanitize, 'removeMatches', key, keyPath(path, key), val);
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

    if (sanitizedValue === REMOVE || sanitizedValue === CIRCULAR) {
      if (auditing)
        emitRemoved(
          onSanitize,
          sanitizedValue === CIRCULAR ? 'circular' : 'maxDepth',
          key,
          keyPath(path, sanitizedKey),
          val,
          sanitizedKey,
        );
      continue;
    }

    if (removeEmpty && !sanitizedValue) {
      if (auditing) emitRemoved(onSanitize, 'removeEmpty', key, keyPath(path, sanitizedKey), val, sanitizedKey);
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

    if (DANGEROUS_KEYS.has(sanitizedKey)) {
      // Only reachable with allowPrototypeKeys: plain assignment to __proto__ would swap acc's prototype
      Object.defineProperty(acc, sanitizedKey, {
        value: sanitizedValue,
        enumerable: true,
        writable: true,
        configurable: true,
      });
    } else {
      acc[sanitizedKey] = sanitizedValue;
    }
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

  if (options.maxDepth === null && depth >= HARD_MAX_DEPTH) {
    throw new NoSQLSanitizeError(
      `Max sanitization depth (${HARD_MAX_DEPTH}) exceeded at "${path || '<root>'}"; set maxDepth to control this`,
      'max_depth',
    );
  }

  const array = isArray(value);
  if (!array && !isPlainObject(value)) return value;

  // Cut cycles (e.g. @fastify/multipart field objects point back at the body)
  if (ancestors.includes(value)) return CIRCULAR;
  ancestors.push(value);
  try {
    return array ? sanitizeArray(value, options, depth + 1, path) : sanitizeObject(value, options, depth + 1, path);
  } finally {
    ancestors.pop();
  }
};

module.exports = { sanitizeString, sanitizeArray, sanitizeObject, sanitizeValue, REMOVE };
