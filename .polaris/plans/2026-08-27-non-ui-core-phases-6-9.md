# Inquora non-UI core: implementation plan, phases 6 to 9

**Status: executed on 2026-09-02.** Phases 6 to 9 are built. What exists is
recorded in `.polaris/specs/2026-09-02-non-ui-core-as-built.md`, which supersedes
the original design where the two disagree.

**Goal:** Finish the backend. Nothing about the interface starts until every item here is either
built or explicitly cut, because a frontend built against a half-built backend encodes the gaps.

**Prerequisite:** phases 0 to 5, landed 2026-08-27. The answer path is proven end to end on the
deployment: 200 text/event-stream, first event 3.8s, three source parts persisted.

**Spec:** `.polaris/specs/2026-08-25-non-ui-core-design.md`. These phases build what that document
described and the first five phases did not reach.

## What is missing, and the order it gets built in

Measurement first, because the product's claim is cost and latency and neither is currently
observable. Then the differentiator. Then breadth.

---

# Phase 6: measurement, and the parts of the answer path that were left dangling

### Task 6.1: Write the metrics the schema already has columns for

`messages` carries `tokens_in`, `tokens_out`, `model` and `retrieval_ms`, and only `latency_ms` is
ever written. Cost per conversation and p95 time to first token are supposed to be plain SQL; today
they are unanswerable.

The agent reports usage per turn, so the service reads it off the stream and passes it to
`append_message`.

### Task 6.2: Wire follow-up resolution, which is built and called by nothing

`needsFollowUpResolution` is tested and unused. "What about the second one?" is embedded as written,
so retrieval runs on grammar rather than on subject.

The heuristic gates one cheap structured call that rewrites the message against the last few turns.
A self-contained question skips it, which is the whole point of the gate.

### Task 6.3: Instrument once, against OpenTelemetry

`instrumentation.ts`, exporting to Sentry for exceptions and Langfuse for LLM and retrieval traces,
per ADR 0004. Every tool call records its latency, so a runaway loop shows up in a trace rather than
only on the bill.

**Cut on 2026-08-27:** the Space keep-alive ping the design proposed for the 18-second cold start.
The user decided the cold start is acceptable. Revisit only if first-query latency becomes a
complaint.

---

# Phase 7: tabular documents, the differentiator

The design calls `query_table` "the expensive one and the differentiating one". Sheet chunking
exists, so a spreadsheet is searchable as prose; the numbers in it are still not queryable.

### Task 7.1: Land sheets as rows

`document_tables` and `document_rows`, written during ingestion alongside the chunks, so a workbook
keeps its sheets, its header and its row identity.

### Task 7.2: `query_table`, read-only and fenced

A single `select` over one document's rows, with the sheet's own column names, a statement timeout, a
row cap, and a rejection of anything that is not a select. The SQL comes from a language model, so
the fence is the feature.

---

# Phase 8: the tools that need columns

### Task 8.1: `documents.outline` and `get_outline`

Headings for prose, sheet names for a workbook, the file tree for a repository. Consulting an outline
before searching is cheaper than searching twice.

### Task 8.2: Retained text and `grep_document`

Literal and regex matching beats embeddings for error codes and identifiers, and needs the extracted
text kept rather than thrown away after chunking.

### Task 8.3: `get_transcript`, with real timestamps

Video citations point at a passage rather than a second, because the transcript is stored with
positions rather than times.

### Task 8.4: `read_file` for repositories, and `web_search`

`read_file` needs file paths in chunk metadata, which phase 9 lands. `web_search` is off by default,
per-chat, with citations marked differently.

---

# Phase 9: the content kinds that fail on extraction

`github`, `slides` and `image` are values in the `document_kind` enum with no extractor, so a
document of those kinds is created and then fails with a reason. Each needs its own extraction and
its own chunking rule: code splits on function and class boundaries with file path and line range,
slides split per slide, and an image is described rather than read.

---

## Exit criteria

- [ ] `bun run typecheck && bunx eslint src && bun run test && bun run build`
- [ ] `bun run db:test`
- [ ] `bun run eval` at or above its floors
- [ ] `bun run live:deployed` answers, with token counts and a model recorded on the message
- [ ] A spreadsheet question answered from a `query_table` call rather than from embedded prose
- [ ] Every value of `document_kind` has an extractor, or is removed from the enum

---

## What actually happened

**Phase 6, measurement.** The metric columns are written — tokens in and out
accumulated across a tool-calling turn, the model that answered, and retrieval
time measured around the tool whether the search was served speculatively or not.
The follow-up heuristic is wired, which it was not: it had been built, tested and
called by nothing. OpenTelemetry runs through `instrumentation.ts` with Sentry and
Langfuse as exporters, and spans cover the answer, the rewrite, retrieval, each
embedding call and every tool call.

**Phase 7, tabular.** `document_tables` and `document_rows`, written during
ingestion, and `query_document_table` running one fenced select over a view of one
sheet. Verified live against a real two-sheet workbook: a filter, a sum and a
group-by, all exact.

**Phase 8, the tools that needed columns.** `documents.outline` and
`extracted_text`, `get_outline`, `grep_document`, `read_file`, `get_transcript`
and `web_search`. Eleven tools, which closes the design's list.

**Phase 9, the remaining kinds.** Repositories, presentations and images all
read. Then rebuilt: the first repository version embedded 2,664 chunks for 399
files, and the second stores files and embeds only what describes them — 516
files, 3.6MB greppable, 711 chunks.

**Not in the plan, added because the user asked.** A specialist per document kind,
so a repository, a spreadsheet and a video are answered differently rather than
all being "documents". Realtime as broadcast from the database. The message rate
limit, which was built and never applied to the answer route. And the directory
restructure: types to `.types.ts`, dials to `.constants.ts`, `core/` grouped by
concern, `ui/` holding the interface, thirty-nine unreachable files deleted.

**Cut.** The Space keep-alive ping, by the user: the cold start is acceptable.

---

## After the reviews

Seven reviews ran over the finished backend on 2026-09-02: correctness, security,
performance, database, transport, maintainability and over-engineering. Acting on
them was not a tidy-up.

**A live authorization hole.** The queue's four `security definer` functions had no
`revoke`, and Postgres grants EXECUTE to PUBLIC while Supabase exposes the public
schema through PostgREST. Verified against the deployment before fixing: a caller
holding only the publishable key got 200 from `claim_ingestion_job`. Verified
after: 42501.

**A browser could forge derived state.** One PATCH set a document to `ready` with
`chunk_count: 9999` and it stuck. A policy chooses rows; a grant chooses columns,
and only the first was right. Every row-level test passed throughout, which is why
the suite now proves isolation by running as `authenticated` with a real claim.

**The persisted answer was one character.** `streamMode: "messages"` yields
deltas and the code assigned where it had to append — reproduced at 44 chunks
storing ".". Every deployed test had passed because those answers arrived in one
chunk.

**A document was ready when it started.** Status flipped on the first chunk, which
deleted the queue row, so a worker dying on batch two left a document reporting
ready with a fifth of its content and nothing to retry it. The 213-of-241 failure,
through a different door.

**MMR was selecting for diversity.** The fused score is bounded by 0.033 and the
redundancy term is a cosine in 0..1, so relevance was swamped. Normalizing moved
recall@4 from 87.5% to 93.8% and MRR from 0.933 to 0.967 — the one review finding
that improved the product rather than only its correctness.

Also: `remember()` failed on every call, a cancelled stream lost its answer, a
cited document could never be deleted, two versions of `append_message` were live
at once, a spreadsheet with an "Updated" column was unqueryable forever, thirty
dependencies were installed and imported nowhere, and `undici` was imported and
never declared — resolving only through packages that were about to be removed.

Five of these were found by running the thing rather than reading it, and three
only after deploy. That is the argument for the rule about a live end-to-end run,
written down where the next person will read it.
