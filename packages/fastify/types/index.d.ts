import { FastifyPluginCallback } from 'fastify';
import { SanitizeOptions, SanitizeEvent } from '@exortek/nosql-sanitize-core';

export { SanitizeOptions, SanitizeEvent };

declare module 'fastify' {
  interface FastifyRequest {
    sanitize?: (options?: Partial<SanitizeOptions>) => void;
  }
}

/**
 * Fastify plugin for NoSQL injection prevention.
 *
 * Default sanitizeObjects: ['body', 'params', 'query']
 */
declare const fastifyMongoSanitize: FastifyPluginCallback<SanitizeOptions>;

export default fastifyMongoSanitize;
export { fastifyMongoSanitize };
