# Working in this repository

Read this before changing anything. It is short on purpose; the detail lives in the documents it
points at.

## What is happening right now

Inquora is being rebuilt in two slices.

- **Slice one, the non-UI core: landed on 2026-08-27.** Eleven migrations, 55 pgTAP assertions,
  retrieval, the streaming answer route, ingestion, and the sweep that deleted `src/utils`,
  `src/data` and `src/services`.
  Design: `.polaris/specs/2026-08-25-non-ui-core-design.md`
  Plans: `.polaris/plans/2026-08-25-non-ui-core.md` (phases 0 and 1),
  `.polaris/plans/2026-08-27-non-ui-core-phases-2-5.md` (phases 2 to 5)
- **Slice two, the UI. Not started.** What survives of the old interface is the landing page,
  sign-in and sign-up. Everything else was deleted rather than reworked.
  Scope: `.polaris/specs/2026-08-25-ui-scope.md`
  Brief: `.polaris/specs/2026-08-25-ui-shape-brief.md`
  Mockups: `docs/design/`

**Measured on 2026-08-27, live rather than mocked:**

- Retrieval scores recall@4 87.5% and MRR 0.933 over the fixture corpus. `bun run eval`
- A real PDF ingests end to end in about three seconds. `bun run scripts/live-ingest.ts <file>`
- The deployed endpoint answers a real question from a real document through Gemini: 200
  text/event-stream, first event in 3.8 seconds, 6.5 seconds total, and the assistant message
  persisted with three source parts. `bun run live:deployed`

The development network blocks POST to generativelanguage.googleapis.com — GET returns in 0.36s,
POST hangs on IPv4 and IPv6 — so anything touching generation has to be checked against the
deployment rather than locally.

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

## Architecture

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
- `bun run db:test` for anything touching SQL. It needs `SUPABASE_DB_URL` and runs pgTAP through
  bun's Postgres client, so it needs no Docker — `supabase test db` pulls a pg_prove container.
- A green suite is not evidence for an AI pipeline. One live end-to-end run against the real
  provider, or it is not working.
- State what you actually ran and what it printed. If a step was skipped, say so.
