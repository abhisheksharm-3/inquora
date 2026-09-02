import type { Metadata } from "next";
import { SiteFooter } from "@/ui/components/marketing/SiteFooter";
import { SiteHeader } from "@/ui/components/marketing/SiteHeader";
import { WorkedExample } from "@/ui/components/marketing/WorkedExample";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Inquora.",
};

/**
 * Substance on the left, apparatus on the right, as on every surface. On this
 * one the substance is the form, and the apparatus is the product: one real
 * answer with the passages behind it.
 *
 * The previous version put two lines of privacy note in a 330px strip beside a
 * 42ch form, which left most of a 1500px screen empty. The notes were the right
 * content for the column and there was not enough of them to be a column. What
 * somebody about to hand over a document wants to see is what they get, so that
 * is what the column carries now, with the promises about their files under it
 * where they matter rather than above it where they were decoration.
 */
const promises = [
  {
    heading: "Your documents stay yours",
    body: "Indexed to your account, readable by nobody else, and deleted with it.",
  },
  {
    heading: "Nothing trains on your files",
    body: "Content is read to answer your question and is not retained for anything else.",
  },
];

const AuthLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-dvh bg-ground">
    <SiteHeader variant="auth" />

    <div className="grid min-h-[calc(100svh-4rem)] grid-cols-1 wide:grid-cols-[minmax(0,46ch)_minmax(0,1fr)]">
      <main className="flex min-w-0 flex-col justify-center px-7 py-14 wide:px-10">{children}</main>

      <aside className="border-rule border-t px-7 py-10 wide:border-t-0 wide:border-l wide:bg-panel wide:px-10">
        <p className="mb-8 font-record text-label text-faint uppercase tracking-[0.14em]">
          What you are signing in to
        </p>

        <WorkedExample stacked />

        <dl className="mt-10 grid grid-cols-1 gap-6 border-rule border-t pt-7 sm:grid-cols-2">
          {promises.map((promise) => (
            <div key={promise.heading}>
              <dt className="mb-1.5 font-medium font-record text-label text-ink">
                {promise.heading}
              </dt>
              <dd className="m-0 max-w-[34ch] font-light font-reading text-[0.95rem] text-soft leading-relaxed">
                {promise.body}
              </dd>
            </div>
          ))}
        </dl>
      </aside>
    </div>

    <SiteFooter />
  </div>
);

export default AuthLayout;
