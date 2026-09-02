# Inquora non-UI core: as built

Date: 2026-09-02
Status: the backend is complete. This document is what exists, measured, and it
supersedes the design where the two disagree.
Supersedes in part: `.polaris/specs/2026-08-25-non-ui-core-design.md`
Related: `docs/adr/0001`–`0005`, the three plans in `.polaris/plans/`

## What this is for

The design was written before anything was built and it was right about most of
it. Where building it proved the design wrong, this records what replaced it and
why, so nobody reconciles the two by guessing. The design remains the argument;
this is the outcome.

## The shape

```
src/
  app/         transport only: route handlers, pages, server actions
  core/        pure domain, no I/O
    chunking/    how content becomes passages
    retrieval/   how passages are chosen, how a question is prepared
    documents/   what a document is, apart from its passages
    untrusted/   input from a model or a stranger: arithmetic, address ranges
  server/
    modules/     chat, documents, ingestion, memory, retrieval, auth
    platform/    cache, db, embeddings, http, llm, ratelimit, telemetry, websearch
  ui/          components, hooks, providers, the browser client
```

Enforced by `eslint-plugin-boundaries`: `app → modules → platform → core`, with
two named exceptions that are transport rather than leaks. HTTP framing
(`problem+json`, SSE) is the transport edge's own vocabulary, and a server action
is the transport edge for the interface, so `ui` may call one while the rest of
`app` stays closed to it.

Every type is in a `.types.ts`, every tuning number in a `.constants.ts`, every
Zod contract in a `.schema.ts`. Grammars stay next to the parser that uses them.

## The database

Nineteen migrations. Twelve tables, twenty-five functions, two views, 91 pgTAP
assertions.

| Table                              | Holds                                                                   |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `profiles`                         | one row per auth user, created by a trigger                             |
| `documents`                        | kind, status, counts, outline, retained text, content hash              |
| `document_chunks`                  | passages with a 1024-dimension vector and a generated tsvector          |
| `document_files`                   | the files of a repository, greppable and readable by line               |
| `document_tables`, `document_rows` | a spreadsheet as rows keyed by its header                               |
| `chats`, `chat_documents`          | conversations, and the documents in scope with order and an enable flag |
| `messages`, `message_parts`        | a message as an ordered list of parts, with cost columns                |
| `user_memories`                    | durable facts about the user                                            |
| `ingestion_jobs`                   | the queue, claimed with `for update skip locked`                        |

Derived state is maintained by Postgres, never by application code: chunk counts,
document status, spreadsheet row counts, chat `updated_at`, profile creation,
queue enqueue, and clearing a job when its document is ready. That is the class of
bug that left 213 of 241 documents unprocessed in the system this replaces.

Views: `stuck_ingestion_jobs` is what an alert reads, and empty is the healthy
state. `ingestion_health` is the same question as a count.

Realtime is broadcast from the database, not `postgres_changes`: a trigger calls
`realtime.broadcast_changes` on `user:<id>` for document progress and
`chat:<id>` for messages, and policies on `realtime.messages` decide who may join
a topic. A broadcast can never fail the write that caused it.

## Retrieval

One embedding call, one `search_chunks` call, ranked in process.

`search_chunks` runs pgvector and Postgres full-text search as one query and fuses
them by reciprocal rank, returning the chunk vector so MMR can rank on meaning
rather than on vocabulary. The distance expression matches the HNSW index exactly,
including the halfvec cast, or the index would never be used.

**Measured, live, 2026-09-02: recall@4 87.5%, MRR 0.933** over fifteen questions
and a three-document corpus. `bun run eval`, with floors that fail a regression.

## Answering

A tool-calling agent on LangChain v1 `createAgent`, streaming LangGraph's own
format from a plain route handler. Eleven tools:

`search_documents`, `read_chunks`, `list_documents`, `get_outline`,
`grep_document`, `list_tables`, `query_table`, `read_file`, `get_transcript`,
`remember`, `calculate`, and `web_search` behind two gates.

The first search is dispatched before the model asks for it. A question that only
makes sense in context is rewritten first, gated by a heuristic so a
self-contained question pays nothing. Tool calls are capped by LangChain's own
middleware, per message.

**Each document kind has a specialist.** A repository, a spreadsheet and a video
are not "documents": each carries its own guidance, its own tool order and its own
stated limits, composed into the system prompt from what is actually attached. A
model told only "documents" greps a spreadsheet and searches a repository.

**Measured, live, on the deployment: 200 text/event-stream, first event 3.8s,
6.5s total, three source parts persisted.** `bun run live:deployed`

## Ingestion

A queue in Postgres, drained by `pg_cron` every minute and poked by `pg_net` on
enqueue. Batches are written as they are embedded, so a retry resumes from the
high-water chunk index.

| Kind          | Read as                  | Chunked by                       | Answered with                        |
| ------------- | ------------------------ | -------------------------------- | ------------------------------------ |
| pdf, doc, web | text                     | recursive character, 1000/200    | search, read around a hit            |
| sheet         | rows per sheet           | row groups, header repeated      | SQL over the rows                    |
| slides        | one part per slide       | one chunk per slide              | search, by slide number              |
| video         | subtitles from the Space | time windows                     | transcript by the second             |
| github        | one zipball              | file summaries and documentation | grep and read_file over stored files |
| image         | described by the model   | one chunk                        | search over the description          |

**A repository is indexed by what answers questions about it.** Files are stored
and greppable; embeddings are spent on documentation and on a per-file summary of
its declarations. Measured on supabase/supabase-js: 516 files, 3.6MB greppable,
711 chunks — against 2,664 for the first version that embedded every body.

**Measured, live: a real PDF end to end in 3.0 seconds.** A real two-sheet xlsx
answered a filter, a sum and a group-by exactly.

## Where the design was wrong

1. **MMR needed the vectors returned.** `search_chunks` had to grow a column.
2. **A statement-level trigger has no NEW or OLD.** Transition tables instead.
3. **`initChatModel` cannot be bundled.** Its dynamic import is untraceable, so
   providers are a static map keyed by the same provider string.
4. **`gemini-flash-latest` answers 503 under load.** The default is pinned.
5. **Embedding a whole repository is the wrong index.** See above.
6. **The Space keep-alive was cut** by the user: the cold start is acceptable.

## What is not built, deliberately

- **Grafana.** ADR 0004 defers it; the metric columns answer the same questions in
  SQL at this volume.
- **Deep mode.** Query decomposition behind an explicit flag, from the design's
  retrieval section. Not built, and the eval harness is what should justify it.
- **Anything visual.** That is slice two.
