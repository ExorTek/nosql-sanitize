export interface StringOptions {
  trim?: boolean;
  lowercase?: boolean;
  maxLength?: number | null;
}

export interface ArrayOptions {
  filterNull?: boolean;
  distinct?: boolean;
}

export interface DebugOptions {
  enabled?: boolean;
  level?: 'silent' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
  logPatternMatches?: boolean;
  logSanitizedValues?: boolean;
  logSkippedRoutes?: boolean;
}

export interface SanitizeEvent {
  key: string;
  originalValue: string;
  sanitizedValue: string;
  path: string;
}

export interface SanitizeOptions {
  replaceWith?: string;
  removeMatches?: boolean;
  sanitizeObjects?: string[];
  contentTypes?: string[] | null;
  mode?: 'auto' | 'manual';
  skipRoutes?: (string | RegExp)[];
  customSanitizer?: ((data: any, options: ResolvedOptions) => any) | null;
  onSanitize?: ((event: SanitizeEvent) => void) | null;
  recursive?: boolean;
  removeEmpty?: boolean;
  maxDepth?: number | null;
  patterns?: RegExp[];
  allowedKeys?: string[];
  deniedKeys?: string[];
  stringOptions?: StringOptions;
  arrayOptions?: ArrayOptions;
  debug?: DebugOptions;
}

export interface ResolvedOptions extends Required<
  Omit<SanitizeOptions, 'skipRoutes' | 'contentTypes' | 'allowedKeys' | 'deniedKeys'>
> {
  _combinedPattern: RegExp;
  skipRoutes: { exact: Set<string>; regex: RegExp[] };
  contentTypes: Set<string> | null;
  allowedKeys: Set<string>;
  deniedKeys: Set<string>;
}

export declare function resolveOptions(options?: SanitizeOptions): ResolvedOptions;
export declare function sanitizeValue(value: any, options: ResolvedOptions, isValue?: boolean, depth?: number): any;
export declare function sanitizeString(str: any, options: ResolvedOptions, isValue?: boolean): any;
export declare function sanitizeObject(
  obj: Record<string, any>,
  options: ResolvedOptions,
  depth?: number,
): Record<string, any>;
export declare function sanitizeArray(arr: any[], options: ResolvedOptions, depth?: number): any[];
export declare function handleRequest(request: any, options: ResolvedOptions): void;
export declare function shouldSkipRoute(
  requestPath: string,
  skipRoutes: ResolvedOptions['skipRoutes'],
  debug?: DebugOptions,
): boolean;
export declare function shouldSanitizeContentType(request: any, contentTypes: Set<string> | null): boolean;
export declare function isWritable(obj: any, prop: string): boolean;

export declare function isString(value: any): value is string;
export declare function isArray(value: any): value is any[];
export declare function isPlainObject(value: any): value is Record<string, any>;
export declare function isBoolean(value: any): value is boolean;
export declare function isNumber(value: any): value is number;
export declare function isPrimitive(value: any): boolean;
export declare function isDate(value: any): value is Date;
export declare function isFunction(value: any): value is Function;
export declare function isObjectEmpty(obj: any): boolean;
export declare function isEmail(value: any): boolean;
export declare function cleanUrl(url: any): string | null;
export declare function extractMimeType(contentType: any): string | null;
export declare function validateOptions(options: Record<string, any>): void;

export declare const PATTERNS: ReadonlyArray<RegExp>;
export declare const DEFAULT_OPTIONS: Readonly<SanitizeOptions>;
export declare const LOG_LEVELS: Readonly<Record<string, number>>;
export declare const LOG_COLORS: Readonly<Record<string, string>>;

export declare class NoSQLSanitizeError extends Error {
  type: string;
  constructor(message: string, type?: string);
  code(): string;
}
