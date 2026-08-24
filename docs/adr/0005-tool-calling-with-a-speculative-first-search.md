# 0005. Tool calling, with a speculative first search, over the LangGraph stream

Date: 2026-08-25
Status: accepted
Supersedes in part: the agentic-layer deletion and the four-event SSE contract in
`.polaris/specs/2026-08-25-non-ui-core-design.md`

## Context

The design deleted the agentic layer, and two follow-on decisions rested on its absence: retrieval
became a fixed step ending in one generation call, and the stream carried four bespoke events.

Both were correct given the premise. The premise has changed: tool calling is a requirement.

The deletion of `agentic-reasoning.ts` still stands and is unrelated. That file ran a second full
generation whose entire output was pasted into the system prompt as a "reasoning scaffold" — paying
for one generation to produce input for another. Real tool calling is the thing it imitated badly.

## Decision

The intelligence layer becomes a tool-calling agent on LangChain v1's `createAgent`, with retrieval
exposed as a tool rather than run as a fixed step.

The wire format is **LangGraph's own stream**, consumed by `@assistant-ui/react-langgraph`'s
`useLangGraphRuntime`. No protocol is written and none is adopted alongside. LangChain v1's
`createAgent` is LangGraph underneath, so the agent's native stream is already the format the React
layer reads: streaming text, tool calls, interrupts, cancellation, and per-chunk metadata
identifying which node produced it.

To protect latency, the first search is **speculative**: retrieval for the raw user query is
dispatched in parallel with the first model call. If the model calls the search tool with a
comparable query, the pre-warmed result is served without a second roundtrip. If it does not
search, the cost is one embedding call, usually absorbed by the Redis cache.

## AG-UI was considered and rejected

AG-UI is a good standard and its event set maps cleanly onto what this agent produces. It is
nonetheless a third vocabulary in a two-vocabulary problem.

The stack is LangChain on the server and assistant-ui in the browser, and assistant-ui already
reads LangChain's stream. Inserting AG-UI means translating LangGraph events into AG-UI events on
the server and AG-UI events into assistant-ui parts in the browser: two mappings, both hand-written,
both able to drift, in place of none.

AG-UI earns its place when a frontend must speak to several different agent backends, or when a
third party consumes the agent. Neither is true here — one backend, one frontend, both ours.
Revisit if either changes.

## Consequences

**Answer quality rises where a fixed pipeline could not reach.** The model can search again with a
refined query, read the chunks either side of a hit when an answer straddles a boundary, consult an
outline before searching, or skip retrieval entirely for "summarize what we just discussed" — which
the always-retrieve design pays full price for and gains nothing from.

**Latency is protected, not free.** A fixed pipeline is one generation. A tool-calling loop is at
least two model turns whenever the model searches. The speculative search removes the retrieval
roundtrip from that path but not the extra model turn. The honest expectation is a slightly later
first token in exchange for a materially better answer, and the eval harness is what decides
whether the trade held.

**A message stops being a string.** It becomes an ordered list of parts — text, reasoning, tool
call, tool result, source — which is how both LangGraph and assistant-ui model it. The planned
`message_citations` table is absorbed as the source part kind. This lands in Phase 1, because
Phase 1 is the irreversible step.

**Tool results are persisted, not only streamed.** A conversation replayed without its tool calls
loses the reason an answer said what it said, and "which chunks did this answer stand on" stops
being answerable in SQL.

**One risk to retire early.** `@assistant-ui/react-langgraph` is built against the LangGraph SDK and
its server API. Serving the same stream shape from a plain Next route handler is supported, and it
is not yet proven in this codebase. Phase 3 opens with a spike that streams one tool call
end-to-end before anything is built on the assumption. If the shape turns out to be awkward to
serve, the fallback is assistant-ui's `assistant-transport` runtime, which is designed for exactly
that case — still an adopted format rather than an invented one.

**A new failure mode arrives: the tool loop.** A model can call the same tool repeatedly without
converging. Mitigations are a hard cap on tool turns per message, a per-message token budget in
middleware, and every tool call recorded with its latency, so a runaway loop shows up in Langfuse
rather than only on the bill.
