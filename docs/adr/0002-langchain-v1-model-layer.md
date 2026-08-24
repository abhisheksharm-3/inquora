# 0002. The model layer is LangChain v1

Date: 2026-08-25
Status: accepted

## Context

Chat runs on `@google/generative-ai`, the deprecated legacy Google SDK, wired directly into
`gemini/client.ts`. Structured output is obtained by prompting for JSON and scraping it with a
regex (`rag/query-analysis.ts:73`), which silently falls back to a keyword heuristic whenever the
model wraps its JSON in prose. There is no streaming. The provider is hard-coded, so routing a
cheap query to a small model is a code change.

## Decision

Use LangChain v1's `initChatModel` with provider strings, Zod `responseFormat` for structured
output, and native token streaming.

## Consequences

Provider becomes configuration: `"google:gemini-…"`, `"anthropic:…"`. Routing simple lookups to a
small model and hard synthesis to a large one is a config edit, which is the main lever on cost per
answer.

Structured output is validated and retried at the framework layer, deleting the regex scrape and
its silent fallback.

Streaming arrives natively, which the transport layer requires.

`langchain` is already a declared dependency with zero imports, so this adds no new package.

Cost: a framework dependency in the inference path. Mitigated by keeping LangChain out of
retrieval, which is now SQL, and out of `core/`, which stays pure.
