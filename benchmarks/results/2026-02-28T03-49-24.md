# Benchmark Results

- **Date:** 2026-02-28T03:49:24.988Z
- **Node.js:** v24.12.0
- **Platform:** darwin arm64
- **CPU:** Apple M4 Pro (14 cores)
- **RAM:** 24576 MB total / 688 MB free
- **GC:** enabled
- **Process Memory:** RSS 73 MB | Heap 8.3/21.1 MB

## resolveOptions — Init Cost

| Test | Time/op | Throughput |
|------|---------|------------|
| Default options | 1.0 μs | 1.03M ops/s |
| With skipRoutes (5 strings) | 0.001 ms | 947.49K ops/s |
| With skipRoutes (5 regex) | 1.0 μs | 1.04M ops/s |
| With all options | 1.0 μs | 1.00M ops/s |
## sanitizeString

| Test | Time/op | Throughput |
|------|---------|------------|
| Clean string (no match) | 0.0 μs | 34.11M ops/s |
| Dirty string ($prefix) | 0.0 μs | 26.97M ops/s |
| Email (fast-path skip) | 0.0 μs | 32.00M ops/s |
| Long string 1KB | 0.7 μs | 1.38M ops/s |
| Long string 10KB | 0.005 ms | 191.06K ops/s |
## sanitizeValue — Objects

| Test | Time/op | Throughput |
|------|---------|------------|
| Flat 5 fields | 0.001 ms | 888.18K ops/s |
| Flat 20 fields | 0.005 ms | 200.42K ops/s |
| Flat 100 fields | 0.024 ms | 40.89K ops/s |
| Nested 3×3 (~39 fields) | 0.007 ms | 147.50K ops/s |
| Nested 3×5 (~155 fields) | 0.025 ms | 40.81K ops/s |
| Nested 4×5 (~780 fields) | 0.120 ms | 8.37K ops/s |
| Mixed 50 (strings/nums/nulls/emails) | 0.007 ms | 135.36K ops/s |
## sanitizeValue — Arrays

| Test | Time/op | Throughput |
|------|---------|------------|
| String array (10 items) | 0.3 μs | 2.86M ops/s |
| String array (100 items) | 0.003 ms | 299.58K ops/s |
| Mixed array (50 items) | 0.6 μs | 1.58M ops/s |
| Object array (20 items) | 0.006 ms | 154.00K ops/s |
| With filterNull+distinct | 0.002 ms | 440.40K ops/s |
## handleRequest — Full Pipeline

| Test | Time/op | Throughput |
|------|---------|------------|
| Small body (5 fields) | 0.001 ms | 717.11K ops/s |
| Medium body (20 fields) | 0.005 ms | 193.22K ops/s |
| Large body (100 fields) | 0.023 ms | 43.25K ops/s |
| Nested body (3×5, ~155 fields) | 0.025 ms | 39.87K ops/s |
| With maxDepth=2 | 0.011 ms | 91.46K ops/s |
| skipRoute hit (exact) | 0.6 μs | 1.63M ops/s |
| skipRoute hit (regex) | 0.7 μs | 1.52M ops/s |
## shouldSkipRoute

| Test | Time/op | Throughput |
|------|---------|------------|
| Exact match (10 routes, hit) | 0.0 μs | 34.55M ops/s |
| Exact match (10 routes, miss) | 0.0 μs | 31.85M ops/s |
| Regex match (3 patterns, hit) | 0.1 μs | 12.64M ops/s |
| Regex match (3 patterns, miss) | 0.1 μs | 18.41M ops/s |
| Mixed (4 routes, exact hit) | 0.0 μs | 30.42M ops/s |
| Mixed (4 routes, regex hit) | 0.1 μs | 19.54M ops/s |
| Mixed (4 routes, miss) | 0.0 μs | 21.42M ops/s |
## Helpers & Type Checks

| Test | Time/op | Throughput |
|------|---------|------------|
| isPlainObject (regular) | 0.0 μs | 122.57M ops/s |
| isPlainObject (null-proto) | 0.0 μs | 74.35M ops/s |
| isPlainObject (fastify 2-level) | 0.0 μs | 134.60M ops/s |
| isObjectEmpty (empty) | 0.0 μs | 159.14M ops/s |
| isObjectEmpty (non-empty) | 0.0 μs | 79.24M ops/s |
| isEmail (valid) | 0.0 μs | 35.39M ops/s |
| isEmail (invalid — no @) | 0.0 μs | 126.77M ops/s |
| isEmail (number) | 0.0 μs | 319.74M ops/s |
| cleanUrl (with query) | 0.0 μs | 42.74M ops/s |
| extractMimeType (with charset) | 0.0 μs | 37.04M ops/s |
## maxDepth Impact

| Test | Time/op | Throughput |
|------|---------|------------|
| Depth 5×3 — no limit | 0.054 ms | 18.40K ops/s |
| Depth 5×3 — maxDepth=1 | 0.020 ms | 50.34K ops/s |
| Depth 5×3 — maxDepth=2 | 0.020 ms | 49.76K ops/s |
| Depth 5×3 — maxDepth=3 | 0.022 ms | 45.62K ops/s |
## Feature Overhead (20 fields)

| Test | Time/op | Throughput |
|------|---------|------------|
| Baseline (default) | 0.005 ms | 206.65K ops/s |
| + stringOptions (trim+lower+max) | 0.004 ms | 233.37K ops/s |
| + removeMatches | 0.003 ms | 380.78K ops/s |
| + removeEmpty | 0.004 ms | 246.67K ops/s |
| + allowedKeys (5 keys) | 0.002 ms | 510.65K ops/s |
| + onSanitize callback | 0.004 ms | 248.82K ops/s |

## Summary — Key Metrics

| Metric | Value |
|--------|-------|
| Small request (5 fields) | 717.11K ops/s (0.001 ms/req) |
| Medium request (20 fields) | 193.22K ops/s (0.005 ms/req) |
| skipRoute hit (zero-cost) | 1.63M ops/s |
| isEmail check | 35.39M ops/s |
| maxDepth=1 speedup | 2.7x faster |
