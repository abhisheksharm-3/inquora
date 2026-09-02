import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/ui/components/marketing/SiteFooter";
import { SiteHeader } from "@/ui/components/marketing/SiteHeader";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "What Inquora does when you ask a question, what it is built on, and what it measures.",
};

/**
 * The page for somebody who wants the engineering.
 *
 * These numbers were on the landing page, which was a mistake: `recall@4` and
 * `MRR` are benchmarks for machine-learning engineers, and a homepage that
 * leads with them is written for the people who built it. They are real and
 * worth publishing, so they live here, where the reader has asked for them.
 *
 * Every figure is dated and names the command that produced it. A number about
 * provenance with no provenance would be the wrong page to put on this product.
 */
const measured = [
  {
    value: "93.8%",
    label: "Recall at four passages",
    note: "With a mean reciprocal rank of 0.967, over the fixture corpus. The right passage is usually the first one.",
    command: "bun run eval",
  },
  {
    value: "3.6s",
    label: "To the first word of an answer",
    note: "6.3 seconds to a complete answer with its sources stored, against the deployed endpoint and a real model.",
    command: "bun run live:deployed",
  },
  {
    value: "3s",
    label: "To read a PDF end to end",
    note: "Extraction, chunking and embedding. A 516-file code repository takes 1.3 seconds and becomes 711 passages.",
    command: "bun run scripts/live-ingest.ts",
  },
  {
    value: "143",
    label: "Database assertions",
    note: "Ownership, isolation and column privileges, run against the real schema rather than a mock of it.",
    command: "bun run db:test",
  },
];

const pipeline = [
  {
    heading: "One search, not four",
    body: "Vector similarity and Postgres full-text search run inside a single SQL function and are combined by reciprocal rank fusion, so an exact term and a paraphrase both find the passage. The results are then spread out by maximal marginal relevance, so four near-identical paragraphs do not crowd out the one that answers the question.",
  },
  {
    heading: "Searching is a decision, not a step",
    body: "The model is given search as a tool rather than handed results. It can search again with better wording, read the passages either side of a hit when an answer straddles a boundary, or skip retrieval entirely when the question is about the conversation. The first search is dispatched speculatively while the prompt is still being assembled, and thrown away if the model asks something different.",
  },
  {
    heading: "One model call, usually two",
    body: "The system this replaced made five to eight model calls before a single word of the answer existed: query analysis, expansion, decomposition, a step-back pass and a separate reasoning pass. Those are gone. What is left is the call that writes the answer, plus one more when it decides to search.",
  },
  {
    heading: "The database keeps itself correct",
    body: "Whether a document has finished indexing, how many passages it has, how many rows a sheet holds: all of it is maintained by triggers rather than by application code that might not run. In the previous system that code mostly did not run, and 213 of 241 documents sat unprocessed while reporting nothing wrong.",
  },
  {
    heading: "Answers stream, and stop when you do",
    body: "Text arrives as it is written, over a plain server-sent event stream. Closing the tab aborts the generation, so an abandoned answer stops costing anything, and whatever had been written is still stored rather than lost.",
  },
];

const stack = [
  ["Database", "Postgres on Supabase, with pgvector for embeddings and pgTAP for its tests"],
  ["Search", "One SQL function: HNSW vector index plus full-text, fused by rank"],
  ["Embeddings", "1024 dimensions, self-hosted, computed once per passage and cached"],
  ["Model layer", "LangChain v1 with tool calling, over Gemini"],
  ["Interface", "Next.js 16.3 and React 19.2, streamed, with static shells"],
  ["Isolation", "Row-level security on every table, asserted as a signed-in user in tests"],
];

const HowItWorks = () => (
  <div className="min-h-dvh bg-ground text-ink">
    <SiteHeader current="how" />

    <div>
      <main className="px-7 pt-14 pb-12 wide:px-10 wide:pt-16">
        <p className="mb-6 font-record text-label text-faint uppercase tracking-[0.16em]">
          Under the hood
        </p>

        <h1 className="mb-6 max-w-[22ch] font-light font-reading text-[clamp(2.1rem,4.2vw,3.1rem)] text-ink leading-[1.08] tracking-[-0.02em]">
          What happens when you ask a question.
        </h1>

        <p className="mb-0 max-w-[58ch] font-light font-reading text-[1.12rem] text-soft leading-[1.65]">
          The short version: one search rather than four, one model call rather than eight, and
          every passage the answer used written down beside it. The longer version, with the numbers
          and the commands that produced them, is below.
        </p>
      </main>

      <section className="border-rule border-t px-7 py-12 wide:px-10">
        <h2 className="mb-1.5 font-light font-reading text-[1.7rem] text-ink leading-tight">
          Measured, not promised.
        </h2>
        <p className="mb-10 max-w-[54ch] font-record text-record text-soft leading-relaxed">
          Every figure below was produced by a command in this repository, against the live system
          and a real model provider, on 2 September 2026. A green test suite is not evidence that a
          model pipeline works.
        </p>

        <dl className="grid grid-cols-1 gap-x-10 gap-y-10 sm:grid-cols-2">
          {measured.map((entry) => (
            <div key={entry.label} className="border-rule border-t pt-5">
              <dd className="font-light font-reading text-[2.6rem] text-ink leading-none tabular tracking-[-0.02em]">
                {entry.value}
              </dd>
              <dt className="mt-3 font-medium font-record text-label text-ink uppercase tracking-[0.12em]">
                {entry.label}
              </dt>
              <p className="mt-2 max-w-[44ch] font-light font-reading text-[0.98rem] text-soft leading-relaxed">
                {entry.note}
              </p>
              <p className="mt-2.5 font-record text-label text-faint">{entry.command}</p>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-rule border-t px-7 py-12 wide:px-10">
        <h2 className="mb-10 font-light font-reading text-[1.7rem] text-ink leading-tight">
          Five decisions that account for most of it.
        </h2>

        <ol className="m-0 grid list-none grid-cols-1 gap-0 p-0">
          {pipeline.map((entry, index) => (
            <li
              key={entry.heading}
              className="grid grid-cols-[2.6rem_minmax(0,1fr)] gap-4 border-rule border-t py-7"
            >
              <span className="pt-1.5 font-medium font-record text-label text-mark tabular">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="mb-2.5 max-w-[34ch] font-light font-reading text-[1.3rem] text-ink leading-snug">
                  {entry.heading}
                </h3>
                <p className="max-w-[68ch] font-light font-reading text-[1.02rem] text-soft leading-[1.7]">
                  {entry.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-rule border-t px-7 py-12 wide:px-10">
        <h2 className="mb-8 font-light font-reading text-[1.7rem] text-ink leading-tight">
          What it is built on.
        </h2>

        <dl className="m-0 grid grid-cols-1 gap-0">
          {stack.map(([name, detail]) => (
            <div
              key={name}
              className="grid grid-cols-1 gap-1 border-rule border-t py-4 sm:grid-cols-[14rem_minmax(0,1fr)] sm:gap-6"
            >
              <dt className="font-medium font-record text-label text-faint uppercase tracking-[0.12em]">
                {name}
              </dt>
              <dd className="m-0 max-w-[64ch] font-light font-reading text-[1rem] text-soft leading-relaxed">
                {detail}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-rule border-t px-7 py-14 wide:px-10">
        <p className="mb-8 max-w-[34ch] font-light font-reading text-[1.9rem] text-ink leading-tight tracking-[-0.015em]">
          None of that matters unless the answer is right. Check one yourself.
        </p>
        <Link
          href="/signup"
          className="inline-flex h-11 items-center rounded-hair border border-mark px-5 font-record text-[0.74rem] text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash"
        >
          Start reading
        </Link>
      </section>

      <SiteFooter />
    </div>
  </div>
);

export default HowItWorks;
