import Link from "next/link";
import { AUTH_ROUTES } from "@/core/routes";
import type { Account } from "@/core/workspace/account.types";
import type { AccountUsage } from "@/core/workspace/workspace.types";
import { formatBytes } from "@/ui/components/documents/document.format";

/**
 * Who you are and what you have used, on the settings page.
 *
 * The panel here used to be four numbered notes — "Indexed · 1 document · 9
 * passages", "Tokens · 0 in · 0 out", and a paragraph about the embedding
 * having 1024 dimensions — under the heading "What this account has used 4
 * notes". The embedding dimension is not account data, it is a fact about the
 * implementation, and it lives on /how-it-works with the rest of them.
 *
 * What is here instead is what a settings page owes you: who you are signed in
 * as, how you sign in, when you joined, and what the account holds.
 */
export const AccountPanel = ({
  account,
  usage,
}: {
  account: Account | null;
  usage: AccountUsage | null;
}) => (
  <div className="grid gap-10">
    {account ? (
      <section>
        <h2 className="mb-1 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
          You
        </h2>

        <Row label="Name" value={account.displayName ?? "Not set"} />
        <Row label="Email" value={account.email} />
        <Row label="Sign in with" value={account.provider === "google" ? "Google" : "A password"} />
        <Row
          label="Joined"
          value={new Intl.DateTimeFormat("en", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date(account.createdAt))}
        />

        {/* Offered only to somebody who has a password. Google holds the
            password of a Google account, and sending them to a reset form
            would be sending them to something that cannot help. */}
        {account.provider === "google" ? null : (
          <p className="mt-4 font-record text-label">
            <Link
              href={AUTH_ROUTES.FORGOT}
              className="border-rule border-b pb-0.5 text-soft hover:text-ink"
            >
              Change your password
            </Link>
          </p>
        )}
      </section>
    ) : null}

    {usage ? (
      <section>
        <h2 className="mb-1 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
          What this account holds
        </h2>

        <Row label="Documents" value={usage.documents.toLocaleString()} />
        <Row label="Stored" value={formatBytes(usage.bytes) ?? "nothing yet"} />
        <Row label="Passages searchable" value={usage.chunks.toLocaleString()} />
        <Row label="Questions asked" value={usage.chats.toLocaleString()} />
        <Row label="Messages" value={usage.messages.toLocaleString()} />
        <Row
          label="Words written"
          value={usage.tokensOut > 0 ? approximate(usage.tokensOut) : "—"}
        />
        <Row label="Words read" value={usage.tokensIn > 0 ? approximate(usage.tokensIn) : "—"} />
      </section>
    ) : null}
  </div>
);

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-baseline justify-between gap-6 border-rule border-b py-2.5">
    <span className="shrink-0 font-record text-record text-faint">{label}</span>
    <span className="min-w-0 truncate font-record text-record text-ink tabular">{value}</span>
  </div>
);

/**
 * `12.4k` rather than `12,412`. A token count is an estimate of an estimate, so
 * printing every digit claims a precision it does not have.
 */
const approximate = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
  if (tokens >= 1_000) return `${Math.round(tokens / 100) / 10}k`;

  return tokens.toLocaleString();
};
