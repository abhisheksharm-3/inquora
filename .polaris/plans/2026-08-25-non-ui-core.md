# Inquora non-UI core: implementation plan, phases 0 and 1

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put quality guardrails in place, then rebuild the database as the foundation the
retrieval, transport and ingestion phases are built on.

**Architecture:** Strangler order. Phase 0 adds tests, formatting, layer boundaries and CI without
changing behaviour. Phase 1 drops the existing schema and rebuilds it with enums, triggers,
functions and RLS, so derived state is maintained by Postgres instead of by application code that
mostly does not run.

**Tech Stack:** Next.js 16, React 19.2, TypeScript 5, Supabase (Postgres 15 + pgvector), bun,
Vitest, pgTAP, ESLint 9 flat config, Prettier, GitHub Actions.

**Spec:** `.polaris/specs/2026-08-25-non-ui-core-design.md`
**Decisions:** `docs/adr/0001`–`0004`

## Global Constraints

- Package manager is **bun**. `bun.lock` is the only lockfile. Never run `npm install`.
- Embedding dimension is **1024** everywhere. The provider is the existing Hugging Face Space.
- Naming: non-component files `kebab-case` with a role suffix (`.service.ts`, `.repository.ts`,
  `.schema.ts`, `.types.ts`); components `PascalCase.tsx`; hooks `useThing.ts`. Types carry **no
  `Type` prefix**. Database identifiers are `snake_case`, tables plural, enums singular.
- Layer rule: `app → server/modules → server/platform → core`. `core/` performs no I/O.
- Standard before hand-rolled: HTTP status codes and RFC 9457 over invented error enums,
  `AbortSignal.timeout` over manual `AbortController` plumbing, `crypto.subtle.digest` over hash
  packages, Postgres `FOR UPDATE SKIP LOCKED` over queue services.
- Every SQL function is `security invoker` unless it must cross a trust boundary, and any
  `security definer` function sets `search_path = ''` explicitly.
- Every RLS policy wraps `auth.uid()` as `(select auth.uid())` so Postgres hoists it to an InitPlan
  and evaluates it once per query rather than once per row.
- Commits carry **no** `Co-Authored-By` trailer.
- Prose in commits, docs and comments follows `.polaris` writing rules: no "delve", "leverage",
  "seamless", "robust", "showcase"; no "not only X but also Y"; sentence case headings.

## File Structure

Phase 0 creates:

| Path | Responsibility |
|---|---|
| `.prettierrc.json` | formatting rules, referenced by `jsrepo.json` |
| `vitest.config.ts` | test runner config, `src/` alias |
| `src/core/result.ts` | `Result<T, E>` — the error-carrying return type used by every layer |
| `src/core/result.test.ts` | its tests |
| `src/core/errors.ts` | `AppError` carrying an HTTP status and an RFC 9457 problem shape |
| `src/core/errors.test.ts` | its tests |
| `.github/workflows/ci.yml` | typecheck, lint, format check, test, build |
| `eslint.config.mjs` (modify) | layer boundary rules |

Phase 1 creates:

| Path | Responsibility |
|---|---|
| `supabase/config.toml` | CLI project config |
| `supabase/migrations/0001_extensions_and_enums.sql` | extensions, enum types |
| `supabase/migrations/0002_profiles.sql` | profiles + `auth.users` trigger |
| `supabase/migrations/0003_documents_and_chunks.sql` | documents, chunks, indexes, count/status triggers |
| `supabase/migrations/0004_chats_and_messages.sql` | chats, chat_documents, messages, citations |
| `supabase/migrations/0005_rls.sql` | row-level security on every table |
| `supabase/migrations/0006_search_chunks.sql` | hybrid retrieval function |
| `supabase/migrations/0007_rpc.sql` | context, append, create, bulk-insert functions |
| `supabase/migrations/0008_ingestion_queue.sql` | job table, enqueue trigger, claim function |
| `supabase/tests/*.test.sql` | pgTAP coverage per migration |
| `src/core/database.types.ts` | generated, never hand-edited |
| `src/server/platform/db/client.ts` | server Supabase client |

---

# Phase 0: guardrails

No behaviour changes. Every task here must leave `bun run build` passing.

---

### Task 0.1: One lockfile, and remove dependencies nothing imports

**Files:**
- Delete: `package-lock.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a dependency list where every runtime entry is imported somewhere in `src/`

- [ ] **Step 1: Prove which dependencies are unimported**

Run this and keep the output; it is the evidence for the removals below.

```bash
python3 - <<'PY'
import json, subprocess, re
pkg = json.load(open('package.json'))
deps = list(pkg['dependencies'])
src = subprocess.run(
    ['grep', '-rhoE', r'''from ['"][^'"]+['"]|require\(['"][^'"]+['"]\)|import\(['"][^'"]+['"]\)''', 'src'],
    capture_output=True, text=True).stdout
mods = set(re.findall(r'''['"]([^'"]+)['"]''', src))
name = lambda m: '/'.join(m.split('/')[:2]) if m.startswith('@') else m.split('/')[0]
used = {name(m) for m in mods if not m.startswith(('.', '@/'))}
print('\n'.join(sorted(d for d in deps if d not in used)))
PY
```

Expected output includes `react-window`, `langchain`, `@langchain/google-genai`.

`langchain` and `@langchain/google-genai` are **kept** — ADR 0002 makes them the model layer in
Phase 3. `pdf-parse` will not appear because it is imported transitively; it is a peer dependency
of `@langchain/community`'s `PDFLoader` (`src/utils/processors/document-processor.ts:3`) and must
stay.

- [ ] **Step 2: Remove the dead packages**

```bash
bun remove react-window @types/react-window @types/react-syntax-highlighter @types/cheerio
rm -f package-lock.json
```

`@types/react-syntax-highlighter` types a package that is not installed — the repo renders code
with `rehype-highlight`. `@types/cheerio` is redundant because cheerio v1 ships its own types.

- [ ] **Step 3: Rename the component whose name is now a lie**

`src/components/history/VirtualizedChatList.tsx` does not virtualize; it paginates with
`ITEMS_PER_PAGE = 20`. With `react-window` gone the name misleads outright.

```bash
git mv src/components/history/VirtualizedChatList.tsx src/components/history/PaginatedChatList.tsx
grep -rl "VirtualizedChatList" src | xargs sed -i '' 's/VirtualizedChatList/PaginatedChatList/g'
```

- [ ] **Step 4: Verify the build still passes**

Run: `bun run build`
Expected: build completes with no module-resolution errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: keep one lockfile, and drop packages nothing imports

react-window was declared but never imported, and the component named for it
paginates twenty at a time rather than virtualizing, so the name is now accurate
too. The two @types entries described packages that are not installed. Removing
package-lock.json leaves bun.lock as the single source of install truth."
```

---

### Task 0.2: Prettier, which `jsrepo.json` already assumes exists

**Files:**
- Create: `.prettierrc.json`, `.prettierignore`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: `bun run format` and `bun run format:check` scripts, used by CI in Task 0.5

- [ ] **Step 1: Install Prettier**

`jsrepo.json` already declares `"formatter": "prettier"` while the package is absent.

```bash
bun add -d prettier
```

- [ ] **Step 2: Write the config**

Create `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always"
}
```

Create `.prettierignore`:

```
.next
node_modules
bun.lock
src/core/database.types.ts
supabase/.temp
public
```

`database.types.ts` is generated in Task 1.10 and must not be reformatted, or every regeneration
produces a spurious diff.

- [ ] **Step 3: Add the scripts**

In `package.json`, add to `"scripts"`:

```json
"format": "prettier --write .",
"format:check": "prettier --check .",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Format the repository once**

Run: `bun run format`
Then: `bun run build`
Expected: build passes. Formatting is whitespace-only; if the build breaks, revert and investigate
before continuing.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: install the formatter jsrepo.json already expects

jsrepo.json has declared prettier as its formatter while prettier was not a
dependency, so nothing enforced a style. The generated database types file is
ignored so regeneration does not produce formatting diffs."
```

---

### Task 0.3: Vitest, and the first two `core/` modules under test

**Files:**
- Create: `vitest.config.ts`, `src/core/result.ts`, `src/core/result.test.ts`,
  `src/core/errors.ts`, `src/core/errors.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }`
  - `ok<T>(value: T): Result<T, never>`
  - `err<E>(error: E): Result<never, E>`
  - `isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T }`
  - `class AppError extends Error` with `status: number`, `type: string`, `detail?: string`
  - `AppError.notFound(detail?)`, `.conflict(detail?)`, `.rateLimited(retryAfterSeconds, detail?)`,
    `.badGateway(detail?)`
  - `toProblemDetails(e: AppError, instance: string): ProblemDetails`

  Every later phase returns `Result` across layer boundaries rather than throwing.

- [ ] **Step 1: Install Vitest and write its config**

```bash
bun add -d vitest @vitejs/plugin-react vite-tsconfig-paths
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: { reporter: ["text", "lcov"], include: ["src/core/**", "src/server/**"] },
  },
});
```

Add to `package.json` scripts:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: Write the failing tests for `Result`**

Create `src/core/result.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { err, isOk, ok, unwrapOr, type Result } from "./result";

describe("Result", () => {
  it("wraps a success value", () => {
    const r = ok(42);
    expect(r).toEqual({ ok: true, value: 42 });
  });

  it("wraps a failure value", () => {
    const r = err("boom");
    expect(r).toEqual({ ok: false, error: "boom" });
  });

  it("narrows the type through isOk", () => {
    const r: Result<number, string> = ok(1);
    if (isOk(r)) {
      expect(r.value + 1).toBe(2);
    } else {
      throw new Error("isOk should have narrowed to the success branch");
    }
  });

  it("returns the fallback for a failure", () => {
    expect(unwrapOr(err("boom") as Result<number, string>, 7)).toBe(7);
  });

  it("returns the value for a success", () => {
    expect(unwrapOr(ok(3) as Result<number, string>, 7)).toBe(3);
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test src/core/result.test.ts`
Expected: FAIL — `Failed to resolve import "./result"`.

- [ ] **Step 4: Implement `Result`**

Create `src/core/result.ts`:

```ts
/**
 * The return type used across layer boundaries. Errors travel as values so a
 * caller cannot ignore one by forgetting a try/catch.
 */
export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

export const isOk = <T, E>(r: Result<T, E>): r is { ok: true; value: T } => r.ok;

export const unwrapOr = <T, E>(r: Result<T, E>, fallback: T): T => (r.ok ? r.value : fallback);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/core/result.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 6: Write the failing tests for `AppError`**

Create `src/core/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { AppError, toProblemDetails } from "./errors";

describe("AppError", () => {
  it("carries the HTTP status for a missing resource", () => {
    const e = AppError.notFound("no chunk matched the query");
    expect(e.status).toBe(404);
    expect(e.detail).toBe("no chunk matched the query");
  });

  it("carries a conflict for a document that is still processing", () => {
    expect(AppError.conflict("3 of 41 chunks indexed").status).toBe(409);
  });

  it("records the retry delay for a rate limit", () => {
    const e = AppError.rateLimited(30);
    expect(e.status).toBe(429);
    expect(e.retryAfterSeconds).toBe(30);
  });

  it("reports an upstream provider failure as a bad gateway", () => {
    expect(AppError.badGateway().status).toBe(502);
  });

  it("serializes to an RFC 9457 problem document", () => {
    const e = AppError.conflict("still processing");
    expect(toProblemDetails(e, "/api/chats/abc/messages")).toEqual({
      type: "/errors/conflict",
      title: "Conflict",
      status: 409,
      detail: "still processing",
      instance: "/api/chats/abc/messages",
    });
  });
});
```

- [ ] **Step 7: Run the tests to verify they fail**

Run: `bun run test src/core/errors.test.ts`
Expected: FAIL — `Failed to resolve import "./errors"`.

- [ ] **Step 8: Implement `AppError`**

Create `src/core/errors.ts`:

```ts
/** RFC 9457 problem document. Sent as `application/problem+json`. */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance: string;
}

const TITLES: Record<number, string> = {
  404: "Not Found",
  409: "Conflict",
  429: "Too Many Requests",
  502: "Bad Gateway",
};

/**
 * An error that already knows its HTTP status. The transport layer serializes it
 * rather than translating a private error vocabulary into one.
 */
export class AppError extends Error {
  readonly status: number;
  readonly type: string;
  readonly detail?: string;
  readonly retryAfterSeconds?: number;

  private constructor(
    status: number,
    type: string,
    detail?: string,
    retryAfterSeconds?: number,
  ) {
    super(detail ?? TITLES[status] ?? "Error");
    this.name = "AppError";
    this.status = status;
    this.type = type;
    this.detail = detail;
    this.retryAfterSeconds = retryAfterSeconds;
  }

  static notFound = (detail?: string) => new AppError(404, "/errors/not-found", detail);
  static conflict = (detail?: string) => new AppError(409, "/errors/conflict", detail);
  static rateLimited = (retryAfterSeconds: number, detail?: string) =>
    new AppError(429, "/errors/rate-limited", detail, retryAfterSeconds);
  static badGateway = (detail?: string) => new AppError(502, "/errors/bad-gateway", detail);
}

export const toProblemDetails = (e: AppError, instance: string): ProblemDetails => ({
  type: e.type,
  title: TITLES[e.status] ?? "Error",
  status: e.status,
  ...(e.detail === undefined ? {} : { detail: e.detail }),
  instance,
});
```

- [ ] **Step 9: Run the whole suite**

Run: `bun run test`
Expected: PASS, 10 tests across two files.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "test: add the runner, and the two core types every layer returns

Result carries errors as values so a caller cannot drop one by forgetting a
catch. AppError carries its own HTTP status and serializes to an RFC 9457
problem document, so the transport layer reports a conflict as 409 rather than
translating a private error vocabulary into one."
```

---

### Task 0.4: Layer boundaries enforced by lint

**Files:**
- Modify: `eslint.config.mjs`
- Create: `src/server/.gitkeep`, `src/server/modules/.gitkeep`, `src/server/platform/.gitkeep`

**Interfaces:**
- Consumes: `src/core/` from Task 0.3
- Produces: a lint error on any import that runs against
  `app → server/modules → server/platform → core`

- [ ] **Step 1: Install the plugin and create the directories**

```bash
bun add -d eslint-plugin-boundaries
mkdir -p src/server/modules src/server/platform
touch src/server/modules/.gitkeep src/server/platform/.gitkeep
```

- [ ] **Step 2: Add the boundary rules**

Append to the exported array in `eslint.config.mjs`:

```js
import boundaries from "eslint-plugin-boundaries";

// ... existing config entries ...

{
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "boundaries/elements": [
      { type: "app", pattern: "src/app/**" },
      { type: "ui", pattern: "src/ui/**" },
      { type: "modules", pattern: "src/server/modules/**" },
      { type: "platform", pattern: "src/server/platform/**" },
      { type: "core", pattern: "src/core/**" },
    ],
  },
  rules: {
    "boundaries/element-types": [
      "error",
      {
        default: "disallow",
        rules: [
          { from: "app", allow: ["ui", "modules", "core"] },
          { from: "ui", allow: ["core"] },
          { from: "modules", allow: ["modules", "platform", "core"] },
          { from: "platform", allow: ["platform", "core"] },
          { from: "core", allow: ["core"] },
        ],
      },
    ],
  },
},
```

`core` may import only `core`, which is what keeps it free of I/O. `ui` reaching `modules` is
disallowed, so a component cannot call a repository directly.

- [ ] **Step 3: Verify the rule actually fires**

The rule governs imports between internal element types, not third-party packages, so the check
must use an internal import that crosses a layer the wrong way — `core` reaching into `platform`.

```bash
mkdir -p src/core/__scratch src/server/platform/env
cat > src/server/platform/env/index.ts <<'EOF'
export const env = { placeholder: true };
EOF
cat > src/core/__scratch/violation.ts <<'EOF'
import { env } from "@/server/platform/env";
export const x = env;
EOF
```

Run: `bunx eslint src/core/__scratch/violation.ts`
Expected: FAIL — `No rule allowing this dependency was found. File is of type 'core'`.

If it passes, the `boundaries/elements` patterns do not match your paths. Fix them before
continuing; a boundary rule that never fires is worse than none, because it reads as a guarantee.

- [ ] **Step 4: Remove the scratch file and lint the repository**

```bash
rm -rf src/core/__scratch src/server/platform/env
```

Run: `bunx eslint src`
Expected: the existing `src/utils`, `src/data`, `src/services` trees are not yet mapped to an
element type, so they are unconstrained and lint passes. They gain boundaries when Phase 5 moves
them.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: fail the lint when an import crosses a layer the wrong way

The dependency direction is app to modules to platform to core, and core imports
nothing but core. Making it a lint rule is what stops the convention decaying,
which is how src/utils grew into sixteen loose files and four subsystems."
```

---

### Task 0.5: CI that blocks a broken merge

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: the `typecheck`, `format:check`, `test` scripts from Tasks 0.2 and 0.3
- Produces: a required status check on pull requests

- [ ] **Step 1: Write the workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: ci

on:
  push:
    branches: [main]
  pull_request:

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Check formatting
        run: bun run format:check

      - name: Lint
        run: bunx eslint src

      - name: Typecheck
        run: bun run typecheck

      - name: Test
        run: bun run test

      - name: Build
        run: bun run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
          NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder-anon-key
```

The build step needs the two `NEXT_PUBLIC_*` values because `src/config/env.ts` validates them at
module load and throws otherwise. They are placeholders; no build-time request is made with them.

- [ ] **Step 2: Verify each step passes locally before pushing**

```bash
bun install --frozen-lockfile
bun run format:check
bunx eslint src
bun run typecheck
bun run test
bun run build
```

Expected: all six succeed. If `typecheck` fails on pre-existing errors, fix them in this task —
CI cannot be green-on-arrival otherwise, and a red-from-day-one check gets ignored.

- [ ] **Step 3: Commit and push**

```bash
git add -A
git commit -m "ci: block a merge that does not format, lint, typecheck, test and build

The repository has had no automated check of any kind, so every guarantee added
in this phase depended on someone remembering to run it."
git push
```

- [ ] **Step 4: Confirm the run is green**

Run: `gh run watch`
Expected: the `check` job completes successfully.

- [ ] **Step 5: Make it required**

Run: `gh api repos/:owner/:repo/branches/main/protection/required_status_checks -X PATCH -f 'contexts[]=check'`

If branch protection is not configured on this repository, set it in the GitHub UI under Settings →
Branches, requiring the `check` status. Note in the PR which was done.

---

# Phase 1: database

**This phase drops the existing schema.** The user waived the data (8 users, 241 documents, 163
chats, 851 messages, 2 memories) on 2026-08-25. Task 1.1 takes a dump anyway.

---

### Task 1.1: Supabase CLI, project link, and a backup taken before anything is dropped

**Files:**
- Create: `supabase/config.toml` (by the CLI), `.gitignore` (modify)

**Interfaces:**
- Consumes: nothing
- Produces: a linked local Supabase project and a dump at
  `~/backups/inquora-pre-rebuild-2026-08-25.sql`, outside the repository

- [ ] **Step 1: Install the CLI and initialize**

The CLI is not currently installed on this machine.

```bash
bun add -d supabase
bunx supabase init
```

This creates `supabase/config.toml` and `supabase/.temp/`.

- [ ] **Step 2: Ignore the CLI's local state**

Append to `.gitignore`:

```
supabase/.temp/
supabase/.branches/
```

- [ ] **Step 3: Link to the remote project**

The project ref is `nujgeowsnjculknvimbh` (from `next.config.ts` image `remotePatterns`).

```bash
bunx supabase link --project-ref nujgeowsnjculknvimbh
```

The CLI prompts for the database password. It is not in this repository — take it from the Supabase
dashboard under Settings → Database.

- [ ] **Step 4: Take the backup**

```bash
mkdir -p ~/backups
bunx supabase db dump --linked --data-only -f ~/backups/inquora-data-2026-08-25.sql
bunx supabase db dump --linked -f ~/backups/inquora-schema-2026-08-25.sql
```

Verify both files are non-empty and outside the repository:

```bash
wc -l ~/backups/inquora-*-2026-08-25.sql
git status --porcelain | grep backups && echo "ERROR: backup is inside the repo" || echo "ok"
```

Expected: both files have content; the second command prints `ok`.

- [ ] **Step 5: Start the local stack and confirm it runs**

```bash
bunx supabase start
```

Expected: prints local API URL, anon key and service role key. Keep this terminal output — the
local anon key is needed to verify RLS in Task 1.6.

- [ ] **Step 6: Commit**

```bash
git add supabase/config.toml .gitignore package.json bun.lock
git commit -m "chore: track the schema in the repository instead of only in the cloud

The database has had no migrations checked in, so its shape existed in exactly
one place and drifted from the types the application declares. A dump of the
current data and schema is taken outside the repository before the rebuild."
```

---

### Task 1.2: Extensions and enum types

**Files:**
- Create: `supabase/migrations/0001_extensions_and_enums.sql`,
  `supabase/tests/0001_enums.test.sql`

**Interfaces:**
- Consumes: nothing
- Produces: enum types `document_kind`, `processing_status`, `message_role`; extensions `vector`,
  `pg_trgm`, `unaccent`, `moddatetime`, `pgtap`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0001_enums.test.sql`:

```sql
begin;
select plan(7);

select has_type('public', 'document_kind', 'document_kind enum exists');
select has_type('public', 'processing_status', 'processing_status enum exists');
select has_type('public', 'message_role', 'message_role enum exists');

select is(
  enum_range(null::public.document_kind)::text,
  '{pdf,doc,sheet,slides,image,video,github,web}',
  'document_kind covers every content type the product ingests'
);
select is(
  enum_range(null::public.processing_status)::text,
  '{pending,processing,ready,failed}',
  'processing_status covers the ingestion lifecycle'
);
select is(
  enum_range(null::public.message_role)::text,
  '{user,assistant}',
  'message_role covers both speakers'
);

select has_extension('extensions', 'vector', 'pgvector is installed');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `type "public.document_kind" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0001_extensions_and_enums.sql`:

```sql
-- Extensions live in the `extensions` schema so they are not dumped into `public`.
create schema if not exists extensions;

create extension if not exists vector       with schema extensions;
create extension if not exists pg_trgm      with schema extensions;
create extension if not exists unaccent     with schema extensions;
create extension if not exists moddatetime  with schema extensions;
create extension if not exists pgtap        with schema extensions;

-- Enums replace the free-text `type` and `processing_status` columns of the old
-- schema, where `files` said 'youtube' while `chats` said 'video' for the same
-- concept, and 'doc' and 'docs' both existed, with no constraint to stop either.
create type public.document_kind as enum
  ('pdf', 'doc', 'sheet', 'slides', 'image', 'video', 'github', 'web');

create type public.processing_status as enum
  ('pending', 'processing', 'ready', 'failed');

create type public.message_role as enum ('user', 'assistant');
```

- [ ] **Step 4: Apply and re-run the test**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_extensions_and_enums.sql supabase/tests/0001_enums.test.sql
git commit -m "feat(db): give the document kinds and statuses a type the database enforces

The old columns were free text, which is how files came to say youtube while
chats said video for the same twenty-nine rows, and how both doc and docs ended
up in the same column."
```

---

### Task 1.3: Profiles, created by a trigger on `auth.users`

**Files:**
- Create: `supabase/migrations/0002_profiles.sql`, `supabase/tests/0002_profiles.test.sql`

**Interfaces:**
- Consumes: extensions from Task 1.2
- Produces: table `public.profiles (id uuid pk → auth.users, display_name text, created_at, updated_at)`;
  trigger `on_auth_user_created`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0002_profiles.test.sql`:

```sql
begin;
select plan(5);

select has_table('public', 'profiles', 'profiles table exists');
select col_is_pk('public', 'profiles', 'id', 'profiles is keyed by the auth user id');

-- Inserting an auth user must produce a profile with no application involvement.
insert into auth.users (id, instance_id, aud, role, email, raw_user_meta_data)
values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', 'trigger-test@example.com',
  '{"full_name": "Trigger Test"}'::jsonb
);

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  1,
  'a new auth user gets exactly one profile'
);

select is(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Trigger Test',
  'the display name is taken from the auth metadata'
);

-- Deleting the auth user must remove the profile.
delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting the auth user cascades to the profile'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `relation "public.profiles" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0002_profiles.sql`:

```sql
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is
  'One row per auth user. Replaces the standalone public.users table, which '
  'duplicated identity Supabase already owns and had no cascade to it.';

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function extensions.moddatetime (updated_at);

-- security definer because it writes public.profiles while running in the auth
-- schema's insert path. search_path is pinned to empty so an attacker cannot
-- shadow a function name it resolves.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 12 tests total across both files.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0002_profiles.sql supabase/tests/0002_profiles.test.sql
git commit -m "feat(db): key profiles to auth.users so account deletion cascades

The old public.users table stood alongside auth.users with no relationship to
it, so identity lived in two places and deleting an account left rows behind.
Profile creation moves from the auth callback into a trigger, where it cannot
be skipped."
```

---

### Task 1.4: Documents and chunks, with counts and status maintained by triggers

**Files:**
- Create: `supabase/migrations/0003_documents_and_chunks.sql`,
  `supabase/tests/0003_documents.test.sql`

**Interfaces:**
- Consumes: enums from Task 1.2, `profiles` from Task 1.3
- Produces:
  - `public.documents (id, user_id, kind document_kind, title, byte_size, storage_path, source_url,
    status processing_status, error, chunk_count int, content_hash text, created_at, updated_at,
    indexed_at)`
  - `public.document_chunks (id, document_id, chunk_index, content, embedding vector(1024),
    token_count, tsv tsvector generated, metadata jsonb, created_at)`
  - unique `(user_id, content_hash)` on documents; unique `(document_id, chunk_index)` on chunks

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0003_documents.test.sql`:

```sql
begin;
select plan(6);

select has_table('public', 'documents', 'documents table exists');
select has_table('public', 'document_chunks', 'document_chunks table exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('22222222-2222-2222-2222-222222222222',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'doc-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('33333333-3333-3333-3333-333333333333',
        '22222222-2222-2222-2222-222222222222',
        'pdf', 'Fixture', 'hash-a', 'fixtures/a.pdf');

select is(
  (select status::text from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  'pending',
  'a new document starts pending'
);

insert into public.document_chunks (document_id, chunk_index, content, embedding)
values
  ('33333333-3333-3333-3333-333333333333', 0, 'the first chunk', array_fill(0.1::real, array[1024])::extensions.vector),
  ('33333333-3333-3333-3333-333333333333', 1, 'the second chunk', array_fill(0.2::real, array[1024])::extensions.vector);

select is(
  (select chunk_count from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  2,
  'chunk_count is maintained by the database, not by the application'
);

select is(
  (select status::text from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  'ready',
  'a document with chunks becomes ready without an application write'
);

delete from public.document_chunks where document_id = '33333333-3333-3333-3333-333333333333';

select is(
  (select chunk_count from public.documents where id = '33333333-3333-3333-3333-333333333333'),
  0,
  'deleting chunks decrements the count'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `relation "public.documents" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0003_documents_and_chunks.sql`:

```sql
create table public.documents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  kind         public.document_kind not null,
  title        text not null,
  byte_size    bigint,
  storage_path text,
  source_url   text,
  status       public.processing_status not null default 'pending',
  error        text,
  chunk_count  integer not null default 0,
  content_hash text not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  indexed_at   timestamptz,

  constraint documents_chunk_count_non_negative check (chunk_count >= 0),
  -- A document is either stored by us or fetched from a URL, never neither.
  constraint documents_has_a_source check (storage_path is not null or source_url is not null)
);

-- Re-uploading the same bytes reuses the existing chunks rather than paying to
-- embed them again.
create unique index documents_user_content_hash_key
  on public.documents (user_id, content_hash);

create index documents_user_created_idx on public.documents (user_id, created_at desc);

create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function extensions.moddatetime (updated_at);

create table public.document_chunks (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  chunk_index integer not null,
  content     text not null,
  embedding   extensions.vector(1024) not null,
  token_count integer,
  metadata    jsonb not null default '{}'::jsonb,
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  created_at  timestamptz not null default now(),

  constraint document_chunks_index_non_negative check (chunk_index >= 0),
  constraint document_chunks_content_not_blank check (length(btrim(content)) > 0)
);

create unique index document_chunks_document_index_key
  on public.document_chunks (document_id, chunk_index);

-- Indexing the half-precision cast halves index size and memory with recall
-- loss in the noise.
create index document_chunks_embedding_idx
  on public.document_chunks
  using hnsw ((embedding::extensions.halfvec(1024)) extensions.halfvec_cosine_ops);

create index document_chunks_tsv_idx on public.document_chunks using gin (tsv);

-- Derived state the application used to own and mostly failed to write: in the
-- old schema 213 of 241 files sat at 'idle' because the write-back rarely fired,
-- so every chat open re-derived the answer from the vector store instead.
create function public.sync_document_chunk_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid := coalesce(new.document_id, old.document_id);
  total     integer;
begin
  select count(*) into total
  from public.document_chunks
  where document_id = target_id;

  update public.documents
  set chunk_count = total,
      status      = case
                      when total > 0 and status <> 'failed' then 'ready'::public.processing_status
                      when total = 0 and status = 'ready'   then 'pending'::public.processing_status
                      else status
                    end,
      indexed_at  = case when total > 0 then now() else null end
  where id = target_id;

  return null;
end;
$$;

create trigger document_chunks_sync_count
  after insert or delete on public.document_chunks
  for each statement execute function public.sync_document_chunk_count();
```

Note the trigger is `for each statement`, not `for each row`: a bulk insert of 100 chunks runs the
recount once rather than a hundred times.

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 18 tests total.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0003_documents_and_chunks.sql supabase/tests/0003_documents.test.sql
git commit -m "feat(db): store chunks with their vectors, and let Postgres own the counts

Chunk count and ready status were application responsibilities that mostly did
not run, leaving 213 of 241 documents at idle and sending every chat open to the
vector store to re-derive what a column should have held. A statement-level
trigger now recounts once per insert rather than once per row."
```

---

### Task 1.5: Chats, the document join, messages and citations

**Files:**
- Create: `supabase/migrations/0004_chats_and_messages.sql`,
  `supabase/tests/0004_chats.test.sql`

**Interfaces:**
- Consumes: `profiles`, `documents`, `document_chunks`, `message_role`
- Produces:
  - `public.chats (id, user_id, title, created_at, updated_at)` — no `type`, no `file_id`
  - `public.chat_documents (chat_id, document_id, added_at)` — composite primary key
  - `public.messages (id, chat_id, role, content, tokens_in, tokens_out, latency_ms,
    retrieval_ms, model, created_at)`
  - `public.message_citations (message_id, chunk_id, rank)` — composite primary key

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0004_chats.test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'chat_documents', 'the chat-to-document join exists');
select hasnt_column('public', 'chats', 'file_id', 'chats no longer holds a single file');
select hasnt_column('public', 'chats', 'type', 'chats no longer duplicates the document kind');

insert into auth.users (id, instance_id, aud, role, email)
values ('44444444-4444-4444-4444-444444444444',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'chat-test@example.com');

insert into public.chats (id, user_id, title)
values ('55555555-5555-5555-5555-555555555555',
        '44444444-4444-4444-4444-444444444444', 'Fixture chat');

-- updated_at must move when a message arrives, or history sorts by creation and
-- an actively used old chat sinks to the bottom.
update public.chats
set updated_at = now() - interval '10 days'
where id = '55555555-5555-5555-5555-555555555555';

insert into public.messages (chat_id, role, content)
values ('55555555-5555-5555-5555-555555555555', 'user', 'hello');

select ok(
  (select updated_at from public.chats where id = '55555555-5555-5555-5555-555555555555')
    > now() - interval '1 minute',
  'a new message bumps the chat updated_at'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `relation "public.chat_documents" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0004_chats_and_messages.sql`:

```sql
create table public.chats (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  title      text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- History is ordered by last activity, which is what a user means by "recent".
create index chats_user_updated_idx on public.chats (user_id, updated_at desc);

create trigger chats_set_updated_at
  before update on public.chats
  for each row execute function extensions.moddatetime (updated_at);

-- The join that makes several documents in one chat an array parameter rather
-- than a rebuild.
create table public.chat_documents (
  chat_id     uuid not null references public.chats (id) on delete cascade,
  document_id uuid not null references public.documents (id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (chat_id, document_id)
);

create index chat_documents_document_idx on public.chat_documents (document_id);

create table public.messages (
  id            uuid primary key default gen_random_uuid(),
  chat_id       uuid not null references public.chats (id) on delete cascade,
  role          public.message_role not null,
  content       text not null,
  tokens_in     integer,
  tokens_out    integer,
  latency_ms    integer,
  retrieval_ms  integer,
  model         text,
  created_at    timestamptz not null default now()
);

create index messages_chat_created_idx on public.messages (chat_id, created_at);

-- Which passages an answer stood on. The old pipeline discarded chunk identity
-- the moment the prompt was assembled, so an answer could not cite its sources.
create table public.message_citations (
  message_id uuid not null references public.messages (id) on delete cascade,
  chunk_id   uuid not null references public.document_chunks (id) on delete cascade,
  rank       integer not null,
  primary key (message_id, chunk_id)
);

create index message_citations_chunk_idx on public.message_citations (chunk_id);

create function public.touch_chat_on_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.chats set updated_at = now() where id = new.chat_id;
  return null;
end;
$$;

create trigger messages_touch_chat
  after insert on public.messages
  for each row execute function public.touch_chat_on_message();

-- The old user_memories.user_id had no foreign key at all.
create table public.user_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index user_memories_user_idx on public.user_memories (user_id);

create trigger user_memories_set_updated_at
  before update on public.user_memories
  for each row execute function extensions.moddatetime (updated_at);
```

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 22 tests total.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0004_chats_and_messages.sql supabase/tests/0004_chats.test.sql
git commit -m "feat(db): let a chat hold several documents, and let an answer cite its sources

A chat pointed at one nullable file id, so multiple documents in one conversation
would have meant a rewrite rather than a join. Citations get their own table
because the old pipeline threw chunk identity away as soon as it built the
prompt. History now sorts by last activity, so a chat in daily use stops sinking
below one abandoned a year ago."
```

---

### Task 1.6: Row-level security on every table

**Files:**
- Create: `supabase/migrations/0005_rls.sql`, `supabase/tests/0005_rls.test.sql`

**Interfaces:**
- Consumes: every table from Tasks 1.3–1.5
- Produces: RLS enabled with owner-scoped policies; chunks and citations scoped through their
  parent

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0005_rls.test.sql`:

```sql
begin;
select plan(8);

select ok(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  'RLS is enabled on profiles');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.documents'::regclass),
  'RLS is enabled on documents');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.document_chunks'::regclass),
  'RLS is enabled on document_chunks');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.chats'::regclass),
  'RLS is enabled on chats');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.chat_documents'::regclass),
  'RLS is enabled on chat_documents');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.messages'::regclass),
  'RLS is enabled on messages');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.message_citations'::regclass),
  'RLS is enabled on message_citations');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.user_memories'::regclass),
  'RLS is enabled on user_memories');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — eight failures, RLS not enabled.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0005_rls.sql`:

```sql
alter table public.profiles          enable row level security;
alter table public.documents         enable row level security;
alter table public.document_chunks   enable row level security;
alter table public.chats             enable row level security;
alter table public.chat_documents    enable row level security;
alter table public.messages          enable row level security;
alter table public.message_citations enable row level security;
alter table public.user_memories     enable row level security;

-- auth.uid() is wrapped in a subselect throughout so Postgres hoists it into an
-- InitPlan and evaluates it once per query rather than once per row.

create policy profiles_owner on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy documents_owner on public.documents
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy chats_owner on public.chats
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy user_memories_owner on public.user_memories
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Child tables carry no user_id; they inherit ownership through their parent.

create policy document_chunks_via_document on public.document_chunks
  for all to authenticated
  using (exists (
    select 1 from public.documents d
    where d.id = document_chunks.document_id and d.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.documents d
    where d.id = document_chunks.document_id and d.user_id = (select auth.uid())));

create policy chat_documents_via_chat on public.chat_documents
  for all to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = chat_documents.chat_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.chats c
    where c.id = chat_documents.chat_id and c.user_id = (select auth.uid())));

create policy messages_via_chat on public.messages
  for all to authenticated
  using (exists (
    select 1 from public.chats c
    where c.id = messages.chat_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1 from public.chats c
    where c.id = messages.chat_id and c.user_id = (select auth.uid())));

create policy message_citations_via_message on public.message_citations
  for all to authenticated
  using (exists (
    select 1
    from public.messages m
    join public.chats c on c.id = m.chat_id
    where m.id = message_citations.message_id and c.user_id = (select auth.uid())))
  with check (exists (
    select 1
    from public.messages m
    join public.chats c on c.id = m.chat_id
    where m.id = message_citations.message_id and c.user_id = (select auth.uid())));
```

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 30 tests total.

- [ ] **Step 5: Verify isolation from the client side, not only the catalog**

The catalog test proves RLS is on; it does not prove the policies are right. Use the local anon key
printed by `supabase start` in Task 1.1.

```bash
ANON=<local anon key>
curl -s "http://127.0.0.1:54321/rest/v1/documents?select=id" \
  -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
```

Expected: `[]`. An anonymous caller sees no documents. If any row comes back, a policy is wrong —
stop and fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0005_rls.sql supabase/tests/0005_rls.test.sql
git commit -m "feat(db): scope every table to its owner, and verify it from the client side

Chunks and citations carry no user id, so they inherit ownership through their
parent document or chat. auth.uid() is wrapped in a subselect in every policy so
it is evaluated once per query rather than once per row."
```

---

### Task 1.7: `search_chunks`, hybrid retrieval in one call

**Files:**
- Create: `supabase/migrations/0006_search_chunks.sql`,
  `supabase/tests/0006_search_chunks.test.sql`

**Interfaces:**
- Consumes: `document_chunks` from Task 1.4
- Produces:
  ```
  public.search_chunks(
    p_document_ids uuid[],
    p_embedding    extensions.vector(1024),
    p_query        text,
    p_limit        integer default 12,
    p_k            integer default 60
  ) returns table (chunk_id uuid, document_id uuid, chunk_index integer,
                   content text, metadata jsonb, score real)
  ```
  Phase 2's `retrieval.repository.ts` calls this and nothing else.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0006_search_chunks.test.sql`:

```sql
begin;
select plan(3);

select has_function('public', 'search_chunks', 'search_chunks exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('66666666-6666-6666-6666-666666666666',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'search-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('77777777-7777-7777-7777-777777777777',
        '66666666-6666-6666-6666-666666666666',
        'pdf', 'Search fixture', 'hash-search', 'fixtures/search.pdf');

-- Two chunks with distinguishable vectors and distinguishable words.
insert into public.document_chunks (document_id, chunk_index, content, embedding)
values
  ('77777777-7777-7777-7777-777777777777', 0,
   'the quarterly revenue report for the northern region',
   array_fill(0.9::real, array[1024])::extensions.vector),
  ('77777777-7777-7777-7777-777777777777', 1,
   'the onboarding checklist for new engineers',
   array_fill(0.1::real, array[1024])::extensions.vector);

select is(
  (select count(*)::int
   from public.search_chunks(
     array['77777777-7777-7777-7777-777777777777']::uuid[],
     array_fill(0.9::real, array[1024])::extensions.vector,
     'quarterly revenue')),
  2,
  'both chunks are returned, ranked'
);

-- The lexical arm must lift the chunk containing the literal words even though
-- both chunks are in range of the vector.
select is(
  (select content
   from public.search_chunks(
     array['77777777-7777-7777-7777-777777777777']::uuid[],
     array_fill(0.5::real, array[1024])::extensions.vector,
     'onboarding checklist engineers')
   limit 1),
  'the onboarding checklist for new engineers',
  'the lexical arm ranks an exact term match first'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `function public.search_chunks does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0006_search_chunks.sql`:

```sql
-- Hybrid retrieval in one roundtrip: pgvector for meaning, Postgres full-text
-- for exact terms such as error codes and proper nouns that dense retrieval
-- reliably misses, fused with reciprocal rank fusion.
--
-- RRF fuses two rank lists without needing the two scoring scales to be
-- comparable, which is why it replaces the weighted score blending of the old
-- engine — where a cosine similarity and a keyword heuristic were added
-- together as if they meant the same thing.
--
-- security invoker (the default, stated for the reader) so row-level security
-- still applies to the caller.
create function public.search_chunks(
  p_document_ids uuid[],
  p_embedding    extensions.vector(1024),
  p_query        text,
  p_limit        integer default 12,
  p_k            integer default 60
)
returns table (
  chunk_id    uuid,
  document_id uuid,
  chunk_index integer,
  content     text,
  metadata    jsonb,
  score       real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with dense as (
    select c.id,
           row_number() over (order by c.embedding <=> p_embedding) as rank
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
    order by c.embedding <=> p_embedding
    limit greatest(p_limit * 4, 40)
  ),
  lexical as (
    select c.id,
           row_number() over (
             order by ts_rank_cd(c.tsv, websearch_to_tsquery('english', p_query)) desc
           ) as rank
    from public.document_chunks c
    where c.document_id = any (p_document_ids)
      and c.tsv @@ websearch_to_tsquery('english', p_query)
    limit greatest(p_limit * 4, 40)
  ),
  fused as (
    select coalesce(d.id, l.id) as id,
           coalesce(1.0 / (p_k + d.rank), 0.0)
             + coalesce(1.0 / (p_k + l.rank), 0.0) as score
    from dense d
    full outer join lexical l on l.id = d.id
  )
  select c.id, c.document_id, c.chunk_index, c.content, c.metadata, f.score::real
  from fused f
  join public.document_chunks c on c.id = f.id
  order by f.score desc, c.chunk_index
  limit p_limit;
$$;
```

`websearch_to_tsquery` rather than `plainto_tsquery`: it tolerates arbitrary user punctuation
without raising, and understands quoted phrases and `-` exclusion the way a search box user
expects.

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 33 tests total.

- [ ] **Step 5: Confirm the vector index is actually used**

```bash
bunx supabase db reset >/dev/null
psql "$(bunx supabase status -o json | python3 -c 'import json,sys;print(json.load(sys.stdin)["DB_URL"])')" <<'SQL'
explain (analyze, buffers)
select * from public.document_chunks
order by embedding::extensions.halfvec(1024) <=> array_fill(0.5::real, array[1024])::extensions.halfvec(1024)
limit 10;
SQL
```

Expected: the plan contains `Index Scan using document_chunks_embedding_idx`. On an empty table
Postgres may prefer a sequential scan, which is correct — seed a few hundred rows first if the plan
is ambiguous. Record what you saw in the commit message.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0006_search_chunks.sql supabase/tests/0006_search_chunks.test.sql
git commit -m "feat(db): fuse vector and full-text retrieval into one call

The old engine issued four Pinecone queries and called it hybrid, but all four
went to the same dense embedding model — the keyword arm was a dense search with
a Keywords prefix, so there was no lexical signal anywhere in the ranking. This
adds a real lexical arm and fuses the two rank lists with reciprocal rank
fusion, which does not require the two scoring scales to be comparable."
```

---

### Task 1.8: The remaining RPCs

**Files:**
- Create: `supabase/migrations/0007_rpc.sql`, `supabase/tests/0007_rpc.test.sql`

**Interfaces:**
- Consumes: every table and `search_chunks`
- Produces:
  - `public.get_chat_context(p_chat_id uuid, p_history_limit integer default 12) returns jsonb`
  - `public.append_message(p_chat_id uuid, p_role public.message_role, p_content text,
    p_citation_chunk_ids uuid[] default '{}', p_tokens_in integer default null,
    p_tokens_out integer default null, p_latency_ms integer default null,
    p_retrieval_ms integer default null, p_model text default null) returns uuid`
  - `public.create_chat_with_documents(p_title text, p_document_ids uuid[]) returns uuid`
  - `public.insert_document_chunks(p_document_id uuid, p_chunks jsonb) returns integer`

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0007_rpc.test.sql`:

```sql
begin;
select plan(6);

select has_function('public', 'get_chat_context',        'get_chat_context exists');
select has_function('public', 'append_message',          'append_message exists');
select has_function('public', 'create_chat_with_documents', 'create_chat_with_documents exists');
select has_function('public', 'insert_document_chunks',  'insert_document_chunks exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('88888888-8888-8888-8888-888888888888',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'rpc-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('99999999-9999-9999-9999-999999999999',
        '88888888-8888-8888-8888-888888888888',
        'pdf', 'RPC fixture', 'hash-rpc', 'fixtures/rpc.pdf');

select is(
  public.insert_document_chunks(
    '99999999-9999-9999-9999-999999999999',
    jsonb_build_array(
      jsonb_build_object('chunk_index', 0, 'content', 'alpha',
                         'embedding', (select jsonb_agg(0.1) from generate_series(1, 1024))),
      jsonb_build_object('chunk_index', 1, 'content', 'beta',
                         'embedding', (select jsonb_agg(0.2) from generate_series(1, 1024))))),
  2,
  'a whole batch of chunks is written in one call'
);

-- One call must return the chat, its documents, its messages and its memories.
select is(
  jsonb_typeof(
    public.get_chat_context(
      public.create_chat_with_documents(
        'RPC chat', array['99999999-9999-9999-9999-999999999999']::uuid[]))),
  'object',
  'get_chat_context returns a single object for the whole conversation'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `function public.get_chat_context does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0007_rpc.sql`:

```sql
-- Replaces the six sequential Supabase roundtrips the old send path made before
-- any thinking started: chat, files, users, user_memories, recent chats, and a
-- second files read inside getFileContent.
create function public.get_chat_context(
  p_chat_id       uuid,
  p_history_limit integer default 12
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'chat', jsonb_build_object(
      'id', c.id, 'title', c.title,
      'createdAt', c.created_at, 'updatedAt', c.updated_at),
    'documents', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', d.id, 'kind', d.kind, 'title', d.title,
               'status', d.status, 'chunkCount', d.chunk_count)
             order by cd.added_at)
      from public.chat_documents cd
      join public.documents d on d.id = cd.document_id
      where cd.chat_id = c.id), '[]'::jsonb),
    'messages', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', m.id, 'role', m.role, 'content', m.content,
               'createdAt', m.created_at)
             order by m.created_at)
      from (
        select * from public.messages
        where chat_id = c.id
        order by created_at desc
        limit p_history_limit
      ) m), '[]'::jsonb),
    'memories', coalesce((
      select jsonb_agg(um.content order by um.created_at)
      from public.user_memories um
      where um.user_id = c.user_id), '[]'::jsonb),
    'profile', jsonb_build_object(
      'displayName', (select p.display_name from public.profiles p where p.id = c.user_id))
  )
  from public.chats c
  where c.id = p_chat_id;
$$;

-- Message and citations written together, so an answer can never be persisted
-- without the passages it stood on.
create function public.append_message(
  p_chat_id            uuid,
  p_role               public.message_role,
  p_content            text,
  p_citation_chunk_ids uuid[] default '{}'::uuid[],
  p_tokens_in          integer default null,
  p_tokens_out         integer default null,
  p_latency_ms         integer default null,
  p_retrieval_ms       integer default null,
  p_model              text    default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.messages
    (chat_id, role, content, tokens_in, tokens_out, latency_ms, retrieval_ms, model)
  values
    (p_chat_id, p_role, p_content, p_tokens_in, p_tokens_out, p_latency_ms, p_retrieval_ms, p_model)
  returning id into new_id;

  if array_length(p_citation_chunk_ids, 1) is not null then
    insert into public.message_citations (message_id, chunk_id, rank)
    select new_id, chunk_id, ordinality::integer
    from unnest(p_citation_chunk_ids) with ordinality as t(chunk_id, ordinality)
    on conflict (message_id, chunk_id) do nothing;
  end if;

  return new_id;
end;
$$;

create function public.create_chat_with_documents(
  p_title       text,
  p_document_ids uuid[]
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  new_id uuid;
begin
  insert into public.chats (user_id, title)
  values (coalesce((select auth.uid()),
                   (select user_id from public.documents
                    where id = p_document_ids[1])),
          p_title)
  returning id into new_id;

  insert into public.chat_documents (chat_id, document_id)
  select new_id, unnest(p_document_ids)
  on conflict do nothing;

  return new_id;
end;
$$;

-- One statement per batch, replacing the old five-chunks-then-sleep-five-seconds
-- loop that spent roughly eight minutes idle on a five-hundred-chunk document.
create function public.insert_document_chunks(
  p_document_id uuid,
  p_chunks      jsonb
)
returns integer
language sql
volatile
security invoker
set search_path = ''
as $$
  with inserted as (
    insert into public.document_chunks
      (document_id, chunk_index, content, embedding, token_count, metadata)
    select
      p_document_id,
      (c ->> 'chunk_index')::integer,
      c ->> 'content',
      (select array_agg(value::text::real) from jsonb_array_elements(c -> 'embedding'))
        ::extensions.vector(1024),
      nullif(c ->> 'token_count', '')::integer,
      coalesce(c -> 'metadata', '{}'::jsonb)
    from jsonb_array_elements(p_chunks) as c
    on conflict (document_id, chunk_index) do update
      set content     = excluded.content,
          embedding   = excluded.embedding,
          token_count = excluded.token_count,
          metadata    = excluded.metadata
    returning 1
  )
  select count(*)::integer from inserted;
$$;
```

`create_chat_with_documents` falls back to the first document's owner when `auth.uid()` is null,
which is the case under pgTAP and under a service-role call; under a real authenticated request
`auth.uid()` wins.

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 39 tests total.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0007_rpc.sql supabase/tests/0007_rpc.test.sql
git commit -m "feat(db): collapse the six-roundtrip send path into one call

Sending one message used to make six sequential Supabase requests before any
thinking started. get_chat_context returns the chat, its documents, its recent
messages, the user memories and the profile as one object. append_message writes
the answer and its citations together, so an answer cannot be stored without the
passages it stood on."
```

---

### Task 1.9: The ingestion queue

**Files:**
- Create: `supabase/migrations/0008_ingestion_queue.sql`,
  `supabase/tests/0008_ingestion.test.sql`

**Interfaces:**
- Consumes: `documents` from Task 1.4
- Produces:
  - `public.ingestion_jobs (id bigserial, document_id uuid unique, attempts, run_after, last_error, created_at)`
  - `public.claim_ingestion_job() returns table (job_id bigint, document_id uuid, attempts integer)`
  - `public.complete_ingestion_job(p_job_id bigint)`
  - `public.fail_ingestion_job(p_job_id bigint, p_error text)`
  - trigger enqueueing a job on `documents` insert

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/0008_ingestion.test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'ingestion_jobs', 'the job table exists');

insert into auth.users (id, instance_id, aud, role, email)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'queue-test@example.com');

insert into public.documents (id, user_id, kind, title, content_hash, storage_path)
values ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'pdf', 'Queue fixture', 'hash-queue', 'fixtures/queue.pdf');

select is(
  (select count(*)::int from public.ingestion_jobs
   where document_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  1,
  'inserting a document enqueues exactly one job');

select is(
  (select document_id from public.claim_ingestion_job()),
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid,
  'a worker can claim the pending job');

select is(
  (select status::text from public.documents
   where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'processing',
  'claiming a job marks the document as processing');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

```bash
bunx supabase test db
```

Expected: FAIL — `relation "public.ingestion_jobs" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0008_ingestion_queue.sql`:

```sql
-- A queue in the database rather than a queue service. FOR UPDATE SKIP LOCKED
-- has been the Postgres answer to this for years, and the alternative was a
-- vendor for a workload of a few hundred documents.
create table public.ingestion_jobs (
  id          bigserial primary key,
  document_id uuid not null unique references public.documents (id) on delete cascade,
  attempts    integer not null default 0,
  run_after   timestamptz not null default now(),
  last_error  text,
  created_at  timestamptz not null default now()
);

create index ingestion_jobs_runnable_idx
  on public.ingestion_jobs (run_after)
  where attempts < 5;

alter table public.ingestion_jobs enable row level security;
-- No policy: only the service role touches the queue. Authenticated users see
-- progress through documents.status, which they do own.

create function public.enqueue_ingestion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.ingestion_jobs (document_id)
  values (new.id)
  on conflict (document_id) do update
    set run_after  = now(),
        attempts   = 0,
        last_error = null;
  return null;
end;
$$;

create trigger documents_enqueue_ingestion
  after insert on public.documents
  for each row execute function public.enqueue_ingestion();

create function public.claim_ingestion_job()
returns table (job_id bigint, document_id uuid, attempts integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  claimed public.ingestion_jobs;
begin
  select * into claimed
  from public.ingestion_jobs j
  where j.run_after <= now() and j.attempts < 5
  order by j.id
  for update skip locked
  limit 1;

  if not found then
    return;
  end if;

  update public.ingestion_jobs
  set attempts  = claimed.attempts + 1,
      run_after = now() + (interval '30 seconds' * power(2, claimed.attempts))
  where id = claimed.id;

  update public.documents
  set status = 'processing'
  where id = claimed.document_id and status <> 'ready';

  job_id      := claimed.id;
  document_id := claimed.document_id;
  attempts    := claimed.attempts + 1;
  return next;
end;
$$;

create function public.complete_ingestion_job(p_job_id bigint)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  delete from public.ingestion_jobs where id = p_job_id;
$$;

create function public.fail_ingestion_job(p_job_id bigint, p_error text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  doc uuid;
  tries integer;
begin
  update public.ingestion_jobs
  set last_error = p_error
  where id = p_job_id
  returning document_id, attempts into doc, tries;

  if tries >= 5 then
    update public.documents
    set status = 'failed', error = p_error
    where id = doc;
  end if;
end;
$$;
```

The `run_after` backoff doubles from 30 seconds, so five attempts span roughly eight minutes before
the document is marked failed.

- [ ] **Step 4: Apply and re-run**

```bash
bunx supabase db reset
bunx supabase test db
```

Expected: PASS, 43 tests total.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_ingestion_queue.sql supabase/tests/0008_ingestion.test.sql
git commit -m "feat(db): queue ingestion in Postgres so a crash retries instead of vanishing

Processing ran inside the request that triggered it, so a timeout or a redeploy
lost the work with no record and no retry — which is how fourteen documents came
to sit at failed with an error string and no path forward. FOR UPDATE SKIP
LOCKED gives a crash-safe queue without adding a vendor."
```

---

### Task 1.10: Push to remote, generate types, and wire the server client

**Files:**
- Create: `src/core/database.types.ts` (generated), `src/server/platform/db/client.ts`,
  `src/server/platform/db/client.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: every migration
- Produces:
  - `Database` type from generated `database.types.ts`
  - `createServerDbClient(): Promise<SupabaseClient<Database>>` — the cookie-bound server client
  - `bun run db:types` script

- [ ] **Step 1: Reset the remote database and push the migrations**

**This is the irreversible step.** The dump from Task 1.1 must exist first.

```bash
ls -la ~/backups/inquora-*-2026-08-25.sql
```

Expected: both files present and non-empty. Do not continue otherwise.

```bash
bunx supabase db reset --linked
```

This drops the remote schema and replays `supabase/migrations/` against it. The old `users`,
`files`, `chats` and `messages` tables are gone; no `0009_drop_legacy.sql` is needed because the
reset rebuilds from empty.

- [ ] **Step 2: Verify the remote shape**

```bash
bunx supabase db diff --linked
```

Expected: no differences. The remote matches the migrations exactly.

- [ ] **Step 3: Generate the types**

```bash
bunx supabase gen types typescript --linked > src/core/database.types.ts
```

Add to `package.json` scripts:

```json
"db:types": "supabase gen types typescript --linked > src/core/database.types.ts",
"db:test": "supabase test db",
"db:reset": "supabase db reset"
```

- [ ] **Step 4: Write the failing test for the server client**

Create `src/server/platform/db/client.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Database } from "@/core/database.types";

describe("generated database types", () => {
  it("exposes the tables the schema defines", () => {
    type Tables = keyof Database["public"]["Tables"];
    const expected: Tables[] = [
      "profiles",
      "documents",
      "document_chunks",
      "chats",
      "chat_documents",
      "messages",
      "message_citations",
      "user_memories",
      "ingestion_jobs",
    ];
    expect(expected).toHaveLength(9);
  });

  it("types a chunk embedding as the 1024-dimension vector column", () => {
    type Chunk = Database["public"]["Tables"]["document_chunks"]["Row"];
    const keys: (keyof Chunk)[] = ["id", "document_id", "chunk_index", "content", "embedding"];
    expect(keys).toContain("embedding");
  });

  it("exposes search_chunks as a callable function", () => {
    type Fns = keyof Database["public"]["Functions"];
    const fns: Fns[] = ["search_chunks", "get_chat_context", "append_message"];
    expect(fns).toContain("search_chunks");
  });
});
```

- [ ] **Step 5: Run the test**

Run: `bun run test src/server/platform/db/client.test.ts`
Expected: PASS. If a table name is missing from the generated union, TypeScript fails to compile
the array literal — which is the point. Fix the migration, regenerate, re-run.

- [ ] **Step 6: Write the server client**

Create `src/server/platform/db/client.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/core/database.types";

/**
 * The server-side Supabase client, bound to the request's cookies so row-level
 * security sees the calling user.
 *
 * The previous code reached for the browser client inside server paths
 * (src/utils/file-processing-utils.ts:26), which ran as the anonymous role
 * regardless of who was asking.
 */
export async function createServerDbClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where cookies are read-only. The
            // middleware in src/proxy.ts refreshes the session instead.
          }
        },
      },
    },
  );
}
```

- [ ] **Step 7: Verify typecheck, lint and the full suite**

```bash
bun run typecheck
bunx eslint src
bun run test
```

Expected: all pass. `client.ts` sits in `platform` and imports only `core`, satisfying the boundary
rule from Task 0.4.

- [ ] **Step 8: Commit**

```bash
git add supabase src/core/database.types.ts src/server/platform/db package.json
git commit -m "feat(db): rebuild the remote schema, and generate the types from it

The types file was hand-maintained and had drifted from the database it
described: it declared files.full_text, which does not exist, so the code
reading it always got null, and it omitted files.is_text_extracted, which does.
Generating it removes the class of bug. The server client is bound to request
cookies so row-level security sees the caller, rather than reaching for the
browser client from a server path."
```

---

## Phase 1 exit criteria

Before Phase 2 begins, all of these must hold:

- [ ] `bunx supabase test db` passes, 43 pgTAP assertions
- [ ] `bunx supabase db diff --linked` reports no differences
- [ ] An anonymous REST call against `documents`, `chats` and `messages` returns `[]`
- [ ] `bun run typecheck && bunx eslint src && bun run test && bun run build` all pass
- [ ] CI is green on `main`
- [ ] The pre-rebuild dump exists at `~/backups/inquora-*-2026-08-25.sql`
- [ ] The service-role key shared on 2026-08-25 has been rotated in the Supabase dashboard

## What Phases 2–5 need from this one

Written as separate plans once the generated types are real:

| Phase | Depends on |
|---|---|
| 2. Retrieval | `search_chunks`, `Database["public"]["Functions"]["search_chunks"]` |
| 3. Transport | `get_chat_context`, `append_message`, `AppError`, `Result` |
| 4. Ingestion | `ingestion_jobs`, `claim_ingestion_job`, `insert_document_chunks` |
| 5. Sweep | the boundary rules from Task 0.4 extended to `src/utils`, `src/data`, `src/services` |
