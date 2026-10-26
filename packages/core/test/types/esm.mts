// Compiled by `yarn test:types` (tsc, module node16) as an ESM consumer. Not run.
import core, { resolveOptions, sanitize, hasInjection, NoSQLSanitizeError } from '@exortek/nosql-sanitize-core';
import type { SanitizeOptions, SanitizeEvent, ResolvedOptions } from '@exortek/nosql-sanitize-core';

const options: SanitizeOptions = {
  replaceWith: '_',
  allowedOperators: ['$set'],
  dotKeys: 'remove',
  removeEmpty: 'empty',
  onInjection: 'report',
  arrayOptions: { filterNull: 'nullish' },
  onSanitize: (event: SanitizeEvent) => void event.path,
};
const resolved: ResolvedOptions = resolveOptions(options);
const clean: { a: number } = sanitize({ a: 1 }, resolved);
const flagged: boolean = hasInjection({ $gt: 1 }, options);
const viaDefault: ResolvedOptions = core.resolveOptions();

const err = new NoSQLSanitizeError('x', 'injection_detected', 400);
const status: number | undefined = err.statusCode;

// @ts-expect-error unknown dotKeys mode
resolveOptions({ dotKeys: 'strip' });
// @ts-expect-error unknown onInjection mode
resolveOptions({ onInjection: 'block' });
// @ts-expect-error removeEmpty has no 'nullish' mode
resolveOptions({ removeEmpty: 'nullish' });

export { clean, flagged, viaDefault, status };
