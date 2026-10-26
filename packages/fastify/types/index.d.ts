/// <reference types="node" />

import { FastifyPluginCallback, FastifyRequest } from 'fastify';
import { SanitizeOptions, ResolvedOptions, SanitizeEvent, DebugOptions, Logger } from '@exortek/nosql-sanitize-core';

declare module 'fastify' {
  interface FastifyRequest {
    /**
     * Available when `mode: 'manual'`.
     * Call to sanitize `request.body`, `request.params`, and/or `request.query`.
     * Optionally pass overrides for this specific call.
     */
    sanitize?: (options?: fastifyMongoSanitize.FastifyRouteSanitizeOptions) => void;
  }

  interface FastifyContextConfig {
    /**
     * Route-level override (auto mode). `false` turns sanitization off for this route;
     * an options object is merged over the plugin options for this route.
     */
    mongoSanitize?: boolean | fastifyMongoSanitize.FastifyRouteSanitizeOptions;
  }
}

type FastifyMongoSanitize = FastifyPluginCallback<fastifyMongoSanitize.FastifyMongoSanitizeOptions>;

declare namespace fastifyMongoSanitize {
  export { SanitizeOptions, ResolvedOptions, SanitizeEvent, Logger };

  export interface FastifyDebugOptions extends Omit<DebugOptions, 'logger'> {
    /**
     * Where log messages go. `'request'` logs through `request.log` (with the request id),
     * and through `fastify.log` outside a request. `null` writes with `console.log`.
     * When unset and Fastify's logger is disabled, `console.log` is used.
     * @default 'request'
     */
    logger?: Logger | 'request' | null;
  }

  /**
   * Fastify-specific options (extends SanitizeOptions).
   * Default `sanitizeObjects`: `['body', 'params', 'query']`
   * (includes `params`, unlike Express).
   */
  export interface FastifyMongoSanitizeOptions extends Omit<SanitizeOptions, 'debug'> {
    /**
     * Request fields to sanitize.
     * @default ['body', 'params', 'query']
     */
    sanitizeObjects?: string[];
    /**
     * Hook that runs the sanitizer in auto mode. `'preValidation'` sanitizes before
     * schema validation, so the schema checks the sanitized data. `'preHandler'`
     * runs after validation, so the schema sees the raw input (v3 default).
     * @default 'preValidation'
     */
    hook?: 'preHandler' | 'preValidation';
    /** Debug logging configuration. */
    debug?: FastifyDebugOptions;
  }

  /** Options for `config.mongoSanitize` and `request.sanitize()`. */
  export type FastifyRouteSanitizeOptions = Omit<FastifyMongoSanitizeOptions, 'hook'>;

  /**
   * Fastify plugin for NoSQL injection prevention.
   * Wrapped with `fastify-plugin` — no encapsulation.
   *
   * Uses the `preValidation` hook in auto mode (see `hook`).
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
