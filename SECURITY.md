# Security policy

## Supported versions

`@exortek/*` packages follow **semver**. Security fixes land on the current major line of each package; older major
lines are not patched unless the project makes an explicit LTS commitment (none does today).

| Package                           | Supported       |
|-----------------------------------|-----------------|
| `@exortek/nosql-sanitize-core`    | `3.x` — current |
| `@exortek/express-mongo-sanitize` | `3.x` — current |
| `@exortek/fastify-mongo-sanitize` | `3.x` — current |

## Reporting a vulnerability

**Do NOT open a public GitHub issue** for anything that could give an attacker a foothold.

### Preferred — GitHub Security Advisories

Use GitHub's private advisory flow:

**<https://github.com/ExorTek/nosql-sanitize/security/advisories/new>**

This routes the report privately to the maintainers, tracks fix progress, and eventually assigns a CVE if warranted.

### Fallback — email

If GitHub advisories don't work for you, send the report to:

**`memet@memet.dev`**

Please **use plain text** — encrypted mail is welcome but not required. Include:

- Affected package(s) + version(s)
- Node.js version, framework (Express / Fastify) + version, and operating system
- A description of the issue and the impact you're worried about
- A proof-of-concept or minimal reproduction, if you have one

If you'd like credit in the eventual advisory, tell us the name / handle to use. If you'd rather stay anonymous, we'll
keep you off the credits.

## What to expect

- **Acknowledgement:** within **72 hours** of receipt (usually much faster).
- **Triage:** we'll confirm whether we can reproduce, agree on severity, and share a rough timeline within **7 days**.
- **Fix window:** we aim to publish a patched release within **30 days** of triage for confirmed high/critical issues,
  longer for low-severity ones.
- **Coordinated disclosure:** we publish the advisory once a fixed version is on npm. If you have a public disclosure
  date in mind (talk, blog post, etc.) tell us early — we'll do our best to align.

## Scope

**In scope**

- Any published `@exortek/*` package listed under "Supported versions".
- A **sanitizer bypass** — user input that reaches a MongoDB query with operator keys (`$`-prefixed), prototype-pollution
  keys (`__proto__` / `constructor` / `prototype`), or dotted keys still intact after the middleware has run.
- The build/publish pipeline (npm tarball contents, `files` integrity).

**Out of scope**

- **Third-party dependencies** — report those to their maintainers. Where a fix would land in one of our packages (e.g.
  we're pinning a known-vulnerable version), we do want to hear about it.
- **Misconfiguration on the consumer side** — e.g. mounting the middleware after the route that reads the body, or
  passing `allowedKeys` that deliberately re-permit operator keys. The documented behaviour is not a vulnerability.
- **NoSQL injection in code that never runs the sanitizer.** This library sanitizes request data at the framework
  boundary; it cannot protect a query built from a source it never saw.
- **Docs typos, missing pages, broken README tables.** Those go through the regular issue tracker.

## Hardening guarantees

Every package in this repository is written to hold these invariants. Deviations are treated as bugs and fall under the
reporting policy above.

- **Operator stripping is unconditional.** `$`-prefixed keys are removed or renamed (per the configured mode) at every
  depth of the payload — object bodies, nested objects, and array elements alike.
- **Prototype-pollution defence.** `__proto__` / `constructor` / `prototype` keys (`DANGEROUS_KEYS`) are dropped before
  any value is written back, so a crafted body cannot mutate `Object.prototype` through the sanitizer.
- **No `RegExp.lastIndex` leakage.** Shared pattern objects never carry state between calls — a global-flagged regex
  cannot make one request's match position bleed into the next (covered by a regression test).
- **Bounded recursion.** `maxDepth` caps traversal so a deeply-nested payload cannot exhaust the stack; the depth guard
  is enforced identically for objects and arrays.
- **Every failure carries a machine-readable code.** `NoSQLSanitizeError` exposes a stable `code` so callers branch on
  `code`, not on message text that can change across versions.
- **Framework-version parity.** The Express (4 + 5) and Fastify (4 + 5) integration suites (`yarn test:servers`) assert
  the same sanitization outcome across every supported framework major, so a bypass cannot hide behind one adapter.

## Safe-harbour

If you're testing in **good faith** against your own installation of our packages, we consider your research authorised:

- Only test against installations you control.
- Do not access or modify data that isn't yours.
- Do not degrade service for other users.
- Do not disclose publicly until we've had a reasonable window (see fix window above) — or 90 days from initial triage,
  whichever comes first.

We won't pursue legal action against researchers who play by these rules. We can't extend safe-harbour to third parties
whose systems happen to run our code, so please don't test against them.
