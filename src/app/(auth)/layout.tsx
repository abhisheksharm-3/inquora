import type { Metadata } from "next";
import { SiteFooter } from "@/ui/components/marketing/SiteFooter";
import { SiteHeader } from "@/ui/components/marketing/SiteHeader";
import { WorkedExample } from "@/ui/components/marketing/WorkedExample";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Inquora.",
};

/**
 * The example on the left, the form on the right.
 *
 * This inverts the layout law on purpose, and it is the one surface where that
 * is right: everywhere else the reading column is what you came for and the
 * apparatus supports it, but here what you came for is a way in, and the
 * example is the thing being explained. Reading order puts the explanation
 * first and the action last.
 *
 * The example is also set smaller than it is on the landing page. At the
 * landing page's sizes, in a column twice as wide, it read as the page and the
 * form read as a footnote to it.
 *
 * The previous version was two lines of privacy note in a 330px strip beside a
 * 42ch form, which left most of a wide display empty. Those notes were the
 * right content for the column and there was never going to be enough of them
 * to fill one, so they now sit under the example where a person deciding will
 * look for them.
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

    <div className="grid min-h-[calc(100svh-4rem)] grid-cols-1 wide:grid-cols-[70fr_30fr]">
      <aside className="order-2 border-rule border-t px-7 py-10 wide:order-1 wide:border-t-0 wide:border-r wide:bg-panel wide:px-10 wide:py-12">
        {/* The example is hidden on a phone. It is a wide artefact — a question,
            an answer and two quoted passages — and on a 390px screen it pushed
            the promises about your files two screens below the form. The
            promises stay, because those are what somebody signing in on a phone
            actually needs from this column. */}
        <div className="hidden wide:block">
          <p className="mb-8 font-record text-label text-faint uppercase tracking-[0.14em]">
            What you are signing in to
          </p>

          <WorkedExample stacked />
        </div>

        <dl className="grid grid-cols-1 gap-6 sm:grid-cols-2 wide:mt-9 wide:border-rule wide:border-t wide:pt-7">
          {promises.map((promise) => (
            <div key={promise.heading}>
              <dt className="mb-1.5 font-medium font-record text-label text-ink">
                {promise.heading}
              </dt>
              <dd className="m-0 max-w-[34ch] font-light font-reading text-[0.92rem] text-soft leading-relaxed">
                {promise.body}
              </dd>
            </div>
          ))}
        </dl>
      </aside>

      <main className="order-1 flex min-w-0 flex-col justify-center px-7 py-14 wide:order-2 wide:px-10">
        {children}
      </main>
    </div>

    <SiteFooter />
  </div>
);

export default AuthLayout;
