/// <reference types="node" />

type NoSQLSanitizeCore = typeof noSQLSanitizeCore;

declare namespace noSQLSanitizeCore {
  export interface StringOptions {
    /** Trim leading/trailing whitespace from values (keys are left alone). @default false */
    trim?: boolean;
    /** Convert values to lowercase (keys are left alone). @default false */
    lowercase?: boolean;
    /** Truncate values longer than this (a positive integer). @default null */
    maxLength?: number | null;
  }

  export interface ArrayOptions {
    /**
     * Filter array items after sanitization. `true` / `'falsy'` remove every
     * **falsy** item (`null`, `undefined`, `0`, `''`, `false`), not only `null`;
     * `'nullish'` removes only `null` and `undefined`. @default false
     */
    filterNull?: boolean | 'falsy' | 'nullish';
    /** Remove duplicate values from arrays. @default false */
    distinct?: boolean;
  }

  type LogMethod = (obj: Record<string, any>, msg: string) => void;

  /**
   * Any logger with these methods, e.g. pino, `fastify.log` or `console`.
   * Called pino-style: `logger.info({ module, context, data? }, message)`.
   */
  export interface Logger {
    error: LogMethod;
    warn: LogMethod;
    info: LogMethod;
    debug: LogMethod;
    trace: LogMethod;
  }

  export interface DebugOptions {
    /** Enable debug logging. @default false */
    enabled?: boolean;
    /** Log level threshold. @default 'info' */
    level?: 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
    /** Log when a pattern changes a string, without the value itself. @default false */
    logPatternMatches?: boolean;
    /** Log original and sanitized values. They may contain tokens or PII. @default false */
    logSanitizedValues?: boolean;
    /** Log when routes are skipped. @default false */
    logSkippedRoutes?: boolean;
    /**
     * Where log messages go. `level` still filters first, then the logger's own level applies.
     * `null` writes formatted lines with `console.log`. @default null
     */
    logger?: Logger | null;
  }

  /** What `handleRequest` does when a request contains an injection. */
  export type OnInjection = 'sanitize' | 'reject' | 'report';

  /** What to do with object keys that contain a `.`. */
  export type DotKeysBehavior = 'allow' | 'replace' | 'remove';

  /** Behavior when a value is nested deeper than `maxDepth`. */
  export type MaxDepthBehavior = 'remove' | 'throw' | 'preserve';

  /** Kind of change reported by an `onSanitize` event. */
  export type SanitizeEventType = 'value' | 'key' | 'both' | 'removed';

  /** Why a key/value pair was removed (only present when `type === 'removed'`). */
  export type SanitizeRemoveReason =
    | 'deniedKey'
    | 'notAllowed'
    | 'prototypePollution'
    | 'dotKey'
    | 'removeMatches'
    | 'removeEmpty'
    | 'maxDepth'
    | 'circular';

  /**
   * Event passed to the `onSanitize` callback.
   *
   * Fires for: string value changes, key renames (e.g. `$gt` → `gt`), string
   * changes inside arrays, and removals (denied/not-allowed/dangerous keys,
   * `removeMatches`, `removeEmpty`, and `maxDepth` drops).
   */
  export interface SanitizeEvent {
    /** What changed. */
    type: SanitizeEventType;
    /** Why the pair was removed. Only set when `type === 'removed'`. */
    reason?: SanitizeRemoveReason;
    /** The original object key (or array index as a string). */
    key: string;
    /** The key after sanitization. Same as `key` unless the key was renamed. */
    sanitizedKey?: string;
    /** Full dotted path to the value, e.g. `body.user.tags[2]`. */
    path: string;
    /** The original value before sanitization. */
    originalValue: any;
    /** The value after sanitization. `undefined` for removals. */
    sanitizedValue: any;
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
     * `+json` types (e.g. `application/vnd.api+json`) are treated as JSON when
     * `application/json` is listed. Set to `null` to sanitize all content types;
     * other bodies pass through unsanitized. Query/params are always sanitized.
     * @default ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data']
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
     * What to do when a request contains an injection. `'sanitize'` strips it.
     * `'reject'` throws `NoSQLSanitizeError('injection_detected')` with `statusCode: 400`
     * (Express and Fastify answer 400). `'report'` is a dry run: changes are reported
     * through `onSanitize` (required) and the request is left untouched.
     * @default 'sanitize'
     */
    onInjection?: OnInjection;
    /**
     * Callback fired when a value is sanitized, a key is renamed, or a pair is
     * removed. See {@link SanitizeEvent}.
     * @default null
     */
    onSanitize?: ((event: SanitizeEvent) => void) | null;
    /** Recursively sanitize nested objects/arrays. @default true */
    recursive?: boolean;
    /**
     * Remove keys whose value is empty after sanitization, and keys that sanitize
     * to an empty string. `true` / `'falsy'` remove every **falsy** value (`''`,
     * `null`, `undefined`, `0`, `false`); `'empty'` keeps `0` and `false` and
     * removes `''`, `null`, `undefined`, `{}` and `[]`.
     * @default false
     */
    removeEmpty?: boolean | 'falsy' | 'empty';
    /**
     * Maximum recursion depth for nested objects.
     * Strings are always sanitized regardless of depth.
     * `0` sanitizes only top-level strings. `null` = no limit, but nesting past
     * 256 levels throws a `max_depth` NoSQLSanitizeError instead of overflowing the stack.
     * @default 32
     */
    maxDepth?: number | null;
    /**
     * What happens to values nested deeper than `maxDepth`.
     * `'remove'` drops them (fail-closed), `'preserve'` returns them UNSANITIZED
     * (v3 default), `'throw'` rejects the request.
     * @default 'remove'
     */
    maxDepthBehavior?: MaxDepthBehavior;
    /**
     * Preserve email-looking values without sanitizing. Note this also bypasses
     * custom `patterns`; set to `false` if custom patterns must apply to emails.
     * @default true
     */
    preserveEmails?: boolean;
    /**
     * Allow `__proto__` / `constructor` / `prototype` keys through. When `false`
     * (default) these keys are stripped to prevent prototype pollution.
     * @default false
     */
    allowPrototypeKeys?: boolean;
    /**
     * Regex patterns to match and replace. Must be a non-empty array of RegExps;
     * they are combined into one regex with their flags merged (`g` forced, `y` dropped).
     * @default [/\$/g, /control chars/g]
     */
    patterns?: RegExp[];
    /**
     * Key whitelist (empty = allow all). Applied at **every depth**: any key not
     * listed is removed. Listed keys are still sanitized (`$` is stripped), so
     * this does not permit MongoDB operators; use `allowedOperators` for that.
     * @default []
     */
    allowedKeys?: string[];
    /**
     * `$`-operators kept verbatim at every depth, e.g. `['$set']`. Exact match.
     * They also pass the `allowedKeys` whitelist and `removeMatches`; their values
     * are still sanitized, and `deniedKeys` still removes them. Never list
     * operators that run JavaScript (`$where`, `$function`, `$accumulator`).
     * @default []
     */
    allowedOperators?: string[];
    /**
     * Keys containing a `.` (e.g. `'profile.isAdmin'`), which become nested
     * writes when spread into `$set`. `'replace'` swaps each `.` for
     * `replaceWith`; `'remove'` drops the pair.
     * @default 'allow'
     */
    dotKeys?: DotKeysBehavior;
    /**
     * Remove these keys (empty = deny none). Note: with `preserveEmails: true`
     * a denied key whose value looks like an email is kept.
     * @default []
     */
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
    onInjection: OnInjection;
    onSanitize: ((event: SanitizeEvent) => void) | null;
    recursive: boolean;
    removeEmpty: boolean | 'falsy' | 'empty';
    maxDepth: number | null;
    maxDepthBehavior: MaxDepthBehavior;
    preserveEmails: boolean;
    allowPrototypeKeys: boolean;
    patterns: RegExp[];
    allowedKeys: Set<string>;
    allowedOperators: Set<string>;
    dotKeys: DotKeysBehavior;
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
   * Sanitize any value outside a request (GraphQL args, WebSocket messages, queue
   * payloads). Uses the built-in sanitizer (`customSanitizer` is ignored) and never
   * mutates `value`. User options are resolved once per object; don't mutate them.
   * Returns an empty object/array if the root itself is dropped.
   */
  export function sanitize<T = any>(value: T, options?: SanitizeOptions | ResolvedOptions): T;

  /**
   * Whether sanitizing `value` would neutralize an injection: a key or string matching
   * `patterns`, a prototype key, or a dotted key while `dotKeys` isn't `'allow'`.
   * Keys dropped by `deniedKeys` / `allowedKeys` and `allowedOperators` don't count.
   * Scans every depth, regardless of `maxDepth` and `recursive`. Never mutates `value`.
   */
  export function hasInjection(value: any, options?: SanitizeOptions | ResolvedOptions): boolean;

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
   * Sentinel returned by `sanitizeValue` when a value is dropped by the
   * `maxDepth` guard (`maxDepthBehavior: 'remove'`).
   */
  export const REMOVE: unique symbol;

  /**
   * Main dispatch — routes to appropriate sanitizer by type.
   * @param value    - Value to sanitize (string, object, array, or primitive).
   * @param options  - Resolved options.
   * @param isValue  - `true` if this is a value (not an object key).
   * @param depth    - Current recursion depth.
   * @param path     - Dotted path used for `onSanitize` events.
   */
  export function sanitizeValue(
    value: any,
    options: ResolvedOptions,
    isValue?: boolean,
    depth?: number,
    path?: string,
  ): any;

  /**
   * Sanitize a single string. Preserves email addresses when `preserveEmails`.
   */
  export function sanitizeString(str: any, options: ResolvedOptions, isValue?: boolean): any;

  /**
   * Sanitize all keys and values of a plain object.
   */
  export function sanitizeObject(
    obj: Record<string, any>,
    options: ResolvedOptions,
    depth?: number,
    path?: string,
  ): Record<string, any>;

  /**
   * Sanitize all elements of an array.
   */
  export function sanitizeArray(arr: any[], options: ResolvedOptions, depth?: number, path?: string): any[];

  export function isString(value: any): value is string;
  export function isArray(value: any): value is any[];
  export function isPlainObject(value: any): value is Record<string, any>;
  export function isBoolean(value: any): value is boolean;
  export function isNumber(value: any): value is number;
  export function isPrimitive(value: any): boolean;
  export function isDate(value: any): value is Date;
  export function isFunction(value: any): value is Function;
  export function isObjectEmpty(obj: any): boolean;
  /** `''`, `null`, `undefined`, `{}` or `[]` (what `removeEmpty: 'empty'` removes). */
  export function isEmptyValue(val: any): boolean;
  export function isEmail(value: any): boolean;
  /** Has `error`, `warn`, `info`, `debug` and `trace` methods. */
  export function isLogger(value: any): value is Logger;

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
  /** Keys blocked by default to prevent prototype pollution. */
  export const DANGEROUS_KEYS: ReadonlySet<string>;
  /** Default options before user overrides. */
  export const DEFAULT_OPTIONS: Readonly<SanitizeOptions>;
  /** Numeric log level mapping. */
  export const LOG_LEVELS: Readonly<Record<string, number>>;
  /** ANSI color codes for log levels. */
  export const LOG_COLORS: Readonly<Record<string, string>>;

  export class NoSQLSanitizeError extends Error {
    name: 'NoSQLSanitizeError';
    /** e.g. `'type_error'`, `'max_depth'`, `'injection_detected'`. */
    type: string;
    /** HTTP status for client errors (`400` for `'injection_detected'`). */
    statusCode?: number;
    constructor(message: string, type?: string, statusCode?: number);
    code(): string;
  }

  export const noSQLSanitizeCore: NoSQLSanitizeCore;
  export { noSQLSanitizeCore as default };
}

declare function noSQLSanitizeCore(
  ...params: Parameters<NoSQLSanitizeCore['resolveOptions']>
): ReturnType<NoSQLSanitizeCore['resolveOptions']>;

export = noSQLSanitizeCore;
