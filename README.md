# Inquora

Ask a question of your documents and get an answer you can verify without leaving the page.

Verification is the point. Every claim traces to the passage it came from, and reaching that
passage takes one action. An answer with no traceable source is a worse outcome than no answer.

**Live:** [inquora.vercel.app](https://inquora.vercel.app)

---

## Status: the backend is built, the interface is not

The link above serves one page saying the product is offline, because it is. Everything below the
interface has been rebuilt and runs; nothing above it exists yet.

| Slice                                                   | State                       | Documents                                                                                                                       |
| ------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **Non-UI core** — data, retrieval, transport, ingestion | **built and verified live** | [as built](.polaris/specs/2026-09-02-non-ui-core-as-built.md) · [design](.polaris/specs/2026-08-25-non-ui-core-design.md)       |
| **UI** — every surface, rebuilt from nothing            | scoped, shaped, not started | [scope](.polaris/specs/2026-08-25-ui-scope.md) · [brief](.polaris/specs/2026-08-25-ui-shape-brief.md) · [mockups](docs/design/) |

Decisions that are expensive to reverse live in [`docs/adr/`](docs/adr/). What was actually built,
including the places building it proved the design wrong, is in
[the as-built spec](.polaris/specs/2026-09-02-non-ui-core-as-built.md).

### Measured, live rather than mocked

|                        |                                                                                          |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| Retrieval quality      | **recall@4 93.8%, MRR 0.967** over the fixture corpus — `bun run eval`                   |
| A deployed answer      | **200 SSE, first event 3.6s, 6.3s total**, citations persisted — `bun run live:deployed` |
| A real PDF, end to end | **3 seconds** — `bun run scripts/live-ingest.ts <file>`                                  |
| A 516-file repository  | **1.3 seconds** to read and chunk                                                        |
| A spreadsheet          | filter, sum and group-by, all exact, from SQL over its rows                              |
| Database               | 35 migrations, **149 pgTAP assertions**                                                  |
| Suite                  | 253 tests, typecheck clean, zero lint errors                                             |
| Typecheck              | **0.27s** on TypeScript 7, against 1.75s on 5.9 over the same files                       |
| Lint and format        | **200 milliseconds** over 177 files on Biome                                             |

The development network blocks POST to `generativelanguage.googleapis.com`, so anything touching
generation is checked against the deployment rather than locally.

### One real conversation

The full text of *Pride and Prejudice* — 762 passages from one PDF — asked ten questions in one
conversation, on the deployment. Four of them, because "it answers questions about documents" is
several different problems and only the first is easy:

| Question | Demanded | Measured |
| --- | --- | --- |
| How are Lady Catherine, Lady Anne Darcy and Mr Darcy related? | one fact, answered briefly and still cited | 2 sources, first word in 5.9s |
| What in Darcy's letter made Elizabeth reconsider her judgment of Wickham? | quotations from the will, each traceable | 12 sources, 8.8s in all |
| What did Darcy first say about Elizabeth's appearance, and how does it contrast with his later description of her eyes? | two passages hundreds of pages apart, from one question | 12 sources, 6.1s in all |
| Trace what changed Elizabeth's opinion of Darcy, from the assembly through Wickham's story to the letter | three ordered parts, so more than one search | 23 sources, 12.5s in all |

The run also found three faults worth recording, all of them in the citation path this product
argues for. Consecutive marks ran together, so `[4, 6, 10]` rendered as `4610`. Bold arrived as
literal asterisks. And the model copied citation numbers out of earlier answers, where they name
different passages — one of them wrote *"[399, though this passage is not directly cited in the
provided search results, it is a known plot point]"*, which is a citation that traces to nothing
with an apology attached. A green suite would have reported none of the three.

### Why

The current system works, and it is expensive and slow in ways that are structural rather than
incidental. Measured on 2026-08-25 against the live project:

- **Five to eight LLM calls run before a single token of the answer.** Query analysis, expansion,
  decomposition, step-back generation and a separate agentic reasoning pass, all before the call
  that writes the reply.
- **Hybrid search is not hybrid.** All four retrieval "strategies" send dense embedding queries to
  the same model. There is no lexical arm.
- **Nothing streams.** The answer arrives complete or not at all.
- **213 of 241 documents sit at `idle`** because a status write-back in application code rarely
  fires, so opening a chat re-derives from the vector store what a column should have held.
- **Ingestion sleeps.** Five chunks, then a five-second pause. A 500-chunk PDF spends roughly eight
  minutes deliberately idle.
- **Seven packages implement two YouTube operations**, and the audio path spawns a binary that
  cannot exist on serverless.

### What replaces it

- **Retrieval moves into Postgres.** pgvector HNSW and full-text search fused with reciprocal rank
  fusion in one SQL function, so hybrid search is real and multi-document chat is an array
  parameter rather than a rewrite. ([ADR 0001](docs/adr/0001-retrieval-on-supabase-pgvector.md))
- **LangChain v1 for the model layer.** Provider as a config string, Zod structured output, native
  streaming. ([ADR 0002](docs/adr/0002-langchain-v1-model-layer.md))
- **Integrity and aggregation move into the database.** Triggers maintain what application code kept
  getting wrong; one RPC replaces six sequential roundtrips.
  ([ADR 0003](docs/adr/0003-database-first-logic.md))
- **OpenTelemetry, exported to Sentry and Langfuse.** Instrument once against the standard, choose
  the backend as config. ([ADR 0004](docs/adr/0004-opentelemetry-sentry-langfuse.md))
- **Retrieval becomes a tool**, with the first search dispatched speculatively so the common path
  keeps its fast first token.
  ([ADR 0005](docs/adr/0005-tool-calling-with-a-speculative-first-search.md))

Target for a single message: **one embedding call, one vector query, two Supabase roundtrips before
generation, and a streamed first token.** Reality, honestly: one search when the speculative
dispatch is reused and two when the model rewords the question far enough that serving the warmed
passages would answer from the wrong ones. Both outcomes are recorded on the trace, so the hit rate
is a number rather than a hope.

### What seven reviews found

The backend was reviewed across correctness, security, performance, database, transport,
maintainability and over-engineering. It was worth doing: they found a live authorization hole
(four `security definer` queue functions callable by anyone holding the publishable key), an answer
persisted as its last stream delta rather than the whole thing, a document marked `ready` after its
first chunk of five hundred, and a browser able to forge a document's status because a policy chooses
rows while a **grant** chooses columns. Every RLS test passed throughout that last one, which is why
the suite now proves cross-tenant isolation behaviourally rather than asserting that RLS is switched
on.

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

Open [`docs/design/03-all-surfaces.html`](docs/design/03-all-surfaces.html) in a browser to see all
ten surfaces. [`PRODUCT.md`](PRODUCT.md) and [`DESIGN.md`](DESIGN.md) are binding.

---

## What it reads

PDFs, Word documents, spreadsheets, slides, images, GitHub repositories, YouTube videos, and web
pages. Several of them in one conversation, each switchable in and out of retrieval scope.

Spreadsheets are queried as tables rather than embedded as prose about tables, which is why figures
come from cells instead of from a paragraph describing them.

**Each kind is answered by a specialist.** A repository starts at its file tree, greps for
identifiers because that is exactly what a dense vector flattens, reads around a match to see the
whole function, and cites `path:line`. A video is told it has the transcript and not the picture,
and to carry a timestamp with every claim. A spreadsheet is told to query rather than read, and to
cast before it compares. Each also states what it cannot see, so the model can be honest about the
gap rather than discovering it mid-answer.

A repository is indexed by what answers questions about it: files are stored and greppable, and
embeddings are spent on documentation and on a per-file summary of its declarations. Measured on
`supabase/supabase-js`, that is 516 files and 711 chunks, against 2,664 for a first version that
embedded every function body.

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

Pinecone is gone, along with thirty other dependencies that nothing imported — including six
packages for two YouTube operations, which a running service does instead. tRPC was evaluated and
rejected: route handlers, generated database types and a shared Zod schema already solve the
contract problem it exists for.

---

## Running it

Requires **bun**. There is one lockfile and `npm install` will produce a different tree.

```bash
git clone https://github.com/abhisheksharm-3/inquora.git
cd inquora
bun install
cp .env.example .env.local   # then fill it in
bun dev
```

Environment variables are documented in [`.env.example`](.env.example) and validated by a Zod
schema at boot, so a missing or malformed value fails immediately rather than at first use.

Schema work runs through the Supabase CLI, and the checks through bun:

```bash
bun run typecheck          # TypeScript 7, about a second
bun run lint               # Biome: lint, format and the layer boundaries
bun run format             # write the formatting fixes
bun run db:push            # apply migrations to the linked project
bun run db:test            # 143 pgTAP assertions, no Docker required
bun run db:types           # regenerate src/core/database.types.ts
bun run eval               # recall@k and MRR against real embeddings
bun run live:deployed      # one real question through the deployment
```

`bun run db:test` runs the pgTAP files through bun's own Postgres client rather than pulling a
`pg_prove` container, which is what lets CI run the SQL suite beside the TypeScript one. It needs
`SUPABASE_DB_URL`.

Never hand-edit the generated types file. Drift between it and the database is how the current
system ended up reading a `full_text` column that does not exist.

---

## Contributing

[`CLAUDE.md`](CLAUDE.md) carries the working rules: the laziness ladder, the layer boundaries, the
naming standard, and where logic belongs. Read it before changing anything.

Two that catch people out: commits carry no `Co-Authored-By` trailer, and a green test suite is not
evidence that an AI pipeline works. One live end-to-end run against the real provider, or it is not
working.

That second rule earned itself here. Three failures in this rebuild passed every local test and
only appeared after deploy — a provider package a bundler could not trace, an externalised copy of a
library beside a bundled one, and a model alias answering 503 under load. Two more appeared only
when the thing was run rather than read: a cited document could never be deleted, and two versions
of one database function were live at once.
