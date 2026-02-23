'use strict';

class NoSQLSanitizeError extends Error {
  constructor(message, type = 'generic') {
    super(message);
    this.name = 'NoSQLSanitizeError';
    this.type = type;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  code() {
    return this.type;
  }
}

module.exports = { NoSQLSanitizeError };
