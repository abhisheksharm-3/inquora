import type { Metadata } from "next";
import Link from "next/link";
import { ApparatusColumn } from "@/ui/components/apparatus/Apparatus";
import type { Entry } from "@/ui/components/apparatus/apparatus.types";
import { Reading, Surface } from "@/ui/components/apparatus/Surface";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Inquora.",
};

/**
 * The apparatus on an authentication screen carries the one thing it owes you:
 * what happens to your documents. Two notes, stated rather than linked to a
 * policy page nobody opens.
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
  <Surface apparatus={<ApparatusColumn entries={notes} label="Apparatus" />}>
    <Reading className="justify-center">
      <Link
        href="/"
        className="mb-10 self-start font-record text-label text-faint uppercase tracking-[0.16em] hover:text-ink"
      >
        Inquora
      </Link>
      {children}
    </Reading>
  </Surface>
);

export default AuthLayout;
