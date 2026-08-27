# Inquora non-UI core: implementation plan, phases 2 to 5

**Goal:** Build retrieval, transport and ingestion on the Phase 1 schema, then delete the trees
they replace.

**Spec:** `.polaris/specs/2026-08-25-non-ui-core-design.md`
**Decisions:** `docs/adr/0001`–`0005`
**Prerequisite:** Phase 1, landed on 2026-08-27. Remote schema is the eight migrations, 46 pgTAP
assertions green, generated types at `src/core/database.types.ts`.

## What changed from the design, and why

**Deletions move to the phase that removes their last caller.** The design's sequencing table has
Phase 2 deleting `rag/*`, but `gemini/message-actions.ts` still imports it until the streaming route
replaces it in Phase 3. Deleting earlier would leave the repository unbuildable, which the strangler
rule exists to prevent. So `rag/*` and `pinecone.ts` go in Phase 3, and Phase 5 sweeps the rest.

## Global constraints

Everything from `CLAUDE.md` and the Phase 0–1 plan still applies: bun, 1024 dimensions, the
`app → server/modules → server/platform → core` boundary, `Result` across boundaries, `AppError`
carrying its own status, no `Type` prefix, standard before hand-rolled.

Two more, specific to this half:

- **`core/` performs no I/O and imports nothing but `core/`.** MMR, the follow-up heuristic and
  every chunker live there precisely so they are testable without a network.
- **A provider is reached through exactly one module in `platform/`.** No route handler and no
  service constructs a provider client.

## Credentials this half needs

| Variable                                                    | Needed by                    | Status on 2026-08-27                                                                                                   |
| ----------------------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_DB_URL`                                           | CI migrate job               | set                                                                                                                    |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | every request                | in Vercel, placeholders locally                                                                                        |
| `MULTIUTILITY_API_KEY`                                      | embeddings, transcription    | **missing.** The Space answers `/health` unauthenticated and returns 401 on `/embeddings/generate` without `x-api-key` |
| `GEMINI_API_KEY`                                            | generation                   | **missing**                                                                                                            |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`        | embedding cache, rate limits | **missing**                                                                                                            |

Where a credential is absent, the work is built and unit-tested against a fake transport, and the
live end-to-end run is recorded as not done. A green unit suite is not evidence for an AI pipeline.

---

# Phase 2: retrieval

### Task 2.1: The environment schema, one place, validated at boot

One Zod schema in `server/platform/env.ts`, server and client split. Closes the hole where seven
`RAG_*` variables were read through raw `process.env` while bypassing the schema, four of them
undeclared. Optional providers are optional in the schema, so a missing Redis is a known state
rather than a crash.

Tests: parsing a complete environment succeeds; a missing required key names the key; an optional
provider absent leaves `undefined` rather than throwing.

### Task 2.2: MMR over vectors, in `core/`

`mmr(candidates, lambda, limit)` over the vectors `search_chunks` returns, lambda 0.3,
relevance-dominant. Replaces the Jaccard word overlap over full document text at
`retrieval-engine.ts:295,341`, and the bug where `diversityThreshold: 0.7` was passed as lambda,
giving diversity more than double the weight of relevance.

Tests: identical vectors are not both selected; the most relevant candidate is always first; lambda
1.0 degenerates to pure relevance order; an empty candidate list returns empty.

### Task 2.3: The embeddings client, cached

`platform/embeddings` wraps the Space's `/api/v1/embeddings/generate`: an array in, 1024-dimension
vectors out, `AbortSignal.timeout`, one retry on 429 honouring `Retry-After`. `platform/cache` wraps
Upstash, keyed by `crypto.subtle.digest` over the text, 30-day TTL. Cache absent means uncached, not
a second in-process implementation.

Tests, against a fake fetch: a batch returns one vector per input; a wrong dimension is an error and
not a silent pass; a 429 is retried once and then surfaces as `AppError.rateLimited`; a cache hit
issues no request.

### Task 2.4: The retrieval module

`retrieval.repository.ts` calls `search_chunks` and nothing else. `retrieval.service.ts` embeds the
query, searches, applies MMR, returns `Result<RetrievedChunk[], AppError>`. `retrieval.schema.ts`
holds the Zod contract.

Tests: the repository passes document ids and limit through; the service returns
`AppError.notFound` when nothing matches; MMR is applied to what search returns.

### Task 2.5: The follow-up heuristic, in `core/`

`needsFollowUpResolution(message, historyLength)`: short message, or an opening pronoun or
demonstrative, with non-empty history. Self-contained questions skip the extra call entirely.

Tests: "what about the second one?" with history is true; the same with no history is false; a long
self-contained question is false.

### Task 2.6: The eval harness

Question and expected-chunk pairs over a fixture corpus, scored on recall@k and MRR, runnable with
`bun run eval`. Nightly in CI rather than per pull request, because it spends provider calls.

Recorded honestly: the harness lands with the pairs it has, and it cannot be run against real
embeddings until `MULTIUTILITY_API_KEY` exists.

---

# Phase 3: transport

### Task 3.1: The spike that retires the unproven risk

Stream one tool call end to end from a plain Next route handler in the shape
`@assistant-ui/react-langgraph`'s `useLangGraphRuntime` reads. This is the one risk ADR 0005 names
as supported but unproven here. The fallback is assistant-ui's `assistant-transport` runtime.

### Task 3.2: The model layer

`platform/llm` on LangChain v1 `initChatModel` with provider strings and native streaming, per
ADR 0002.

### Task 3.3: The tools

`search_documents`, `read_chunks`, `list_documents`, `remember`, `calculate` first, each a Zod
schema plus a function over the repository layer. `get_outline`, `grep_document`, `read_file`,
`get_transcript`, `query_table` and `web_search` need columns or tables Phase 4 lands, so they
follow it.

Guards, because a tool loop is a new failure mode: a hard cap on tool turns per message, a
per-message token budget, and every call recorded with its latency.

### Task 3.4: The streaming route

`POST /api/chats/[chatId]/messages`. One `get_chat_context`, speculative first search per ADR 0005,
stream, then one `append_message` at stream end. Watches `request.signal`, so an aborted generation
still persists what was produced. Errors are status codes with RFC 9457 `application/problem+json`,
never rows in `messages`.

### Task 3.5: Signed uploads and one rate limiter

Uploads go direct to Supabase Storage through a signed URL, so bytes never pass through a server
action and the 15MB/50MB contradiction disappears. One Upstash limiter in `platform/ratelimit` with
separate buckets for messages, ingestion and uploads.

### Task 3.6: Delete what this replaces

`gemini/message-actions.ts`, `rag/*`, `pinecone.ts`, `rag/rate-limiter.ts`, `rag/cache.ts` —
roughly 2,900 lines.

---

# Phase 4: ingestion

### Task 4.1: Per-kind chunking, in `core/`

pdf/doc/web recursive 1000/200 with page and heading path; github by language on function and class
boundaries with file path and line range; video time-windowed with timestamps; sheet by row groups
**with the header row repeated in every chunk**, which is a correctness fix rather than a nicety.

Tests per chunker, including the one that matters: every sheet chunk after the first still carries
its column names.

### Task 4.2: The worker

Claims with `claim_ingestion_job`, extracts, chunks, embeds in batches, writes with
`insert_document_chunks`, completes or fails the job. Chunks are written progressively, so a timeout
resumes from the high-water `chunk_index`. Backoff only on 429, honouring `Retry-After`.

### Task 4.3: The drain

`pg_cron` on a schedule, poked immediately by `pg_net` on enqueue, so the common case is instant and
the crash case retries. A stuck-job view, because the failure that started all this was 213
documents sitting unprocessed with nobody told.

### Task 4.4: YouTube through the Space

Extract subtitles; if absent, transcribe audio. Deletes `utils/youtube/*` and six packages, roughly
750 lines, including a path that spawned a binary from `node_modules` on a host that cannot run it.

### Task 4.5: Idempotency

`content_hash` from `crypto.subtle.digest`, unique on `(user_id, content_hash)` — already in the
schema. Re-uploading a file reuses its chunks instead of paying to embed them again.

---

# Phase 5: sweep

Move the survivors into `server/modules`, drop the `Type` prefix from more than sixty exported
names, extend the boundary rules to what is left, and delete `src/utils/`, `src/services/` and
`src/data/`. The react-compiler warnings block in `eslint.config.mjs` goes when the UI slice lands,
not here.

---

## Exit criteria for this half

- [ ] `bun run typecheck && bunx eslint src && bun run test && bun run build`
- [ ] `bun run db:test` green
- [ ] One live end-to-end run: a real document ingested, a real question answered from it, with the
      citation resolving to the right chunk. Needs `MULTIUTILITY_API_KEY` and `GEMINI_API_KEY`.
- [ ] The eval harness runs and prints recall@k and MRR
- [ ] `src/utils`, `src/services`, `src/data` are gone
