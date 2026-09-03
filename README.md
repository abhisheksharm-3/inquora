# Inquora

Ask a question of your documents and get an answer you can verify without leaving the page.

**Live:** [inquora.vercel.app](https://inquora.vercel.app)

Every claim in an answer carries a small number. Clicking it opens the passage the claim came from,
marked in place, in the same column you were reading. An answer with no traceable source is a worse
outcome than no answer, so the product is built around the trace rather than around the chat.

---

## What it does

Add a PDF, a spreadsheet, a slide deck, a GitHub repository, a YouTube video or a web page. Put
several of them in one conversation and switch any of them in or out of what a question reads. Ask
in your own words. The answer streams, the passages behind it appear beside it as they are found,
and following one takes a single action.

**Each kind is answered by a specialist**, because "it answers questions about documents" is eight
different problems wearing one name.

| Kind | How it is read |
| --- | --- |
| PDFs, Word, slides, images | Parsed to text, chunked, embedded, and cited by page |
| Spreadsheets | Loaded as rows and queried with SQL, so a figure comes from a cell rather than from a sentence describing the cell |
| Repositories | Files stored and greppable, embeddings spent on documentation and a per-file summary of declarations, answers cited as `path:line` |
| Videos | Transcript with a timestamp on every claim, and told plainly that it cannot see the picture |
| Web pages | Fetched, cleaned and cited by section |

A repository is indexed by what answers questions about it rather than by everything in it. On
`supabase/supabase-js` that is 516 files and 711 chunks, against 2,664 for a first version that
embedded every function body. Grep is kept because it finds identifiers exactly, which is what a
dense vector flattens.

Each specialist also states what it cannot see, so the model can be honest about a gap rather than
discovering it mid-answer.

---

## One real conversation, graded

The full text of *Pride and Prejudice* — 762 passages from one PDF — asked ten questions in a single
conversation on the deployment, across the categories a retrieval system is normally tested on.

**Cited** is how many passages the answer stands on. **Read** is how many retrieval offered it. The
gap between them is precision.

| Tests | Question | Cited | Read | First word | In all |
| --- | --- | --- | --- | --- | --- |
| Entity relationship | How are Lady Catherine, Lady Anne Darcy and Mr Darcy related? | 1 | 12 | 5.9s | 6.3s |
| Cross-chapter | What became of Georgiana and Elizabeth's relationship, and why did it matter to Darcy? | 1 | 12 | 5.2s | 6.1s |
| Semantic retrieval | What did Charlotte believe Jane should do to make Bingley fall in love with her? | 2 | 12 | 5.2s | 5.8s |
| Cross-character | Why did Elizabeth think Lydia should not go to Brighton? | 2 | 12 | 5.0s | 5.7s |
| Distractor resistance | What did Elizabeth think was wrong with Charlotte's reasoning about marriage? | 3 | 12 | 7.4s | 8.5s |
| Temporal contrast | What did Darcy first say about Elizabeth's appearance, against his later description of her eyes? | 4 | 12 | — | 7.1s |
| Character development | How does Elizabeth's view of Darcy change after the letter, and which part hits hardest? | 5 | 12 | 8.4s | 10.8s |
| Multi-hop | What financial circumstances made Wickham keen to keep the elopement secret? | 7 | 12 | 6.3s | 8.1s |
| Exact retrieval | Why did Elizabeth believe Wickham, and what in the letter made her reconsider? | 6 | 12 | — | 8.8s |
| Distributed evidence | Trace what changed her opinion of Darcy, from the assembly through Wickham to the letter | 5 | 23 | 12.5s | 16.0s |

The last question is the only one here that cannot be answered by a single search, and it searched
twice. The two answers resting on one passage out of twelve are the retriever being right, not
wasteful.

---

## Measured

Live rather than mocked, on 2026-09-03.

|                        |                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Retrieval quality      | **recall@4 93.8%, MRR 0.967** over the fixture corpus — `bun run eval`                   |
| A deployed answer      | **200 SSE, first event 3.6s, 6.3s total**, citations persisted — `bun run live:deployed` |
| A real PDF, end to end | **3 seconds** — `bun run scripts/live-ingest.ts <file>`                                  |
| A 516-file repository  | **1.3 seconds** to read and chunk                                                        |
| A spreadsheet          | filter, sum and group-by, all exact, from SQL over its rows                              |
| Database               | 35 migrations, **149 pgTAP assertions** — `bun run db:test`                              |
| Suite                  | 253 tests, typecheck clean, zero lint findings                                            |
| Typecheck              | **0.27s** on TypeScript 7, against 1.75s on 5.9 over the same files                      |
| Lint and format        | **200 milliseconds** over 215 files on Biome                                             |

The development network blocks POST to `generativelanguage.googleapis.com`, so anything touching
generation is checked against the deployment rather than locally.

---

## How a question is answered

One message costs one embedding call, one vector query and two Supabase roundtrips before
generation, and the first token streams.

1. The question reaches `POST /api/chats/[chatId]/messages`, which validates it and hands back an
   SSE stream. A route handler rather than a server action: actions cannot stream, cannot be
   cleanly aborted, and serialize through the RSC protocol.
2. A first search is dispatched speculatively while the model is still reading the question, so the
   common path keeps its fast first token.
3. Retrieval is a single SQL function: pgvector HNSW and Postgres full-text search, fused with
   reciprocal rank fusion. Hybrid search is actually hybrid, and asking across five documents is an
   array parameter rather than five queries.
4. The model answers with retrieval as a tool. Each passage it cites is numbered for that turn and
   pushed to the client as its own event, so a source appears the moment it is used.
5. `onFinish` persists the answer, its parts and its citations. Closing the tab mid-answer keeps
   what was written.

When the model rewords the question far enough that the warmed passages would answer the wrong one,
it searches again. Both outcomes are on the trace, so the reuse rate is a number rather than a hope.

Ingestion runs the same way round: an upload writes a job row, a drain endpoint claims work with
`for update skip locked`, and a trigger keeps `documents.status` correct rather than an application
write that might not fire. Progress reaches the browser over Supabase Realtime broadcast on a
private per-user topic, so a document being read updates in place without polling.

---

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

Dependencies run one way, `app → server/modules → server/platform → core`, and Biome's
`noRestrictedImports` fails the build on a reversed or sideways import. A component importing a
repository is a lint error, not a review comment.

Data flows the same way in both directions: server actions and route handlers, then hooks, then
components. Nothing in `ui/` touches the database, and nothing in `server/` renders.

**Integrity, aggregation and retrieval live in Postgres. Orchestration and anything that calls a
model lives in TypeScript.** Triggers maintain derived columns, one RPC replaces six sequential
roundtrips, and row-level security decides who can read a row. Every `security definer` function
sets `search_path = ''`, and every policy wraps `auth.uid()` as `(select auth.uid())` so it is
evaluated once per query rather than once per row.

A policy chooses rows; a **grant** chooses columns. Getting that wrong let a browser forge a
document's status while every RLS test passed, so the suite proves isolation behaviourally — running
as `authenticated` with a real claim — and asserts privileges with `has_column_privilege`.

Decisions that are expensive to reverse are recorded as ADRs:

- [Retrieval on Supabase pgvector](docs/adr/0001-retrieval-on-supabase-pgvector.md)
- [LangChain v1 for the model layer](docs/adr/0002-langchain-v1-model-layer.md)
- [Database-first logic](docs/adr/0003-database-first-logic.md)
- [OpenTelemetry, exported to Sentry and Langfuse](docs/adr/0004-opentelemetry-sentry-langfuse.md)
- [Tool calling with a speculative first search](docs/adr/0005-tool-calling-with-a-speculative-first-search.md)

---

## The interface

The design system is called **The Apparatus**, after the scholarly matter a critical edition sets
beside its text. One rule holds every surface together:

**Substance on the left, apparatus on the right.**

Whatever a surface is about occupies the reading column. Everything that supports, explains or
records it occupies the right column, where operations and cited specimens interleave
chronologically. Following a citation swaps the reading column for the document, marked in place,
while the apparatus stays put. Below 1150px the apparatus becomes footnotes, which is what an
apparatus has always done on a narrow page.

Sign in breaks that rule on purpose: the worked example is on the left and the form on the right,
because everywhere else the reading column is what you came for, and there what you came for is a
way in. The home screen has no apparatus at all, because it is a single act — type a question.

| Surface | What it does |
| --- | --- |
| Landing | The claim, three sources backing it, a real answer with its passages, and how a question goes |
| `/how-it-works` | The engineering, and the ten-question benchmark above |
| Sign in and sign up | Password or Google, with a password reset flow, beside an example of what you are signing in to |
| `/ask` | Your name, one box to type into, the documents it will read as chips, and suggestions generated from what you added |
| `/chat/[id]` | The transcript, closed by what each answer cited and how long it took; sources and tool calls in the right column; a citation opens the passage in place |
| `/history` | Every question by month, searched in Postgres, with the documents each one read |
| `/settings` | Who you are, what the account holds, and every document with retry and delete |

The transcript is `@assistant-ui/react`, driven by `useExternalStoreRuntime` over the one hook that
owns the SSE stream. Its primitives ship no styles, so the design is ours and the behaviour is
theirs: a viewport that follows the answer until you scroll up, copy, editing a question in place,
and asking again. Editing writes a sibling into `messages.parent_id` rather than overwriting a row,
and the reader is shown the newest branch.

Open [`docs/design/03-all-surfaces.html`](docs/design/03-all-surfaces.html) for the mockups every
surface was built from. [`PRODUCT.md`](PRODUCT.md) owns who and why, [`DESIGN.md`](DESIGN.md) owns
how it looks, and both are binding, including the accessibility floor.

---

## Stack

|                  |                                                       |
| ---------------- | ----------------------------------------------------- |
| Framework        | Next.js 16.3, React 19.2, TypeScript 7                |
| Database         | Supabase Postgres with pgvector                       |
| Model layer      | LangChain v1                                          |
| Embeddings       | 1024-dimension, self-hosted                           |
| Cache and limits | Upstash Redis                                         |
| Chat interface   | `@assistant-ui/react` primitives, styled from scratch |
| Client state     | TanStack Query                                        |
| Styling          | Tailwind CSS 4, Radix primitives                      |
| Document parsers | `unpdf`, `exceljs`, `mammoth`, `fflate`               |
| Observability    | OpenTelemetry, Sentry, Langfuse                       |
| Tests            | Vitest, pgTAP                                         |
| Lint and format  | Biome 2.5                                             |

tRPC was evaluated and rejected: route handlers, generated database types and a shared Zod schema
already solve the contract problem it exists for. Pinecone is gone, along with thirty other
dependencies nothing imported — including six packages for two YouTube operations, which a running
service does instead.

---

## Running it

Requires **bun**. There is one lockfile, and `npm install` will produce a different tree.

```bash
git clone https://github.com/abhisheksharm-3/inquora.git
cd inquora
bun install
cp .env.example .env.local   # then fill it in
bun dev
```

Environment variables are documented in [`.env.example`](.env.example) and validated by a Zod schema
at boot, so a missing or malformed value fails immediately rather than at first use.

Supabase needs two things beyond the keys: the migrations applied, and
`<your site>/api/auth/callback` in the project's redirect allow list. Without that entry, Supabase
drops the `redirect_to` on a recovery mail and sends the link to the site root instead.

```bash
bun run typecheck          # TypeScript 7, about a quarter of a second
bun run lint               # Biome: lint, format and the layer boundaries
bun run format             # write the formatting fixes
bun run test               # 253 Vitest tests
bun run build              # Turbopack production build
bun run db:push            # apply migrations to the linked project
bun run db:test            # 149 pgTAP assertions, no Docker required
bun run db:types           # regenerate src/core/database.types.ts
bun run eval               # recall@k and MRR against real embeddings
bun run live:deployed      # one real question through the deployment
```

`bun run db:test` runs the pgTAP files through bun's own Postgres client rather than pulling a
`pg_prove` container, which is what lets CI run the SQL suite beside the TypeScript one. It needs
`SUPABASE_DB_URL`.

Never hand-edit the generated types file. Drift between it and the database is how an earlier
version came to read a `full_text` column that does not exist.

---

## Known limits

Recorded here rather than left for somebody to discover.

- **Token accounting is unverified.** `tokens_in` and `tokens_out` were null on every message while
  latency recorded correctly. Both provider metadata shapes are read now and `streamUsage` is
  requested explicitly, but the development network blocks POST to the provider, so this can only
  be confirmed on the deployment.
- **What the assistant remembers is not visible.** There is a `memories` table, a `remember` tool,
  and a system prompt that feeds those facts back every turn. There is no way to read or delete
  them, which is the wrong answer for personal data the product holds about somebody.
- **Branch switching is not wired.** Editing a question stores a branch and the newest one is
  shown, but the chat query returns rows rather than a path, so there is nothing for a branch
  picker to walk yet.
- **The 700 to 1150px range is untested.** A tablet currently gets the phone layout.
- **Old answers carry stale citation marks.** Answers generated before the citation numbering was
  fixed cite passage indexes matching no source, so those marks render as plain text and will stay
  that way. Stored data, not a rendering fault.

---

## Contributing

[`CLAUDE.md`](CLAUDE.md) carries the working rules: the laziness ladder, the layer boundaries, the
naming standard, and where logic belongs. Read it before changing anything.

Two that catch people out. Commits carry no `Co-Authored-By` trailer or AI attribution of any kind.
And a green test suite is not evidence that an AI pipeline works — one live end-to-end run against
the real provider, or it is not working.

That second rule earned itself here. Three failures passed every local test and appeared only after
deploy: a provider package a bundler could not trace, an externalised copy of a library beside a
bundled one, and a model alias answering 503 under load. Two more appeared only when the product was
used rather than read: a cited document could never be deleted, and two versions of one database
function were live at once.
