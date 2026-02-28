/// <reference types="node" />

type NoSQLSanitizeCore = typeof noSQLSanitizeCore;

declare namespace noSQLSanitizeCore {
  export interface StringOptions {
    /** Trim leading/trailing whitespace. @default false */
    trim?: boolean;
    /** Convert to lowercase. @default false */
    lowercase?: boolean;
    /** Truncate strings exceeding this length. @default null */
    maxLength?: number | null;
  }

  export interface ArrayOptions {
    /** Remove falsy values from arrays. @default false */
    filterNull?: boolean;
    /** Remove duplicate values from arrays. @default false */
    distinct?: boolean;
  }

  export interface DebugOptions {
    /** Enable debug logging. @default false */
    enabled?: boolean;
    /** Log level threshold. @default 'info' */
    level?: 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    /** Log regex pattern matches. @default false */
    logPatternMatches?: boolean;
    /** Log sanitized values (before/after). @default false */
    logSanitizedValues?: boolean;
    /** Log when routes are skipped. @default false */
    logSkippedRoutes?: boolean;
  }

  /**
   * Event emitted by the `onSanitize` callback when a value is changed.
   */
  export interface SanitizeEvent {
    /** The object key that was sanitized. */
    key: string;
    /** The original value before sanitization. */
    originalValue: string;
    /** The value after sanitization. */
    sanitizedValue: string;
    /** Path to the sanitized key (currently same as `key`). */
    path: string;
  }

  /**
   * User-facing options passed to `resolveOptions()`,
   * Express middleware, or Fastify plugin.
   */
  export interface SanitizeOptions {
    /** String to replace matched patterns with. @default '' */
    replaceWith?: string;
    /** Remove entire key-value pair if a pattern matches. @default false */
    removeMatches?: boolean;
    /** Request fields to sanitize. @default ['body', 'query'] */
    sanitizeObjects?: string[];
    /**
     * Only sanitize request body for these content types.
     * Set to `null` to sanitize all content types.
     * Query/params are always sanitized regardless.
     * @default ['application/json', 'application/x-www-form-urlencoded']
     */
    contentTypes?: string[] | null;
    /** Sanitization mode. @default 'auto' */
    mode?: 'auto' | 'manual';
    /**
     * Routes to skip. Supports exact strings (O(1) Set lookup)
     * and RegExp patterns.
     * @default []
     */
    skipRoutes?: (string | RegExp)[];
    /** Custom sanitizer function. Overrides default sanitization. @default null */
    customSanitizer?: ((data: any, options: ResolvedOptions) => any) | null;
    /**
     * Callback fired when a value is sanitized. Only fires when the value changes.
     * @default null
     */
    onSanitize?: ((event: SanitizeEvent) => void) | null;
    /** Recursively sanitize nested objects/arrays. @default true */
    recursive?: boolean;
    /** Remove falsy values after sanitization. @default false */
    removeEmpty?: boolean;
    /**
     * Maximum recursion depth for nested objects.
     * Strings are always sanitized regardless of depth.
     * `null` = unlimited.
     * @default null
     */
    maxDepth?: number | null;
    /** Regex patterns to match and replace. @default [/\$/g, /control chars/g] */
    patterns?: RegExp[];
    /** Only allow these keys (empty = allow all). @default [] */
    allowedKeys?: string[];
    /** Remove these keys (empty = deny none). @default [] */
    deniedKeys?: string[];
    /** String transform options. */
    stringOptions?: StringOptions;
    /** Array transform options. */
    arrayOptions?: ArrayOptions;
    /** Debug logging configuration. */
    debug?: DebugOptions;
  }

  /**
   * Pre-compiled skip routes split into exact (Set) and regex (Array).
   */
  export interface ResolvedSkipRoutes {
    exact: Set<string>;
    regex: RegExp[];
  }

  /**
   * Options after `resolveOptions()` processing.
   * Patterns are compiled, Sets are built, defaults are merged.
   */
  export interface ResolvedOptions {
    replaceWith: string;
    removeMatches: boolean;
    sanitizeObjects: string[];
    contentTypes: Set<string> | null;
    mode: 'auto' | 'manual';
    skipRoutes: ResolvedSkipRoutes;
    customSanitizer: ((data: any, options: ResolvedOptions) => any) | null;
    onSanitize: ((event: SanitizeEvent) => void) | null;
    recursive: boolean;
    removeEmpty: boolean;
    maxDepth: number | null;
    patterns: RegExp[];
    allowedKeys: Set<string>;
    deniedKeys: Set<string>;
    stringOptions: Required<StringOptions>;
    arrayOptions: Required<ArrayOptions>;
    debug: Required<DebugOptions>;
    /** Pre-compiled combined regex from all patterns. */
    _combinedPattern: RegExp;
  }

  /**
   * Merge user options with defaults, pre-compile patterns,
   * and validate configuration.
   */
  export function resolveOptions(options?: SanitizeOptions): ResolvedOptions;

  /**
   * Sanitize a request object's body, query, and/or params in-place.
   * Respects content-type guards and Express 5 non-writable properties.
   */
  export function handleRequest(request: any, options: ResolvedOptions): void;

  /**
   * Check if a request path matches any skip route.
   * Exact strings use O(1) Set lookup, regex patterns iterate.
   */
  export function shouldSkipRoute(requestPath: string, skipRoutes: ResolvedSkipRoutes, debug?: DebugOptions): boolean;

  /**
   * Check if the request's content-type is in the allowed set.
   * Returns `true` if body should be sanitized.
   */
  export function shouldSanitizeContentType(request: any, contentTypes: Set<string> | null): boolean;

  /**
   * Check if a property is writable on an object or its prototype chain.
   */
  export function isWritable(obj: any, prop: string): boolean;

  // ── Sanitizers ────────────────────────────────────────────

  /**
   * Main dispatch — routes to appropriate sanitizer by type.
   * @param value    - Value to sanitize (string, object, array, or primitive).
   * @param options  - Resolved options.
   * @param isValue  - `true` if this is a value (not an object key).
   * @param depth    - Current recursion depth.
   */
  export function sanitizeValue(value: any, options: ResolvedOptions, isValue?: boolean, depth?: number): any;

  /**
   * Sanitize a single string. Preserves email addresses.
   */
  export function sanitizeString(str: any, options: ResolvedOptions, isValue?: boolean): any;

  /**
   * Sanitize all keys and values of a plain object.
   */
  export function sanitizeObject(
    obj: Record<string, any>,
    options: ResolvedOptions,
    depth?: number,
  ): Record<string, any>;

  /**
   * Sanitize all elements of an array.
   */
  export function sanitizeArray(arr: any[], options: ResolvedOptions, depth?: number): any[];

  export function isString(value: any): value is string;
  export function isArray(value: any): value is any[];
  export function isPlainObject(value: any): value is Record<string, any>;
  export function isBoolean(value: any): value is boolean;
  export function isNumber(value: any): value is number;
  export function isPrimitive(value: any): boolean;
  export function isDate(value: any): value is Date;
  export function isFunction(value: any): value is Function;
  export function isObjectEmpty(obj: any): boolean;
  export function isEmail(value: any): boolean;

  /**
   * Normalize a URL path: strip query string, trailing slashes.
   */
  export function cleanUrl(url: any): string | null;

  /**
   * Extract MIME type from a Content-Type header.
   * `"application/json; charset=utf-8"` → `"application/json"`
   */
  export function extractMimeType(contentType: any): string | null;

  /** Log a message at the given level. */
  export function log(debugOpts: DebugOptions, level: string, context: string, message: string, data?: any): void;

  /** Start a timing measurement. Returns a function to end timing. */
  export function startTiming(debugOpts: DebugOptions, operation: string): () => void;

  /** Validate an options object, throw on invalid config. */
  export function validateOptions(options: Record<string, any>): void;

  /** Default sanitization patterns: `$` operator + control characters. */
  export const PATTERNS: ReadonlyArray<RegExp>;
  /** Default options before user overrides. */
  export const DEFAULT_OPTIONS: Readonly<SanitizeOptions>;
  /** Numeric log level mapping. */
  export const LOG_LEVELS: Readonly<Record<string, number>>;
  /** ANSI color codes for log levels. */
  export const LOG_COLORS: Readonly<Record<string, string>>;

  export class NoSQLSanitizeError extends Error {
    name: 'NoSQLSanitizeError';
    type: string;
    constructor(message: string, type?: string);
    code(): string;
  }

  export const noSQLSanitizeCore: NoSQLSanitizeCore;
  export { noSQLSanitizeCore as default };
}

declare function noSQLSanitizeCore(
  ...params: Parameters<NoSQLSanitizeCore['resolveOptions']>
): ReturnType<NoSQLSanitizeCore['resolveOptions']>;

export = noSQLSanitizeCore;
