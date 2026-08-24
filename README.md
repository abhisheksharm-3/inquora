# Inquora

Ask a question of your documents and get an answer you can verify without leaving the page.

Verification is the point. Every claim traces to the passage it came from, and reaching that
passage takes one action. An answer with no traceable source is a worse outcome than no answer.

**Live:** [inquora.vercel.app](https://inquora.vercel.app)

---

## Status: mid-rebuild

The application running at that link is version 3. Version 4 is designed and planned but **not
implemented**, and it replaces almost everything below the interface. If you are reading the code
in `src/`, you are reading the system being replaced.

Two slices, in order:

| Slice | State | Documents |
|---|---|---|
| **Non-UI core** — data, retrieval, transport, ingestion | designed, planned, not started | [design](.polaris/specs/2026-08-25-non-ui-core-design.md) · [plan](.polaris/plans/2026-08-25-non-ui-core.md) |
| **UI** — every surface, rebuilt from nothing | scoped, shaped, not started | [scope](.polaris/specs/2026-08-25-ui-scope.md) · [brief](.polaris/specs/2026-08-25-ui-shape-brief.md) · [mockups](docs/design/) |

Decisions that are expensive to reverse live in [`docs/adr/`](docs/adr/).

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
generation, and a streamed first token.**

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

---

## Stack

| | |
|---|---|
| Framework | Next.js 16.3, React 19.2, TypeScript 5 |
| Database | Supabase Postgres with pgvector |
| Model layer | LangChain v1 |
| Embeddings | 1024-dimension, self-hosted |
| Cache and limits | Upstash Redis |
| Chat interface | `@assistant-ui/react` primitives, styled from scratch |
| Client state | TanStack Query |
| Styling | Tailwind CSS 4, Radix primitives |
| Observability | OpenTelemetry, Sentry, Langfuse |
| Tests | Vitest, pgTAP |

Pinecone is on its way out. tRPC was evaluated and rejected: Server Actions, generated database
types and a shared Zod schema already solve the contract problem it exists for.

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

Once the database rebuild lands, schema work runs through the Supabase CLI:

```bash
bunx supabase start        # local stack
bunx supabase db reset     # replay migrations
bunx supabase test db      # pgTAP
bun run db:types           # regenerate src/core/database.types.ts
```

Never hand-edit the generated types file. Drift between it and the database is how the current
system ended up reading a `full_text` column that does not exist.

---

## Contributing

[`CLAUDE.md`](CLAUDE.md) carries the working rules: the laziness ladder, the layer boundaries, the
naming standard, and where logic belongs. Read it before changing anything.

Two that catch people out: commits carry no `Co-Authored-By` trailer, and a green test suite is not
evidence that an AI pipeline works. One live end-to-end run against the real provider, or it is not
working.
