/// <reference types="node" />

import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { SanitizeOptions, ResolvedOptions, SanitizeEvent } from '@exortek/nosql-sanitize-core';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Available when `mode: 'manual'`.
     * Call to sanitize `request.body`, `request.params`, and/or `request.query`.
     * Optionally pass overrides for this specific call.
     */
    sanitize?: (options?: fastifyMongoSanitize.SanitizeOptions) => void;
  }
}

type FastifyMongoSanitize = FastifyPluginCallback<fastifyMongoSanitize.FastifyMongoSanitizeOptions>;

declare namespace fastifyMongoSanitize {
  export { SanitizeOptions, ResolvedOptions, SanitizeEvent };

  /**
   * Fastify-specific options (extends SanitizeOptions).
   * Default `sanitizeObjects`: `['body', 'params', 'query']`
   * (includes `params`, unlike Express).
   */
  export interface FastifyMongoSanitizeOptions extends SanitizeOptions {
    /**
     * Request fields to sanitize.
     * @default ['body', 'params', 'query']
     */
    sanitizeObjects?: string[];
  }

  /**
   * Fastify plugin for NoSQL injection prevention.
   * Wrapped with `fastify-plugin` — no encapsulation.
   *
   * Uses `preHandler` hook in auto mode.
   *
   * @example
   * ```js
   * const mongoSanitize = require('@exortek/fastify-mongo-sanitize');
   * fastify.register(mongoSanitize);
   * fastify.register(mongoSanitize, { mode: 'manual', maxDepth: 5 });
   * ```
   */
  export const fastifyMongoSanitize: FastifyMongoSanitize;
  export { fastifyMongoSanitize as default };
}

declare function fastifyMongoSanitize(...params: Parameters<FastifyMongoSanitize>): ReturnType<FastifyMongoSanitize>;

export = fastifyMongoSanitize;
