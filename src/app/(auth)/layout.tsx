import type { Metadata } from "next";
import Link from "next/link";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";
import { Surface } from "@/ui/components/apparatus/Surface";
import { ThemeToggle } from "@/ui/components/shared/ThemeToggle";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Inquora.",
};

/**
 * The right-hand column on an authentication screen carries the one thing it
 * owes you: what happens to your documents. Stated here rather than linked to a
 * policy page nobody opens.
 *
 * It used to be headed "Apparatus · 2 notes". Apparatus is what this design
 * system calls its right-hand column; it is not a word a person signing in
 * should have to read.
 */
const notes: Entry[] = [
  {
    kind: "operation",
    tick: "01",
    title: "Your documents stay yours.",
    detail: "Indexed to your account, readable by nobody else, deleted with it.",
  },
  {
    kind: "operation",
    tick: "02",
    title: "Nothing trains on your files.",
    detail: "Content is read to answer your question and is not retained for anything else.",
  },
];

const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <Surface
    apparatusLabel="What happens to your documents"
    apparatus={<ApparatusColumn entries={notes} label="What happens to your documents" />}
  >
    {/* A form is narrow, so the column it sits in is narrow too. Left at
        `1fr` the reading column was 900px wide holding a 34ch form, which is
        how a sign-in screen ends up looking like an empty page with a field
        in the corner. */}
    <main className="flex min-w-0 flex-col px-7 py-9 wide:px-12 wide:py-10">
      <div className="mb-12 flex items-center justify-between gap-4">
        <Link
          href="/"
          className="font-reading text-[1.15rem] text-ink tracking-[0.01em] hover:text-mark"
        >
          Inquora
        </Link>
        <ThemeToggle />
      </div>

      <div className="flex max-w-[42ch] flex-1 flex-col justify-center pb-16">{children}</div>
    </main>
  </Surface>
);

export default AuthLayout;
