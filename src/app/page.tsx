import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/ui/components/marketing/SiteFooter";
import { SiteHeader } from "@/ui/components/marketing/SiteHeader";
import { WorkedExample } from "@/ui/components/marketing/WorkedExample";
import { Underlined } from "@/ui/components/shared/Underlined";

export const metadata: Metadata = {
  title: "Inquora — every answer shows you where it came from",
  description:
    "Add a report, a spreadsheet or a paper, ask a question in your own words, and click any claim to land on the lines it came from.",
};

/**
 * Surface 01, the brand register.
 *
 * No centred hero and no split hero with an animation beside the text, both of
 * which are hard bans. The page is built like the product: a claim on the left,
 * and the things backing it on the right.
 *
 * Two rules this page had to learn the hard way.
 *
 * **No jargon.** The first version led with `recall@4 93.8%`, `MRR 0.967`, "one
 * model call before the answer" and "vector similarity fused by rank", and
 * labelled its right-hand column "Apparatus · 3 specimens". Every one of those
 * is either a benchmark for machine-learning engineers or the design system's
 * internal codename. The numbers are real and they now live on `/how-it-works`,
 * where somebody who wants them can find them. A landing page says what you get.
 *
 * **No forced theme.** It also carried `data-theme="dark"` on its container to
 * commit to the dark ground. That redefined the tokens for the subtree but not
 * what the subtree inherited: `body` had already resolved `color: var(--ink)`
 * and passed that computed colour down, so choosing Light painted near-black
 * text on a dark ground. A theme is a document-level decision, and this surface
 * distinguishes itself by composition and type instead.
 */
const backing = [
  {
    heading: "It quotes rather than summarises",
    body: "The answer names the lines it used, and they stay attached to the conversation. Come back in a month and the sources are still there.",
  },
  {
    heading: "It reads a spreadsheet as a spreadsheet",
    body: "Ask for a figure and it reads the cell, rather than a sentence somewhere else describing the cell.",
  },
  {
    heading: "It says when it does not know",
    body: "If your documents do not answer the question, it tells you that, instead of filling the gap with something plausible.",
  },
];

const strip = [
  {
    heading: "What you can add",
    body: "Reports, papers and contracts. Spreadsheets and slide decks. Code repositories. Recorded meetings and their transcripts.",
  },
  {
    heading: "Several at once",
    body: "Put five documents in one conversation, and switch any of them in or out of the question without starting over.",
  },
  {
    heading: "Yours alone",
    body: "Only you can read your files. Nothing is used for training. Deleting a document deletes everything derived from it.",
  },
];

const steps = [
  {
    heading: "Ask it the way you would ask a colleague",
    body: "No search syntax and no keywords. A whole question in a whole sentence.",
  },
  {
    heading: "Watch it work",
    body: "You see what it searched for and what it found, while it is happening, rather than a spinner and then a wall of text.",
  },
  {
    heading: "Check any sentence",
    body: "Every claim carries a small number. Click it and the document opens at the lines behind that sentence, with them marked.",
  },
];

const Home = () => (
  <div className="min-h-dvh bg-ground text-ink">
    <SiteHeader />

    <div>
      <section className="grid min-h-[calc(100svh-4rem)] grid-rows-[minmax(0,1fr)_auto]">
        <div className="grid grid-cols-1 wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]">
          <main className="flex flex-col justify-center px-7 py-14 wide:px-10">
            <p className="mb-5 font-record text-label text-faint uppercase tracking-[0.16em]">
              Chat with your documents
            </p>

            {/* The floor is 2.65rem rather than a viewport-relative minimum,
              because 4.8vw on a 390px phone is 19px and a hero set at 19px is
              not a hero. */}
            <h1 className="mb-6 max-w-[19ch] font-light font-reading text-[clamp(2.65rem,4.8vw,3.9rem)] text-ink leading-[1.04] tracking-[-0.025em]">
              Every answer shows you <em className="text-mark italic">where</em> it came from.
            </h1>

            <p className="mb-9 max-w-[46ch] font-light font-reading text-[1.15rem] text-soft leading-[1.6]">
              Add a report, a spreadsheet, a paper or a folder of code. Ask a question in your own
              words. Every claim in the answer carries a small number, and clicking it takes you
              straight to the lines it was based on.
            </p>

            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center rounded-hair border border-mark px-5 font-record text-[0.74rem] text-mark uppercase tracking-[0.12em] transition-colors duration-150 ease-out-quart hover:bg-wash"
              >
                Start reading
              </Link>
              <Underlined href="#example">
                <span className="font-record text-[0.72rem] uppercase tracking-[0.12em]">
                  See what an answer looks like
                </span>
              </Underlined>
            </div>
          </main>

          <aside
            aria-label="Where answers come from"
            className="hidden flex-col justify-center border-rule border-t px-7 py-8 wide:flex wide:border-t-0 wide:border-l wide:bg-panel"
          >
            <h2 className="mb-5 flex items-baseline justify-between border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.14em]">
              <span>Why you can trust it</span>
              <span>3</span>
            </h2>

            <ol className="m-0 grid list-none gap-5 p-0">
              {backing.map((entry, index) => (
                <li key={entry.heading} className="grid grid-cols-[26px_minmax(0,1fr)] gap-3">
                  <span className="grid size-[22px] place-items-center rounded-hair border border-mark font-semibold font-record text-label text-mark tabular">
                    {index + 1}
                  </span>
                  <div>
                    <h3 className="mb-1.5 font-medium font-record text-label text-ink">
                      {entry.heading}
                    </h3>
                    <p className="m-0 font-light font-reading text-[0.92rem] text-soft italic leading-relaxed">
                      {entry.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>

        <div className="grid grid-cols-1 border-rule border-t sm:grid-cols-3">
          {strip.map((cell) => (
            <div
              key={cell.heading}
              className="border-rule border-b px-7 py-7 sm:border-b-0 sm:border-r sm:last:border-r-0 wide:px-8"
            >
              <h2 className="mb-2.5 font-medium font-record text-label text-faint uppercase tracking-[0.13em]">
                {cell.heading}
              </h2>
              <p className="max-w-[36ch] font-light font-reading text-[1rem] text-soft leading-relaxed">
                {cell.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Shown rather than described. A visitor who has never used the product
          learns more from one real answer with its source beside it than from
          any sentence about provenance. */}
      <section id="example" className="scroll-mt-8 border-rule border-t px-7 py-14 wide:px-9">
        <h2 className="mb-2 font-light font-reading text-[1.7rem] text-ink leading-tight">
          What an answer looks like.
        </h2>
        <p className="mb-9 max-w-[56ch] font-light font-reading text-[1.02rem] text-soft leading-relaxed">
          From a real run against the full text of Pride and Prejudice: 762 passages, one question,
          an answer in six seconds with the lines it came from beside it.
        </p>

        <div className="border border-rule">
          <WorkedExample />
        </div>

        <p className="mt-5 max-w-[52ch] font-record text-record text-faint leading-relaxed">
          Click a number and the document opens at those lines, marked. One click brings you back.
        </p>
      </section>

      <section className="border-rule border-t px-7 py-14 wide:px-9">
        <h2 className="mb-10 font-light font-reading text-[1.7rem] text-ink leading-tight">
          Three steps, and you can check every one of them.
        </h2>

        <ol className="m-0 grid list-none grid-cols-1 gap-0 p-0 wide:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.heading}
              className="grid grid-cols-[2.4rem_minmax(0,1fr)] gap-4 border-rule border-t py-6 wide:border-t-0 wide:border-l wide:first:border-l-0 wide:px-7 wide:first:pl-0"
            >
              <span className="pt-1 font-medium font-record text-label text-mark tabular">
                {String(index + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="mb-2 max-w-[22ch] font-light font-reading text-[1.15rem] text-ink leading-snug">
                  {step.heading}
                </h3>
                <p className="max-w-[34ch] font-record text-record text-soft leading-relaxed">
                  {step.body}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <SiteFooter />
    </div>
  </div>
);

export default Home;
