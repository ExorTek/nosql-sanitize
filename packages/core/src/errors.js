'use strict';

class NoSQLSanitizeError extends Error {
  constructor(message, type = 'generic', statusCode) {
    super(message);
    this.name = 'NoSQLSanitizeError';
    this.type = type;
    // Read by Express and Fastify error handlers, so client errors answer 4xx instead of 500
    if (statusCode !== undefined) this.statusCode = statusCode;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  code() {
    return this.type;
  }
}

module.exports = { NoSQLSanitizeError };
