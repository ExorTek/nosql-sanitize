#!/usr/bin/env node
'use strict';

/**
 * nosql-sanitize Benchmark Suite
 *
 * Usage:
 *   node benchmarks/index.js              # Run + console output
 *   node benchmarks/index.js --save       # Run + save JSON & Markdown reports
 *   node benchmarks/index.js --compare    # Run + compare with last saved result
 *   node --expose-gc benchmarks/index.js  # More accurate (forces GC between runs)
 *
 * Reports saved to: benchmarks/results/
 */

const fs = require('fs');
const path = require('path');

const {
  resolveOptions,
  sanitizeValue,
  sanitizeString,
  handleRequest,
  shouldSkipRoute,
  isEmail,
  isPlainObject,
  isObjectEmpty,
  cleanUrl,
  extractMimeType,
} = require('../packages/core/src');

// ── CLI Args ────────────────────────────────────────────────

const args = process.argv.slice(2);
const SAVE = args.includes('--save');
const COMPARE = args.includes('--compare');
const RESULTS_DIR = path.join(__dirname, 'results');

// ── Formatting ──────────────────────────────────────────────

const formatOps = (ops) => {
  if (ops >= 1e6) return (ops / 1e6).toFixed(2) + 'M ops/s';
  if (ops >= 1e3) return (ops / 1e3).toFixed(2) + 'K ops/s';
  return ops.toFixed(0) + ' ops/s';
};

const formatTime = (ms) => {
  if (ms < 0.001) return (ms * 1000).toFixed(1) + ' μs';
  if (ms < 1) return ms.toFixed(3) + ' ms';
  return ms.toFixed(1) + ' ms';
};

const formatDelta = (current, previous) => {
  if (!previous) return '';
  const pct = ((current - previous) / previous) * 100;
  if (Math.abs(pct) < 1) return '  ~same';
  const arrow = pct < 0 ? '🟢 ' : '🔴 ';
  return `${arrow}${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
};

// ── Bench Engine ────────────────────────────────────────────

const allResults = [];
let currentSection = '';

function section(title) {
  currentSection = title;
  console.log('');
  console.log(`${'═'.repeat(90)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(90)}`);
  console.log(
    `  ${'Test'.padEnd(48)} ${'Time/op'.padStart(12)}   ${'Throughput'.padStart(14)}   ${'Delta'.padStart(10)}`,
  );
  console.log(`${'─'.repeat(90)}`);
}

function bench(label, fn, { iterations = 100000, warmup = 1000 } = {}) {
  // Warmup
  for (let i = 0; i < warmup; i++) fn();

  // GC if available
  if (global.gc) global.gc();

  const start = process.hrtime.bigint();
  for (let i = 0; i < iterations; i++) fn();
  const elapsed = Number(process.hrtime.bigint() - start) / 1e6;

  const msPerOp = elapsed / iterations;
  const opsPerSec = 1000 / msPerOp;

  // Find previous result for comparison
  let delta = '';
  if (COMPARE && previousResults) {
    const prev = previousResults.find((r) => r.section === currentSection && r.label === label);
    if (prev) delta = formatDelta(msPerOp, prev.msPerOp);
  }

  const result = {
    section: currentSection,
    label,
    msPerOp,
    opsPerSec,
    iterations,
  };
  allResults.push(result);

  console.log(
    `  ${label.padEnd(48)} ${formatTime(msPerOp).padStart(12)}   ${formatOps(opsPerSec).padStart(14)}   ${delta.padStart(10)}`,
  );

  return result;
}

// ── Load Previous Results ───────────────────────────────────

let previousResults = null;

if (COMPARE) {
  try {
    const files = fs
      .readdirSync(RESULTS_DIR)
      .filter((f) => f.endsWith('.json'))
      .sort();
    if (files.length > 0) {
      const lastFile = path.join(RESULTS_DIR, files[files.length - 1]);
      const data = JSON.parse(fs.readFileSync(lastFile, 'utf8'));
      previousResults = data.results;
      console.log(`  Comparing with: ${files[files.length - 1]}`);
    } else {
      console.log('  No previous results found. Run with --save first.');
    }
  } catch {
    console.log('  No previous results found. Run with --save first.');
  }
}

// ── Payload Generators ──────────────────────────────────────

const makeFlat = (n) => {
  const obj = {};
  for (let i = 0; i < n; i++) obj[`$key_${i}`] = `$value_${i}`;
  return obj;
};

const makeNested = (depth, breadth) => {
  if (depth === 0) return '$leaf_' + Math.random().toString(36).slice(2, 8);
  const obj = {};
  for (let i = 0; i < breadth; i++) obj[`$k${i}`] = makeNested(depth - 1, breadth);
  return obj;
};

const makeMixed = (n) => {
  const obj = {};
  for (let i = 0; i < n; i++) {
    const mod = i % 5;
    if (mod === 0) obj[`key_${i}`] = `$dangerous_${i}`;
    else if (mod === 1) obj[`key_${i}`] = i;
    else if (mod === 2) obj[`key_${i}`] = `safe_value_${i}`;
    else if (mod === 3) obj[`key_${i}`] = null;
    else obj[`key_${i}`] = `user${i}@example.com`;
  }
  return obj;
};

const makeRequest = (body) => ({
  headers: { 'content-type': 'application/json' },
  body: JSON.parse(JSON.stringify(body)),
  query: { role: '$admin', page: '1' },
  path: '/api/users',
  url: '/api/users?page=1',
});

// ═══════════════════════════════════════════════════════════════
// BENCHMARKS
// ═══════════════════════════════════════════════════════════════

const os = require('os');

const meta = {
  timestamp: new Date().toISOString(),
  node: process.version,
  platform: `${process.platform} ${process.arch}`,
  gc: !!global.gc,
  cpu: os.cpus()[0]?.model || 'unknown',
  cpuCores: os.cpus().length,
  totalMemMB: Math.round(os.totalmem() / 1024 / 1024),
  freeMemMB: Math.round(os.freemem() / 1024 / 1024),
};

const rssStart = process.memoryUsage().rss;

console.log('');
console.log('  nosql-sanitize Benchmark Suite');
console.log(`  Node.js ${meta.node} | ${meta.platform} | GC: ${meta.gc ? 'enabled' : 'disabled'}`);
console.log(`  CPU: ${meta.cpu} (${meta.cpuCores} cores)`);
console.log(`  RAM: ${meta.totalMemMB} MB total / ${meta.freeMemMB} MB free`);
console.log(`  ${meta.timestamp}`);
if (SAVE) console.log('  Mode: --save (results will be saved)');
if (COMPARE) console.log('  Mode: --compare');

// 1. resolveOptions
section('resolveOptions — Init Cost');
bench('Default options', () => resolveOptions());
bench('With skipRoutes (5 strings)', () => resolveOptions({ skipRoutes: ['/a', '/b', '/c', '/d', '/e'] }));
bench('With skipRoutes (5 regex)', () => resolveOptions({ skipRoutes: [/^\/a/, /^\/b/, /^\/c/, /^\/d/, /^\/e/] }));
bench('With all options', () =>
  resolveOptions({
    replaceWith: '_',
    maxDepth: 5,
    contentTypes: ['application/json'],
    skipRoutes: ['/health', /^\/docs\/.*/],
    allowedKeys: ['a', 'b', 'c'],
    stringOptions: { trim: true, lowercase: true, maxLength: 100 },
  }),
);

// 2. sanitizeString
section('sanitizeString');
const strOpts = resolveOptions();
bench('Clean string (no match)', () => sanitizeString('hello world', strOpts, true));
bench('Dirty string ($prefix)', () => sanitizeString('$admin', strOpts, true));
bench('Email (fast-path skip)', () => sanitizeString('user@example.com', strOpts, true));
bench('Long string 1KB', () => sanitizeString('$' + 'a'.repeat(1023), strOpts, true));
bench('Long string 10KB', () => sanitizeString('$' + 'a'.repeat(10239), strOpts, true), { iterations: 50000 });

// 3. sanitizeValue — objects
section('sanitizeValue — Objects');
const opts = resolveOptions();
const flat5 = makeFlat(5);
const flat20 = makeFlat(20);
const flat100 = makeFlat(100);
const nested3x3 = makeNested(3, 3);
const nested3x5 = makeNested(3, 5);
const nested4x5 = makeNested(4, 5);
const mixed50 = makeMixed(50);

bench('Flat 5 fields', () => sanitizeValue(JSON.parse(JSON.stringify(flat5)), opts));
bench('Flat 20 fields', () => sanitizeValue(JSON.parse(JSON.stringify(flat20)), opts));
bench('Flat 100 fields', () => sanitizeValue(JSON.parse(JSON.stringify(flat100)), opts), { iterations: 20000 });
bench('Nested 3×3 (~39 fields)', () => sanitizeValue(JSON.parse(JSON.stringify(nested3x3)), opts));
bench('Nested 3×5 (~155 fields)', () => sanitizeValue(JSON.parse(JSON.stringify(nested3x5)), opts), {
  iterations: 20000,
});
bench('Nested 4×5 (~780 fields)', () => sanitizeValue(JSON.parse(JSON.stringify(nested4x5)), opts), {
  iterations: 5000,
});
bench('Mixed 50 (strings/nums/nulls/emails)', () => sanitizeValue(JSON.parse(JSON.stringify(mixed50)), opts), {
  iterations: 50000,
});

// 4. sanitizeValue — arrays
section('sanitizeValue — Arrays');
const arr10 = Array.from({ length: 10 }, (_, i) => `$item_${i}`);
const arr100 = Array.from({ length: 100 }, (_, i) => `$item_${i}`);
const arrMixed = Array.from({ length: 50 }, (_, i) => (i % 3 === 0 ? `$bad_${i}` : i % 3 === 1 ? i : null));
const arrNested = Array.from({ length: 20 }, (_, i) => ({ [`$k${i}`]: `$v${i}` }));

bench('String array (10 items)', () => sanitizeValue([...arr10], opts));
bench('String array (100 items)', () => sanitizeValue([...arr100], opts), { iterations: 20000 });
bench('Mixed array (50 items)', () => sanitizeValue([...arrMixed], opts));
bench('Object array (20 items)', () => sanitizeValue(JSON.parse(JSON.stringify(arrNested)), opts));
bench('With filterNull+distinct', () => {
  const o = resolveOptions({ arrayOptions: { filterNull: true, distinct: true } });
  sanitizeValue([...arrMixed], o);
});

// 5. handleRequest — full pipeline
section('handleRequest — Full Pipeline');
const reqOpts = resolveOptions();
const reqOptsSkip = resolveOptions({ skipRoutes: ['/health', '/metrics', /^\/docs\/.*/] });
const reqOptsMaxDepth = resolveOptions({ maxDepth: 2 });

bench('Small body (5 fields)', () => handleRequest(makeRequest(flat5), reqOpts));
bench('Medium body (20 fields)', () => handleRequest(makeRequest(flat20), reqOpts));
bench('Large body (100 fields)', () => handleRequest(makeRequest(flat100), reqOptsMaxDepth), { iterations: 10000 });
bench('Nested body (3×5, ~155 fields)', () => handleRequest(makeRequest(nested3x5), reqOpts), { iterations: 10000 });
bench('With maxDepth=2', () => handleRequest(makeRequest(nested3x5), reqOptsMaxDepth), { iterations: 20000 });
bench('skipRoute hit (exact)', () => {
  const req = makeRequest(flat5);
  req.path = '/health';
  if (!shouldSkipRoute(req.path, reqOptsSkip.skipRoutes)) handleRequest(req, reqOptsSkip);
});
bench('skipRoute hit (regex)', () => {
  const req = makeRequest(flat5);
  req.path = '/docs/swagger/api';
  if (!shouldSkipRoute(req.path, reqOptsSkip.skipRoutes)) handleRequest(req, reqOptsSkip);
});

// 6. shouldSkipRoute
section('shouldSkipRoute');
const skipExact = resolveOptions({
  skipRoutes: ['/a', '/b', '/c', '/d', '/e', '/f', '/g', '/h', '/i', '/j'],
}).skipRoutes;
const skipRegex = resolveOptions({ skipRoutes: [/^\/api\/v\d+\//, /^\/docs\//, /^\/internal\//] }).skipRoutes;
const skipMixed = resolveOptions({
  skipRoutes: ['/health', '/metrics', /^\/docs\//, /^\/api\/v\d+\/internal/],
}).skipRoutes;

bench('Exact match (10 routes, hit)', () => shouldSkipRoute('/e', skipExact));
bench('Exact match (10 routes, miss)', () => shouldSkipRoute('/z', skipExact));
bench('Regex match (3 patterns, hit)', () => shouldSkipRoute('/docs/swagger', skipRegex));
bench('Regex match (3 patterns, miss)', () => shouldSkipRoute('/api/users', skipRegex));
bench('Mixed (4 routes, exact hit)', () => shouldSkipRoute('/health', skipMixed));
bench('Mixed (4 routes, regex hit)', () => shouldSkipRoute('/docs/api/v1', skipMixed));
bench('Mixed (4 routes, miss)', () => shouldSkipRoute('/api/users', skipMixed));

// 7. Helpers
section('Helpers & Type Checks');
const plainObj = { a: 1, b: 2 };
const nullProto = Object.create(null);
nullProto.a = 1;
const fastifyProto = Object.create(Object.create(null));
fastifyProto.a = 1;

bench('isPlainObject (regular)', () => isPlainObject(plainObj));
bench('isPlainObject (null-proto)', () => isPlainObject(nullProto));
bench('isPlainObject (fastify 2-level)', () => isPlainObject(fastifyProto));
bench('isObjectEmpty (empty)', () => isObjectEmpty({}));
bench('isObjectEmpty (non-empty)', () => isObjectEmpty(plainObj));
bench('isEmail (valid)', () => isEmail('user@example.com'));
bench('isEmail (invalid — no @)', () => isEmail('hello-world'));
bench('isEmail (number)', () => isEmail(42));
bench('cleanUrl (with query)', () => cleanUrl('/api/users?page=1&sort=name'));
bench('extractMimeType (with charset)', () => extractMimeType('application/json; charset=utf-8'));

// 8. maxDepth impact
section('maxDepth Impact');
const deepPayload = makeNested(5, 3);
const optsNoLimit = resolveOptions();
const optsDepth1 = resolveOptions({ maxDepth: 1 });
const optsDepth2 = resolveOptions({ maxDepth: 2 });
const optsDepth3 = resolveOptions({ maxDepth: 3 });

bench('Depth 5×3 — no limit', () => sanitizeValue(JSON.parse(JSON.stringify(deepPayload)), optsNoLimit), {
  iterations: 10000,
});
bench('Depth 5×3 — maxDepth=1', () => sanitizeValue(JSON.parse(JSON.stringify(deepPayload)), optsDepth1), {
  iterations: 10000,
});
bench('Depth 5×3 — maxDepth=2', () => sanitizeValue(JSON.parse(JSON.stringify(deepPayload)), optsDepth2), {
  iterations: 10000,
});
bench('Depth 5×3 — maxDepth=3', () => sanitizeValue(JSON.parse(JSON.stringify(deepPayload)), optsDepth3), {
  iterations: 10000,
});

// 9. Feature overhead
section('Feature Overhead (20 fields)');
const baseOpts = resolveOptions();
const trimOpts = resolveOptions({ stringOptions: { trim: true, lowercase: true, maxLength: 100 } });
const removeMatchOpts = resolveOptions({ removeMatches: true });
const removeEmptyOpts = resolveOptions({ removeEmpty: true });
const allowedOpts = resolveOptions({ allowedKeys: ['key_0', 'key_1', 'key_2', 'key_3', 'key_4'] });
const callbackOpts = resolveOptions({ onSanitize: () => {} });
const payload20 = makeFlat(20);

bench('Baseline (default)', () => sanitizeValue(JSON.parse(JSON.stringify(payload20)), baseOpts));
bench('+ stringOptions (trim+lower+max)', () => sanitizeValue(JSON.parse(JSON.stringify(payload20)), trimOpts));
bench('+ removeMatches', () => sanitizeValue(JSON.parse(JSON.stringify(payload20)), removeMatchOpts));
bench('+ removeEmpty', () => sanitizeValue(JSON.parse(JSON.stringify(payload20)), removeEmptyOpts));
bench('+ allowedKeys (5 keys)', () => sanitizeValue(JSON.parse(JSON.stringify(payload20)), allowedOpts));
bench('+ onSanitize callback', () => sanitizeValue(JSON.parse(JSON.stringify(payload20)), callbackOpts));

// ═══════════════════════════════════════════════════════════════
// MEMORY & SYSTEM STATS
// ═══════════════════════════════════════════════════════════════

const mem = process.memoryUsage();
const rssEnd = mem.rss;

meta.memory = {
  rssStartMB: +(rssStart / 1024 / 1024).toFixed(1),
  rssEndMB: +(rssEnd / 1024 / 1024).toFixed(1),
  rssDeltaMB: +((rssEnd - rssStart) / 1024 / 1024).toFixed(1),
  heapUsedMB: +(mem.heapUsed / 1024 / 1024).toFixed(1),
  heapTotalMB: +(mem.heapTotal / 1024 / 1024).toFixed(1),
  externalMB: +(mem.external / 1024 / 1024).toFixed(1),
};

console.log('');
console.log('═'.repeat(90));
console.log('  Process Memory');
console.log('─'.repeat(90));
console.log(`  RSS:       ${meta.memory.rssStartMB} MB → ${meta.memory.rssEndMB} MB (Δ ${meta.memory.rssDeltaMB} MB)`);
console.log(`  Heap:      ${meta.memory.heapUsedMB} MB used / ${meta.memory.heapTotalMB} MB total`);
console.log(`  External:  ${meta.memory.externalMB} MB`);

// ═══════════════════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════════════════

console.log('');
console.log('═'.repeat(90));

if (SAVE) {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  const ts = meta.timestamp.replace(/[:.]/g, '-').slice(0, 19);

  // JSON report
  const jsonReport = { meta, results: allResults };
  const jsonPath = path.join(RESULTS_DIR, `${ts}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonReport, null, 2));

  // Markdown report
  const mdLines = [
    `# Benchmark Results`,
    '',
    `- **Date:** ${meta.timestamp}`,
    `- **Node.js:** ${meta.node}`,
    `- **Platform:** ${meta.platform}`,
    `- **CPU:** ${meta.cpu} (${meta.cpuCores} cores)`,
    `- **RAM:** ${meta.totalMemMB} MB total / ${meta.freeMemMB} MB free`,
    `- **GC:** ${meta.gc ? 'enabled' : 'disabled'}`,
    `- **Process Memory:** RSS ${meta.memory.rssEndMB} MB | Heap ${meta.memory.heapUsedMB}/${meta.memory.heapTotalMB} MB`,
    '',
  ];

  let lastSection = '';
  for (const r of allResults) {
    if (r.section !== lastSection) {
      lastSection = r.section;
      mdLines.push(`## ${r.section}`, '');
      mdLines.push('| Test | Time/op | Throughput |');
      mdLines.push('|------|---------|------------|');
    }
    mdLines.push(`| ${r.label} | ${formatTime(r.msPerOp)} | ${formatOps(r.opsPerSec)} |`);
  }

  // Summary table
  mdLines.push('', '## Summary — Key Metrics', '');
  mdLines.push('| Metric | Value |');
  mdLines.push('|--------|-------|');

  const find = (section, label) => allResults.find((r) => r.section === section && r.label === label);

  const smallReq = find('handleRequest — Full Pipeline', 'Small body (5 fields)');
  const medReq = find('handleRequest — Full Pipeline', 'Medium body (20 fields)');
  const skipHit = find('handleRequest — Full Pipeline', 'skipRoute hit (exact)');
  const emailCheck = find('Helpers & Type Checks', 'isEmail (valid)');
  const noLimit = find('maxDepth Impact', 'Depth 5×3 — no limit');
  const depth1 = find('maxDepth Impact', 'Depth 5×3 — maxDepth=1');

  if (smallReq)
    mdLines.push(
      `| Small request (5 fields) | ${formatOps(smallReq.opsPerSec)} (${formatTime(smallReq.msPerOp)}/req) |`,
    );
  if (medReq)
    mdLines.push(`| Medium request (20 fields) | ${formatOps(medReq.opsPerSec)} (${formatTime(medReq.msPerOp)}/req) |`);
  if (skipHit) mdLines.push(`| skipRoute hit (zero-cost) | ${formatOps(skipHit.opsPerSec)} |`);
  if (emailCheck) mdLines.push(`| isEmail check | ${formatOps(emailCheck.opsPerSec)} |`);
  if (noLimit && depth1)
    mdLines.push(`| maxDepth=1 speedup | ${(depth1.opsPerSec / noLimit.opsPerSec).toFixed(1)}x faster |`);

  mdLines.push('');

  const mdPath = path.join(RESULTS_DIR, `${ts}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n'));

  console.log(`  ✅ Saved JSON: ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`  ✅ Saved Markdown: ${path.relative(process.cwd(), mdPath)}`);

  // Update latest symlinks
  const latestJson = path.join(RESULTS_DIR, 'latest.json');
  const latestMd = path.join(RESULTS_DIR, 'latest.md');
  fs.copyFileSync(jsonPath, latestJson);
  fs.copyFileSync(mdPath, latestMd);
  console.log(`  ✅ Updated latest.json / latest.md`);
}

if (COMPARE && previousResults) {
  console.log('');
  console.log('  Comparison Legend: 🟢 faster  🔴 slower  ~same (<1% diff)');
}

console.log('');
console.log('  Usage:');
console.log('    node benchmarks/index.js              # Console output only');
console.log('    node benchmarks/index.js --save       # Save JSON + Markdown report');
console.log('    node benchmarks/index.js --compare    # Compare with last saved result');
console.log('    node benchmarks/index.js --save --compare  # Both');
console.log('    node --expose-gc benchmarks/index.js --save # Most accurate');
console.log('');
