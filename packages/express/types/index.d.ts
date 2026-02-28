/// <reference types="node" />

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { SanitizeOptions, ResolvedOptions, SanitizeEvent } from '@exortek/nosql-sanitize-core';

declare module 'express' {
  interface Request {
    /**
     * Available when `mode: 'manual'`.
     * Call to sanitize `req.body`, `req.query`, and/or `req.params`.
     * Optionally pass overrides for this specific call.
     */
    sanitize?: (options?: expressMongoSanitize.SanitizeOptions) => void;
  }
}

type ExpressMongoSanitize = (options?: expressMongoSanitize.SanitizeOptions) => RequestHandler;

declare namespace expressMongoSanitize {
  export { SanitizeOptions, ResolvedOptions, SanitizeEvent };

  /**
   * Express middleware factory for NoSQL injection prevention.
   *
   * Sanitizes `req.body` and `req.query` by default.
   * Supports `mode: 'auto'` (default) and `mode: 'manual'`.
   *
   * @example
   * ```js
   * const mongoSanitize = require('@exortek/express-mongo-sanitize');
   * app.use(mongoSanitize());
   * ```
   */
  export const expressMongoSanitize: ExpressMongoSanitize;

  /**
   * Express route parameter sanitization handler.
   *
   * @example
   * ```js
   * const { paramSanitizeHandler } = require('@exortek/express-mongo-sanitize');
   * app.param('userId', paramSanitizeHandler());
   * app.param('slug', paramSanitizeHandler({ replaceWith: '_' }));
   * ```
   */
  export function paramSanitizeHandler(
    options?: SanitizeOptions,
  ): (req: Request, res: Response, next: NextFunction, value: string, paramName: string) => void;

  export { expressMongoSanitize as default };
}

declare function expressMongoSanitize(...params: Parameters<ExpressMongoSanitize>): ReturnType<ExpressMongoSanitize>;

export = expressMongoSanitize;
