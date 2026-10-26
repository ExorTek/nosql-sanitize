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

  interface FastifyContextConfig {
    /**
     * Route-level override (auto mode). `false` turns sanitization off for this route;
     * an options object is merged over the plugin options for this route.
     */
    mongoSanitize?: boolean | fastifyMongoSanitize.SanitizeOptions;
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
    /**
     * Hook that runs the sanitizer in auto mode. `'preValidation'` sanitizes before
     * schema validation, so the schema checks the sanitized data.
     * @default 'preHandler'
     */
    hook?: 'preHandler' | 'preValidation';
  }

  /**
   * Fastify plugin for NoSQL injection prevention.
   * Wrapped with `fastify-plugin` — no encapsulation.
   *
   * Uses the `preHandler` hook in auto mode (see `hook`).
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
