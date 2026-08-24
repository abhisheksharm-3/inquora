# 0003. Integrity, aggregation and retrieval live in Postgres

Date: 2026-08-25
Status: accepted

## Context

Bookkeeping the database could enforce is scattered across the application and mostly does not run.
`processing_status` is `idle` on 213 of 241 files because the write-back in `_handleProcessableFile`
rarely fires; `indexed_chunks` is written by nothing reliable; chat history sorts by chat creation
rather than last activity; sending one message costs six sequential Supabase roundtrips
(`gemini/message-actions.ts:186-256`).

## Decision

Push integrity, aggregation and retrieval into Postgres — triggers for derived state, functions for
transactional units, `FOR UPDATE SKIP LOCKED` for the ingestion queue. Orchestration and anything
calling an LLM or external API stays in TypeScript.

## Consequences

Derived state stops drifting because it is no longer optional: `chunk_count`, `status`,
`updated_at` and profile creation are all trigger-maintained.

`get_chat_context` collapses six roundtrips into one. `append_message` writes a message and its
citations atomically.

The ingestion queue needs no vendor — Postgres has had the pattern for years.

Cost: SQL is harder to unit-test and review than TypeScript, and logic in the database is less
visible to a reader of the application code. Mitigated with pgTAP coverage on every function and
trigger, and by the hard line above.
