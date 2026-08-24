# 0004. Instrument with OpenTelemetry; Sentry for errors, Langfuse for LLM traces

Date: 2026-08-25
Status: accepted

## Context

Every failure path is a `console.error` into Vercel's log retention. Fourteen documents sit in
`failed` with an error string and nobody was notified. There are no product metrics, so cost per
answer and time-to-first-token are unmeasured, which makes "cheaper and faster" unfalsifiable.

Two kinds of signal are needed and they are not the same. An exception with a stack trace is one
problem. Which chunks were retrieved, how the fused ranking scored them, what the prompt contained
and what the model cost is a different one, and general-purpose error tracking answers it badly.

## Decision

Instrument once against OpenTelemetry through `instrumentation.ts`. Export to two backends:

- **Sentry** for exceptions and request performance. Its v8 SDK is built on OpenTelemetry and it
  accepts OTLP directly (`docs.sentry.io/concepts/otlp`).
- **Langfuse** for LLM and retrieval traces. It is built on OpenTelemetry, so it is an OTLP
  endpoint rather than a second instrumentation layer.

Product metrics stay as columns on `messages`. Grafana is deferred.

## Consequences

Instrumenting against the standard rather than a vendor client means every backend is an exporter
setting. Adding, swapping or dropping one is configuration.

Langfuse traces the whole chain — retrieval, embedding calls, the generation — with per-trace cost
and session grouping across a multi-turn conversation. That is exactly the view needed to tune
chunking, fusion and lambda, and it pairs with the eval harness: the harness says whether recall
moved, Langfuse says why.

Langfuse is open source and self-hostable, so prompts and document content need not leave
infrastructure the project controls. This is why it is chosen over LangSmith, which was the earlier
proposal in this design: LangSmith would have been a third-party data path flagged off in
production, which is a capability you cannot then rely on in production.

`latency_ms`, `retrieval_ms`, `tokens_in`, `tokens_out` and `model` on `messages` keep cost per
conversation and p95 time-to-first-token as plain SQL, with no export lag. Langfuse is the
debugging view; the database is the source of truth for billing-shaped questions.

Grafana remains a stack — agent, log ingestion, metric storage, dashboards — for data that
currently fits in one table of 851 rows. Revisit at an on-call rotation, multi-region, or roughly
100k messages a month. Because the instrumentation is OTLP, that is an exporter change.

Cost: two backends to keep configured, and self-hosted Langfuse is infrastructure to run. Start on
Langfuse Cloud's free tier and self-host only if data residency demands it.
