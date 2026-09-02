import type { Metadata } from "next";
import Link from "next/link";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";

export const metadata: Metadata = {
  title: "Inquora — every answer, traced to the passage it came from",
  description:
    "Ask a question of your documents and reach the passage behind any claim in one action.",
};

/**
 * Surface 01, the brand register.
 *
 * No centred hero and no split hero with an animation on one side, both of
 * which are hard bans. The landing page is built like the product: a claim on
 * the left, an apparatus on the right backing each claim with a numbered
 * specimen. The page argues the way the product argues.
 *
 * The brand register differs from the product register by committing to the
 * dark ground, not by introducing a saturated colour, so `data-theme` is set on
 * this surface rather than a second palette being invented for it.
 *
 * A server component with no client JavaScript at all. The page this replaced
 * mounted a 390-line WebGL shader canvas.
 */
const specimens: Entry[] = [
  {
    kind: "specimen",
    number: 1,
    source: ["Retrieval"],
    passage:
      "Vector similarity and full-text search run as one query and are fused by rank, so exact terms and meaning both count.",
  },
  {
    kind: "specimen",
    number: 2,
    source: ["Provenance"],
    passage:
      "Every answer stores the passages it used. Reopen a conversation a month later and the sources are still attached.",
  },
  {
    kind: "specimen",
    number: 3,
    source: ["Spreadsheets"],
    passage:
      "Tables are queried as tables. Numbers are read from cells, not guessed from a paragraph describing them.",
  },
];

const strip = [
  {
    heading: "Documents",
    body: "PDFs, documents, spreadsheets, slides, repositories, recorded video.",
  },
  {
    heading: "Together",
    body: "Several documents in one conversation, each one switchable in and out of scope.",
  },
  {
    heading: "Honest",
    body: "When the answer is not in your documents, it says so instead of inventing one.",
  },
];

const Home = () => (
  <div
    data-theme="dark"
    className="grid min-h-dvh grid-cols-1 content-start bg-ground wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]"
  >
    <header className="col-span-full flex items-center justify-between gap-6 border-rule border-b px-6 py-4 wide:px-8">
      <span className="font-reading text-[1rem] text-ink tracking-[0.02em]">Inquora</span>
      <nav className="flex items-center gap-5 font-record text-label text-faint uppercase tracking-[0.14em]">
        <Link href="/login" className="min-h-11 border-transparent border-b pb-0.5 hover:text-ink">
          Sign in
        </Link>
        <Link href="/signup" className="min-h-11 border-mark border-b pb-0.5 text-ink">
          Start reading
        </Link>
      </nav>
    </header>

    <main className="px-6 pt-12 pb-11 wide:px-9 wide:pt-14">
      <h1 className="mb-6 max-w-[15ch] font-light font-reading text-[clamp(2.1rem,4.6vw,3.5rem)] leading-[1.08] tracking-[-0.02em]">
        Every answer, traced to the <em className="text-mark italic">passage</em> it came from.
      </h1>

      <p className="mb-7 max-w-[46ch] font-record text-[0.86rem] text-soft leading-relaxed">
        Ask a question of your documents and watch the work happen. Inquora shows what it searched,
        what it read, and the exact lines behind every claim, in the same view as the answer.
      </p>

      <p className="flex flex-wrap items-center gap-4 font-record text-label uppercase tracking-[0.13em]">
        <Link
          href="/signup"
          className="inline-flex min-h-11 items-center border-mark border-b pb-1 text-ink"
        >
          Start reading
        </Link>
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center border-rule border-b pb-1 text-faint hover:text-ink"
        >
          I have an account
        </Link>
      </p>
    </main>

    <aside className="border-rule border-t px-6 py-7 wide:border-t-0 wide:border-l wide:bg-panel">
      <ApparatusColumn entries={specimens} label="Apparatus" />
    </aside>

    <section className="col-span-full grid grid-cols-1 border-rule border-t sm:grid-cols-3">
      {strip.map((cell) => (
        <div
          key={cell.heading}
          className="border-rule border-b px-6 py-6 sm:border-b-0 sm:border-r sm:last:border-r-0 wide:px-7"
        >
          <h2 className="mb-2 font-medium font-record text-label text-faint uppercase tracking-[0.13em]">
            {cell.heading}
          </h2>
          <p className="max-w-[34ch] font-record text-[0.78rem] text-soft leading-relaxed">
            {cell.body}
          </p>
        </div>
      ))}
    </section>
  </div>
);

export default Home;
