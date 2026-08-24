# Inquora non-UI core: design

Date: 2026-08-25
Status: approved, not yet implemented. Revised 2026-08-25 for tool calling (ADR 0005) and the
UI scope findings.
Scope: every layer except visual UI — data, retrieval, transport, ingestion, cross-cutting
Related: `docs/adr/0001`–`0005`
Reference docs: LangChain v1 (docs.langchain.com/oss/javascript), Sentry OTLP
(docs.sentry.io/concepts/otlp), Langfuse (langfuse.com/docs), OpenTelemetry (opentelemetry.io/docs)

## Goal

A document-chat product whose answer quality matches Claude and ChatGPT, on a cost and latency
budget small enough to be the moat. Multi-document chat, and features like it, must arrive as
configuration against this design rather than a rebuild.

The target for the default query path:

Revised on 2026-08-25 by `docs/adr/0005`: retrieval became a tool rather than a fixed step.

| | Today | Target |
|---|---|---|
| LLM turns per message | 5–8 pre-answer, then 1 | 1, or 2 when the model searches |
| Embedding calls | 4–8 | 1, Redis-cached |
| Vector store roundtrips | 4–8 | 1 (`search_chunks`) |
| Supabase roundtrips before generation | 6, sequential | 2 (`get_chat_context`, `search_chunks`) |
| Supabase roundtrips after generation | 2 | 1 (`append_message`) |
| First token | after full generation | streamed |

## Current state, measured

Read on 2026-08-25 against the live Supabase project and the repository at `7122e1d`.

- 8 users, 241 files, 163 chats, 851 messages, 2 memories.
- `processing_status` is `idle` on 213 of 241 files (88%), `completed` on 15, `failed` on 14.
  The write-back in `_handleProcessableFile` mostly never fires, so nearly every chat open falls
  through to `checkNamespaceExists` → `describeIndexStats` across every configured Pinecone index.
- `files.type` and `chats.type` use different vocabularies for the same concept: files say
  `youtube` (29 rows), chats say `video` (26). Files carry both `doc` (14) and `docs` (2).
- `files.full_text` does not exist in the database. `file-processing-utils.ts:68` reads it, so that
  branch has always returned null. `files.is_text_extracted` exists and is referenced nowhere.
- No migrations are checked in. The schema exists only in the cloud.
- No tests, no CI, no formatter. Two lockfiles (`bun.lock`, `package-lock.json`).

Defects that shape the design:

1. No streaming. `sendMessage` returns a finished string (`gemini/message-actions.ts:294`).
2. "Hybrid search" is four dense queries. `performKeywordSearch` sends `"Keywords: x y. x y"` to the
   same embedding model (`rag/retrieval-engine.ts:118`). There is no lexical arm.
3. MMR runs Jaccard word overlap over full document text (`retrieval-engine.ts:295,341`) and
   `diversityThreshold: 0.7` is passed as lambda, giving diversity more than double the weight of
   relevance.
4. Errors are persisted as assistant messages (`message-actions.ts:141`), so every failure becomes
   a permanent conversation turn that is replayed as history on the next request.
5. Server code calls the browser Supabase client (`file-processing-utils.ts:26`) and does
   `select("*")` to read two status columns.
6. Ingestion sleeps 5 seconds between every 5 chunks (`embeddings-store.ts:56-66`). A 500-chunk PDF
   spends roughly 8 minutes idle.
7. The RAG cache and one of the two rate limiters are in-process `Map`s (`rag/cache.ts:13`,
   `rag/rate-limiter.ts:26`), which on serverless scope to a single lambda.
8. Seven packages implement two YouTube operations, and the yt-dlp path spawns a binary from
   `node_modules` (`youtube/download-methods.ts:16`) — impossible on serverless.
9. `serverActions.bodySizeLimit: '15mb'` contradicts `FILE_CONSTANTS.MAX_FILE_SIZE_MB: 50`.

## Decisions

Recorded as ADRs; summarized here.

- **Retrieval moves to Supabase pgvector.** One vendor, true hybrid search, and document-set
  filtering that makes multi-document chat an array parameter. See `docs/adr/0001`.
- **The model layer is LangChain v1.** `initChatModel` with provider strings, Zod structured
  output, native streaming. See `docs/adr/0002`.
- **Integrity, aggregation and retrieval live in Postgres**; orchestration and inference live in
  TypeScript. See `docs/adr/0003`.
- **Instrumentation is OpenTelemetry; Sentry takes exceptions, Langfuse takes LLM traces.**
  Grafana is deferred. See `docs/adr/0004`.
- **Retrieval is a tool, not a pipeline step**, with the first search dispatched speculatively so
  the common path keeps its fast first token. See `docs/adr/0005`.
- **Standard before hand-rolled**, at every level: HTTP status codes and RFC 9457 over an invented
  error enum, `AbortSignal.timeout` over the `AbortController` dance, Web Streams over custom SSE
  plumbing, `crypto.subtle.digest` over a hash package, Postgres `FOR UPDATE SKIP LOCKED` over a
  queue service.
- **The database is rebuilt, not migrated.** The user waived the existing data. A `pg_dump` is
  taken outside the repository first.

## Architecture

### Directory layout

```
src/
  app/                    transport edge only: route handlers, pages, actions
  server/
    modules/              vertical slices
      chat/               chat.service.ts  chat.repository.ts  chat.schema.ts  chat.types.ts
      documents/
      retrieval/
      ingestion/
      memory/
    platform/             db  cache  llm  embeddings  ratelimit  telemetry  env.ts
  core/                   pure domain: types, errors, result, ids. No I/O.
  ui/                     components and hooks
```

Dependency rule, enforced by `eslint-plugin-boundaries`:

```
app → server/modules → server/platform → core
```

Reversed or sideways imports fail lint. A component importing a repository is a build error.

### Naming standard

- Directories and non-component files: `kebab-case`, with the role as a suffix — `.service.ts`,
  `.repository.ts`, `.schema.ts`, `.types.ts`.
- Components: `PascalCase.tsx`. Hooks: `useThing.ts`.
- Types carry no `Type` prefix. `TypeChat` becomes `Chat`, `TypeRAGRequest` becomes
  `RetrievalRequest`. The prefix is on more than 60 exported names and TypeScript makes it
  redundant.
- Database: `snake_case`, plural tables, join tables `a_b`, singular enums.
- One barrel per module, exporting the public surface. No barrels elsewhere.

This dissolves `src/utils/` (16 loose files and four subsystem folders), `src/services/` (one
file), and `src/data/`. `config/` and `constants/` merge under one rule: `core/constants` for
values that never change, `server/platform/env.ts` for everything read from the environment.

## Data layer

### Schema

```
profiles            id references auth.users(id) on delete cascade
documents           kind document_kind, status processing_status, content_hash, chunk_count
document_chunks     content, embedding vector(1024), tsv generated, metadata jsonb
document_tables     one per sheet or tab, so a spreadsheet stays a table
document_rows       the cells themselves, queryable by `query_table`
chats               no type column, no file_id
chat_documents      (chat_id, document_id, position, enabled) — multi-document chat
messages            parent_id for branching, role, latency_ms, retrieval_ms, tokens, model
message_parts       ordered text / reasoning / tool_call / tool_result / source parts
user_memories       user_id gains its missing foreign key
```

`chat_documents` is what makes several documents in one chat a `WHERE document_id = ANY($1)`
instead of a rebuild, and `position` and `enabled` are what make the document rail and the
per-chat scope toggle possible without a second migration.

`message_parts` is why a message stops being a string. A conversation replayed without its tool
calls loses the reason an answer said what it said, and the source part kind absorbs what would
otherwise have been a separate citations table. `parent_id` makes the conversation a tree, which is
what message editing and branch navigation require.

Enums replace free text and stop the `youtube`/`video` and `doc`/`docs` drift recurring:

```sql
create type document_kind     as enum ('pdf','doc','sheet','slides','image','video','github','web');
create type processing_status as enum ('pending','processing','ready','failed');
create type message_role      as enum ('user','assistant');
create type message_part_kind as enum ('text','reasoning','tool_call','tool_result','source');
```

### Triggers

| Trigger | Replaces |
|---|---|
| `auth.users` insert → create `profiles` row | profile creation in the auth callback |
| `moddatetime` on every table | hand-set timestamps across repositories |
| `document_chunks` change → maintain `documents.chunk_count` | the `indexed_chunks` field nothing writes |
| `chunk_count > 0` → `documents.status = 'ready'` | the write-back broken on 88% of rows |
| `messages` insert → bump `chats.updated_at` | history ordered by chat creation, which sinks actively-used chats |
| `documents` insert → enqueue `ingestion_jobs` | client-driven processing that dies with the request |

### Functions

- `search_chunks(document_ids[], embedding, query, limit, k)` — pgvector HNSW and Postgres
  full-text, fused with reciprocal rank fusion, in one call. `security invoker`, so RLS applies.
- `get_chat_context(chat_id, history_limit)` — chat, documents, recent messages, memories and
  profile as one JSONB result. Replaces the six sequential roundtrips at
  `message-actions.ts:186-256`.
- `append_message(chat_id, role, content, citation_chunk_ids[], tokens, latency)` — message and
  citations written atomically.
- `create_chat_with_documents(title, document_ids[])`.
- `insert_document_chunks(document_id, chunks jsonb)` — a whole batch in one statement.

### Indexes

```sql
create index on document_chunks using hnsw ((embedding::halfvec(1024)) halfvec_cosine_ops);
create index on document_chunks using gin (tsv);
create index on document_chunks (document_id, chunk_index);
create index on messages (chat_id, created_at);
create unique index on documents (user_id, content_hash);
```

Indexing the half-precision cast halves index size and memory with recall loss in the noise.

### Row-level security

Enabled on every table. `documents`, `chats`, `user_memories` filter on `user_id = auth.uid()`;
`document_chunks` and `message_citations` filter through a join to their parent's owner. The
current RLS configuration was not verifiable without the anon key and must be checked before the
policies are written.

Extensions: `vector`, `pg_trgm`, `unaccent`, `moddatetime`, `pg_cron`, `pg_net`.

## Retrieval

Default path, one LLM call — the one that writes the answer:

```
get_chat_context()      1 Supabase RPC
resolve query           heuristic, 0 calls
embed query             1 call, Redis-cached by content hash
search_chunks()         1 Supabase RPC
MMR over returned vectors
stream answer           1 LLM call, streaming
```

Deleted, with reasons:

- `rag/agentic-reasoning.ts` (822 lines). Runs a full generation whose output is pasted into the
  system prompt as a reasoning scaffold (`orchestrator.ts:245`). Reasoning models do this
  internally.
- `expandQuery`, `decomposeQuery`, `generateStepBackQuery` (3 LLM calls). Hybrid retrieval with RRF
  covers what expansion and step-back approximated. Decomposition survives behind an explicit deep
  mode.
- `analyzeQuery` (1 LLM call plus a regex scrape for JSON at `query-analysis.ts:73`). Its intent
  taxonomy feeds score nudges of 1.05× and 1.1×.
- `rag/prompt-engineering.ts` (692 lines) generating adaptive system prompts. Every system-prompt
  token is billed every turn.

Kept, conditionally: follow-up resolution. "What about the second one?" cannot be embedded alone. A
heuristic gate — short message, or opening pronoun or demonstrative, with non-empty history —
routes those to one cheap structured call. Self-contained questions skip it.

Ranking: MMR over the embedding vectors `search_chunks` returns, with lambda at 0.3 —
relevance-dominant.

Embeddings stay on the existing Hugging Face Space per the user's decision. Mitigations: query
embeddings cached in Upstash Redis with a 30-day TTL, plus a keep-alive ping. **Residual risk: the
first query after an idle period pays a Space cold start. This is the largest remaining latency
spike in the design.**


## Tools

All tiers ship together, decided 2026-08-25. Retrieval is exposed to the model rather than run
ahead of it, so the model can search again with a refined query, read around a hit when an answer
straddles a chunk boundary, or skip retrieval entirely for a question about the conversation.

| Tool | What it does | What it needs |
|---|---|---|
| `search_documents(query, document_ids?, limit?)` | Hybrid RRF search. Pre-warmed speculatively. | `search_chunks` |
| `read_chunks(document_id, from, to)` | Passages either side of a hit. | nothing |
| `list_documents()` | What is attached, its kind and status. | nothing |
| `get_outline(document_id)` | Headings, sheet names, file tree, chapter timestamps. | `documents.outline jsonb` |
| `grep_document(document_id, pattern)` | Literal and regex over raw text. Beats embeddings for error codes and identifiers. | retained extracted text |
| `read_file(document_id, path, from_line, to_line)` | A file from a repository. | file paths in chunk metadata |
| `get_transcript(document_id, start_s, end_s)` | A video segment, timestamped for deep links. | timestamps in chunk metadata |
| `query_table(document_id, sql)` | Read-only SQL over a spreadsheet. | `document_tables`, `document_rows` |
| `remember(content)` / `forget(query)` | Long-term facts about the user. | `user_memories` |
| `calculate(expression)` | Sandboxed arithmetic. | nothing |
| `web_search(query)` | Off by default, per-chat toggle, citations marked differently. | nothing |

`query_table` is the expensive one and the differentiating one. `excel-extractor.ts` currently
flattens a workbook into `=== Sheet: name ===` text and embeds it, destroying columns, types and
row identity, which is why spreadsheet questions fail here and in every product that does the same.
Landing sheets as real rows and handing the model SQL is what makes tabular documents work.

Guards, because a tool loop is a new failure mode: a hard cap on tool turns per message, a
per-message token budget enforced in middleware, and every call recorded with its latency so a
runaway shows up in Langfuse rather than only on the bill.

## Transport

`POST /api/chats/[chatId]/messages`, streaming LangGraph's own format.

The bespoke four-event contract in the first draft of this design is **withdrawn**. LangChain v1's
`createAgent` is LangGraph underneath, and `@assistant-ui/react-langgraph`'s `useLangGraphRuntime`
already reads that stream: text, tool calls, interrupts, cancellation. Writing a protocol between
two things that already share one was hand-rolling. See `docs/adr/0005`.

One risk to retire early: that runtime is built against the LangGraph server API, and serving the
same shape from a plain Next route handler is supported but unproven here. Phase 3 opens with a
spike that streams one tool call end to end. The fallback is assistant-ui's `assistant-transport`
runtime, still an adopted format rather than an invented one.

Server actions cannot stream partial results, cannot be cleanly aborted, and serialize through the
RSC protocol. Token streaming, stop-generation and HTTP observability need a real endpoint.

Persistence happens at stream end through `append_message`, in one call. The handler watches
`request.signal`, so an aborted generation still persists what was produced.

Errors are HTTP status codes with RFC 9457 `application/problem+json`:

```
429 + Retry-After   rate limited
409                 document still processing
404                 no relevant content
502                 provider unavailable
```

Errors are never written to `messages`.

Uploads use signed URLs direct to Supabase Storage. File bytes never pass through a server action,
which removes the 15MB / 50MB contradiction.

One Upstash rate limiter in `platform/ratelimit`, applied at the route handler, with separate
buckets for messages, ingestion and uploads. Both current implementations are deleted.

Every route's input and output is a Zod schema in the module's `.schema.ts`, imported by handler
and client, so contract drift is a type error.

## Ingestion

The existing Hugging Face Space already exposes `/api/v1/subtitles/extract`,
`/api/v1/subtitles/transcribe` and `/api/v1/embeddings/generate` (`multiutility-api.ts:154,238,204`).
The local YouTube stack reimplements, on a host that cannot run it, a service already operating.

Delete `ytdlp-nodejs`, `@distube/ytdl-core`, `youtube-transcript`,
`@danielxceron/youtube-transcript`, `youtube-transcript-plus`, and the Cobalt fallback, along with
`youtube/download-methods.ts`, `youtube/audio-downloader.ts` and `youtube/stream-utils.ts` —
roughly 750 lines. YouTube ingestion becomes: extract subtitles; if absent, transcribe audio.

Work runs off a Postgres queue rather than inside a request:

```sql
create table ingestion_jobs (
  id bigserial primary key,
  document_id uuid not null references documents(id) on delete cascade unique,
  attempts int not null default 0,
  run_after timestamptz not null default now(),
  last_error text
);
```

Claimed with `for update skip locked`. Drained by `pg_cron` on a schedule and poked immediately by
`pg_net` on enqueue, so the common case is instant and the crash case retries with exponential
backoff. Chunks are written progressively, so a timeout resumes from the high-water `chunk_index`
rather than restarting.

Batching: the Space's embedding endpoint accepts an array. A 500-chunk document becomes roughly
five embedding calls and five `insert_document_chunks` calls, with no sleeps. Backoff happens only
on 429, honoring `Retry-After`.

Chunking is per content kind:

| Kind | Strategy | Metadata |
|---|---|---|
| pdf, doc, web | recursive character, 1000/200 | page, heading path |
| github | `fromLanguage()`, split on function and class boundaries | file path, line range |
| video | time-windowed | start and end timestamp |
| sheet | row groups with the header row repeated in every chunk | sheet name, row range |

The spreadsheet rule is a correctness fix: without repeated headers, every chunk after the first
loses its column names.

Idempotency: `documents.content_hash` from `crypto.subtle.digest`, unique on `(user_id,
content_hash)`. Re-uploading a file reuses its chunks.

## Cross-cutting

**Environment.** One Zod schema, split server and client, validated at boot. Closes the hole where
seven `RAG_*` variables are read through raw `process.env` while bypassing the schema, four of them
undeclared.

**Caching.** Upstash Redis for query embeddings keyed by content hash (30-day TTL), short-TTL
retrieval results, and the Space keep-alive. Next's `cacheComponents` keeps the shell static and
chat dynamic. `rag/cache.ts` is deleted.

**Observability.** OpenTelemetry via `instrumentation.ts`, exported to two backends: Sentry for
exceptions and request performance (its v8 SDK is OTel-based and it accepts OTLP directly), and
Langfuse for LLM and retrieval traces (also OTel-based, so an endpoint rather than a second
instrumentation layer). Langfuse traces retrieval, embedding and generation with per-trace cost and
session grouping, and is open source and self-hostable, so prompts and document content need not
leave controlled infrastructure. Product metrics live as columns on `messages`, so cost per
conversation and p95 time-to-first-token are SQL. Grafana deferred until an on-call rotation,
multi-region, or roughly 100k messages a month; because instrumentation is OTLP, that is an
exporter change.

**Testing.** Vitest for pure logic in `core/` — RRF fusion, MMR, each chunker. pgTAP for
`search_chunks`, `get_chat_context` and every trigger. One integration test: ingest a fixture PDF,
assert chunk count, query, assert the citation resolves to the right chunk.

**Retrieval eval harness.** Twenty question and expected-chunk pairs over a fixed fixture corpus,
scored on recall@k and MRR, run in CI. Without it every future change to chunking, fusion or lambda
is a guess.

**CI.** Typecheck, lint including boundary rules, vitest, pgTAP against a local Supabase, build.

**Dependencies removed:** `react-window`, `@types/react-window`, `@types/react-syntax-highlighter`
(the package it types is not installed), `@types/cheerio` (cheerio v1 ships types), six YouTube
packages, and `package-lock.json`. Added: `@sentry/nextjs`, `langfuse`, `prettier`
(already declared in `jsrepo.json` and absent), `eslint-plugin-boundaries`, `vitest`. `langchain` and
`@langchain/google-genai` are already installed and become used.

`@langchain/community` and `pdf-parse` stay: `PDFLoader` is imported by deep path at
`processors/document-processor.ts:3`, and `pdf-parse` is its peer dependency.

## Sequencing

Strangler order. Every phase ships working and deletes what it replaces in the same commit.

| Phase | Work | Deletes |
|---|---|---|
| 0. Guardrails | CI, vitest, boundary lint, prettier, one lockfile, dead deps | `react-window`, phantom `@types/*`, `package-lock.json` |
| 1. Database | rebuild: schema, enums, triggers, functions, RLS, pgTAP, generated types | hand-maintained `types/database.ts`, `data/repositories/*` |
| 2. Retrieval | `search_chunks` wired, MMR on vectors, eval harness green | `rag/*`, `pinecone.ts` — roughly 2,900 lines |
| 3. Transport | streaming route, problem+json, signed uploads, one limiter | `gemini/message-actions.ts`, `rag/rate-limiter.ts`, `rag/cache.ts` |
| 4. Ingestion | job queue, per-kind chunking, YouTube via the Space | `utils/youtube/*`, six packages, the batching in `embeddings-store.ts` |
| 5. Sweep | move survivors into `server/modules`, drop `Type` prefixes, enforce boundaries | `src/utils/`, `src/services/`, `src/data/` |

Phase 1 is the only irreversible step. `pg_dump` to a file outside the repository first.

## Risks

- **Space cold start.** Mitigated by cache and keep-alive, not eliminated. If first-query latency
  stays unacceptable after Phase 2, moving embeddings to a hosted API is the revisit, and it
  requires re-embedding the corpus.
- **Logic in SQL is harder to test and review than TypeScript.** Mitigated by pgTAP and a hard
  line: nothing that calls an LLM or an external API goes into the database.
- **Re-embedding after a schema rebuild.** 241 documents at current corpus size, one batch job.
- **RLS is unverified.** Must be established before policies are written, not assumed.
- **The service-role key was shared in a chat transcript** on 2026-08-25 and should be rotated once
  this work lands.

## Out of scope

Visual UI — components, styling, layout, the `three` bundle behind the `Dither` background. That is
the second slice. This slice may change import paths and data-fetching hooks, which the user
authorized.
