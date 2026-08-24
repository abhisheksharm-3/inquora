# Working in this repository

Read this before changing anything. It is short on purpose; the detail lives in the documents it
points at.

## What is happening right now

Inquora is being rebuilt in two slices. **Nothing below the UI has been implemented yet.** The
code in `src/` is the old system, and most of it is scheduled for deletion.

- **Slice one, the non-UI core.** Designed and planned, not started.
  Design: `.polaris/specs/2026-08-25-non-ui-core-design.md`
  Plan: `.polaris/plans/2026-08-25-non-ui-core.md` (phases 0 and 1, executable, test-first)
- **Slice two, the UI.** Scoped and shaped, not started.
  Scope: `.polaris/specs/2026-08-25-ui-scope.md`
  Brief: `.polaris/specs/2026-08-25-ui-shape-brief.md`
  Mockups: `docs/design/`

Decisions that are expensive to reverse are ADRs in `docs/adr/`. Read them before proposing
something they already settled.

## Hard rules

- **No `Co-Authored-By` trailer** in commit messages. No AI attribution footer of any kind.
- **bun**, never npm. `bun.lock` is the only lockfile.
- **Commits and prose** follow `.polaris` writing rules: no delve, leverage, seamless, robust,
  showcase, tapestry; no "not only X but also Y"; sentence case headings; commas over em-dash spray.
- **Embedding dimension is 1024** everywhere, from the existing Hugging Face Space.
- Every SQL function is `security invoker` unless it must cross a trust boundary, and every
  `security definer` function sets `search_path = ''`.
- Every RLS policy wraps `auth.uid()` as `(select auth.uid())` so it is evaluated once per query
  rather than once per row.

## The laziness ladder, before writing code

Stop at the first rung that solves it.

1. Does this need to exist at all?
2. Does something in this repo already do it?
3. Does the standard library cover it? `AbortSignal.timeout` over the `AbortController` dance,
   `crypto.subtle.digest` over a hash package, Web Streams over custom plumbing, HTTP status codes
   and RFC 9457 over an invented error enum, Postgres `FOR UPDATE SKIP LOCKED` over a queue vendor.
4. Does the platform provide it? A DB constraint beats app validation; a trigger beats a write the
   application might skip.
5. Is it already a dependency?
6. Can it be one line?
7. Only then, the minimum that works.

Adding a dependency, an abstraction, or a file is the last resort and carries the burden of proof.

## Architecture, once slice one lands

```
src/
  app/                 transport edge only: route handlers, pages, actions
  server/
    modules/           vertical slices: chat, documents, retrieval, ingestion, memory
    platform/          db, cache, llm, embeddings, ratelimit, telemetry, env
  core/                pure domain. No I/O. Imports nothing but core.
  ui/                  components and hooks
```

Dependency direction, enforced by `eslint-plugin-boundaries`:

```
app → server/modules → server/platform → core
```

Reversed or sideways imports fail lint. A component importing a repository is a build error.

**Naming.** Non-component files `kebab-case` with a role suffix (`.service.ts`, `.repository.ts`,
`.schema.ts`, `.types.ts`). Components `PascalCase.tsx`. Hooks `useThing.ts`. Types carry **no
`Type` prefix**. Database identifiers `snake_case`, tables plural, enums singular.

## Where logic belongs

Integrity, aggregation and retrieval live in **Postgres**. Orchestration and anything that calls an
LLM or an external API lives in **TypeScript**. See `docs/adr/0003`.

If you find yourself writing application code to keep a derived column correct, write a trigger
instead. That is the class of bug that left 213 of 241 documents stuck at `idle` in the old system.

## Design

`PRODUCT.md` owns who and why. `DESIGN.md` owns how it looks. Both are binding, including the
accessibility floor and the absolute bans.

The layout law, on every surface: **substance left, apparatus right.**

## Before calling anything done

- `bun run typecheck && bunx eslint src && bun run test && bun run build`
- `bunx supabase test db` for anything touching SQL
- A green suite is not evidence for an AI pipeline. One live end-to-end run against the real
  provider, or it is not working.
- State what you actually ran and what it printed. If a step was skipped, say so.
