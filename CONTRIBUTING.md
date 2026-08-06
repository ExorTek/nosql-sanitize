# Contributing to `nosql-sanitize`

Thanks for looking at the code. This document is the shortcut so you don't have to reverse-engineer conventions from the
git log. Keep it open in a tab while you work.

## The packages

A Yarn-workspaces monorepo of three published packages under the `@exortek/*` scope:

| Package                           | What it is                                                 |
|-----------------------------------|------------------------------------------------------------|
| `@exortek/nosql-sanitize-core`    | Framework-agnostic sanitization engine. No framework deps. |
| `@exortek/express-mongo-sanitize` | Express 4/5 middleware wrapping the core engine.           |
| `@exortek/fastify-mongo-sanitize` | Fastify 4/5 plugin wrapping the core engine.               |

`test-servers/` is a private, unpublished workspace: real Express/Fastify apps (v4 + v5) used by the integration suite.

## Prerequisites

| Tool    | Version            | Why                                                                           |
|---------|--------------------|-------------------------------------------------------------------------------|
| Node.js | **20.x or newer**  | Native test runner (`node --test`). Packages themselves support Node `>=18`.  |
| Yarn    | **4.x (Corepack)** | The repo pins `packageManager` in `package.json`. Run `corepack enable` once. |
| Git     | any recent         | Standard.                                                                     |

## Getting set up

```bash
git clone https://github.com/ExorTek/nosql-sanitize.git
cd nosql-sanitize
corepack enable          # once per machine
yarn install
yarn test                # unit tests across every workspace
yarn test:servers        # Express 4/5 + Fastify 4/5 integration servers
```

If you're only touching one package:

```bash
yarn test:core           # or test:express / test:fastify
```

### Framework versions live at the root

The aliased framework packages the tests need — `express` (v5), `express4`, `fastify` (v5), `fastify4` — are declared
**once, in the root `package.json` `devDependencies`**, not inside the publishable packages. The package tests
`require('express')` / `require('express4')` / `require('fastify')` / `require('fastify4')` and resolve them through
workspace hoisting. Do **not** re-add these to `packages/*/package.json`: they are test tooling, and a published package
should not advertise a dev-only framework alias. `test-servers` keeps its own `express4/5` + `fastify4/5` because it is a
private workspace that imports them at runtime.

## Branch naming

One prefix per branch, matching the intent of the change.

| Prefix      | Use for                                    | Example                         |
|-------------|--------------------------------------------|---------------------------------|
| `feat/`     | New user-visible functionality.            | `feat/allowed-keys-glob`        |
| `fix/`      | Bug fixes.                                 | `fix/array-index-path`          |
| `refactor/` | Internal cleanup, no behaviour change.     | `refactor/centralize-guards`    |
| `perf/`     | Performance work with no behaviour change. | `perf/sanitize-object-loop`     |
| `docs/`     | README, CONTRIBUTING, JSDoc.               | `docs/express-readme`           |
| `test/`     | Test-only additions or reshuffles.         | `test/fastify5-content-type`    |
| `chore/`    | Repo housekeeping — CI, deps, config.      | `chore/hoist-framework-devdeps` |

Keep branch names lower-kebab-case.

## Commit messages

We follow [Conventional Commits](https://www.conventionalcommits.org). One concern per commit. Present tense.

```
<type>(<scope>): <summary>

<body — what and why, wrapped at ~72 cols>
```

- **type** — `feat` · `fix` · `refactor` · `perf` · `docs` · `test` · `chore` · `ci`
- **scope** — the package or subsystem: `core`, `express`, `fastify`, `test-servers`, or omit for repo-wide work.

Avoid `wip`, `fixes stuff`, or squashing several unrelated changes into one commit. Split them.

## The change flow

1. **Branch off `master`.** Use a prefix above.
2. **Write code + tests.** New behaviour is added to `@exortek/nosql-sanitize-core` when it's framework-agnostic; the
   Express/Fastify packages should stay thin adapters over the core.
3. **Run the local gate before pushing:**
   ```bash
   yarn verify           # format:check + test + test:servers — the CI mirror
   ```
   Use `yarn format` to auto-fix formatting first.
4. **Push, open a PR.** Describe what changed and why. CI (`.github/workflows/ci.yml`) runs `yarn verify` on every push
   and PR.

## Testing

Every package uses **Node's native test runner** — no Jest, no Mocha, no Vitest.

- **Unit tests** — `packages/<name>/test/*.test.js`, run by that package's `test` script.
- **Integration** — `test-servers/` boots real Express 4/5 and Fastify 4/5 apps and asserts identical sanitization
  behaviour across all four. Run with `yarn test:servers`.

Cover the happy path plus one negative case per branch. A change to sanitization behaviour should touch both a core unit
test and, where the framework boundary matters, the integration servers.

## Style

- **Prettier** is the source of truth (`.prettierrc`): single quotes, `all` trailing commas, 120-col, 2-space indent.
  Run `yarn format` (write) or `yarn format:check` (CI gate).
- **Errors** — throw `NoSQLSanitizeError` with a stable `code`. Never string-match error messages downstream.
- **CommonJS.** Packages ship `src/` directly (`"type": "commonjs"`); there is no build step.

## Publishing

Releases are **manual** and run from `master`:

1. Bump versions across the workspaces (`yarn version:all` or edit `package.json` versions deliberately).
2. Publish via the **Release** GitHub Actions workflow (`.github/workflows/release.yml`) — Actions tab → Release →
   "Run workflow" — or, as a local fallback, `yarn publish:all`.

Do not publish from a feature branch.

## Reporting security issues

Please **do not** file a public GitHub issue for a security bug. See [`SECURITY.md`](./SECURITY.md) — open a private
GitHub Security Advisory or email [`memet@memet.dev`](mailto:memet@memet.dev).
