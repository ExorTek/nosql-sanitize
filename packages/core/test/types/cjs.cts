// Compiled by `yarn test:types` (tsc, module node16) as a CommonJS consumer. Not run.
import core = require('@exortek/nosql-sanitize-core');

const resolved = core.resolveOptions({ maxDepth: 32, maxDepthBehavior: 'remove' });
const out = core.sanitizeValue({ a: '$b' }, resolved);
const flagged: boolean = core.hasInjection(out);

export = { flagged };
