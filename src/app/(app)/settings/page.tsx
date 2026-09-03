import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AUTH_ROUTES, DASHBOARD_ROUTES } from "@/core/routes";
import { Chrome } from "@/ui/components/apparatus/Chrome";
import { formatBytes } from "@/ui/components/documents/document.format";
import { DocumentTable } from "@/ui/components/settings/DocumentTable";
import { Fact, Figure } from "@/ui/components/settings/Field";
import { Ago } from "@/ui/components/shared/Ago";
import { listDocuments, readAccount, readUsage } from "../queries";

export const metadata: Metadata = {
  title: "Settings",
  description: "Your account, your documents, and what this account holds.",
};

/**
 * Your account.
 *
 * Rebuilt around what a settings page is actually for. The version before it
 * was headed "Your documents." with the account squeezed into a 330px strip
 * beside it, which put the thing a person opens Settings to check — who am I
 * signed in as, what have I used, how do I change my password — in the margin.
 *
 * So the account is first and full width, the usage is four figures across the
 * page, and the documents are a table under both, with the two actions a
 * document has in its own column. Nothing is in a strip.
 *
 * The largest file in the interface this replaced was this page's loading
 * skeleton: 421 lines, bigger than the chat surface. There is no skeleton. The
 * shell paints and each section streams in when its query answers.
 */
const SettingsPage = async () => {
  const account = await readAccount();

  return (
    <div className="grid min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)]">
      <Chrome current="settings" account={account} />

      <main className="px-7 py-12 wide:px-12 wide:py-14">
        <div className="w-full">
          <h1 className="mb-10 font-light font-reading text-[2.1rem] text-ink leading-tight tracking-[-0.02em]">
            Your account.
          </h1>

          <div className="grid grid-cols-1 gap-x-14 gap-y-12 wide:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <section>
              <h2 className="mb-1 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
                Who you are
              </h2>

              {account ? (
                <dl className="m-0">
                  <Fact label="Name" value={account.displayName ?? "Not set"} />
                  <Fact label="Email" value={account.email} />
                  <Fact
                    label="Sign in with"
                    value={account.provider === "google" ? "Google" : "A password"}
                  />
                  <div className="flex items-baseline justify-between gap-6 border-rule border-b py-3">
                    <dt className="shrink-0 font-record text-record text-faint">Joined</dt>
                    <dd className="m-0 font-light font-reading text-[1.05rem] text-ink">
                      <Ago iso={account.createdAt} />
                    </dd>
                  </div>
                </dl>
              ) : null}

              {/* Offered only to somebody who has a password. Google holds the
                  password of a Google account, and sending them to a reset form
                  would be sending them somewhere that cannot help. */}
              {account && account.provider !== "google" ? (
                <p className="mt-5 font-record text-label">
                  <Link
                    href={AUTH_ROUTES.FORGOT}
                    className="border-rule border-b pb-0.5 text-soft hover:text-ink"
                  >
                    Change your password
                  </Link>
                </p>
              ) : null}
            </section>

            <section>
              <h2 className="mb-5 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
                What you have used
              </h2>

              <Suspense fallback={null}>
                <Usage />
              </Suspense>
            </section>
          </div>

          <section className="mt-14">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
              <h2 className="font-record text-label text-faint uppercase tracking-[0.13em]">
                Your documents
              </h2>
              <p className="m-0 max-w-[56ch] font-record text-label text-faint">
                Deleting one removes its passages, its rows and the citations pointing at it, and it
                cannot be undone.{" "}
                <Link href={DASHBOARD_ROUTES.HOME} className="text-mark hover:bg-wash">
                  Add another
                </Link>
              </p>
            </div>

            <Suspense
              fallback={
                <p className="font-record text-label text-faint uppercase tracking-[0.14em]">
                  Reading
                </p>
              }
            >
              <Documents />
            </Suspense>
          </section>
        </div>
      </main>
    </div>
  );
};

const Documents = async () => <DocumentTable documents={await listDocuments()} />;

const Usage = async () => {
  const usage = await readUsage();

  if (!usage) return null;

  return (
    <dl className="m-0 grid grid-cols-2 gap-x-8 gap-y-8">
      <Figure
        label="Documents"
        value={usage.documents.toLocaleString()}
        note={formatBytes(usage.bytes) ?? "nothing stored"}
      />
      <Figure
        label="Passages searchable"
        value={usage.chunks.toLocaleString()}
        note="each one embedded once"
      />
      <Figure
        label="Questions asked"
        value={usage.chats.toLocaleString()}
        note={`${usage.messages.toLocaleString()} messages in all`}
      />
      <Figure
        label="Words the model wrote"
        value={usage.tokensOut > 0 ? approximate(usage.tokensOut) : "none yet"}
        note={usage.tokensIn > 0 ? `${approximate(usage.tokensIn)} read to answer` : undefined}
      />
    </dl>
  );
};

/**
 * `12.4k` rather than `12,412`. A token count is an estimate of an estimate, so
 * printing every digit claims a precision it does not have.
 */
const approximate = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
  if (tokens >= 1_000) return `${Math.round(tokens / 100) / 10}k`;

  return tokens.toLocaleString();
};

export default SettingsPage;
