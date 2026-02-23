import { RequestHandler } from 'express';
import { SanitizeOptions, ResolvedOptions, SanitizeEvent } from '@exortek/nosql-sanitize-core';

export { SanitizeOptions, SanitizeEvent };

declare global {
  namespace Express {
    interface Request {
      sanitize?: (options?: Partial<SanitizeOptions>) => void;
    }
  }
}

/**
 * Express middleware factory for NoSQL injection prevention.
 */
declare function expressMongoSanitize(options?: SanitizeOptions): RequestHandler;

/**
 * Express route parameter sanitization handler.
 * Usage: app.param('id', paramSanitizeHandler())
 */
declare function paramSanitizeHandler(
  options?: SanitizeOptions,
): (req: Express.Request, res: Express.Response, next: Function, value: string, paramName: string) => void;

export default expressMongoSanitize;
export { expressMongoSanitize, paramSanitizeHandler };
