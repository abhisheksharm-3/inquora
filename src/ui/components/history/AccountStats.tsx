import type { AccountUsage } from "@/core/workspace/workspace.types";

/**
 * What this account has actually done, in the right-hand column.
 *
 * The panel here used to hold one line — "3 conversations · 0 messages across 1
 * document" under the heading "This account · 1 note" — which is a count of
 * join tables written for whoever built them, and it left the column nine
 * tenths empty.
 *
 * These are the same numbers a person would want if they were asked "what have
 * I got in here", named in words rather than in schema. Tokens stay, because on
 * an account panel that is a real cost somebody is entitled to see, and there
 * is nowhere else it is visible.
 */
export const AccountStats = ({ usage }: { usage: AccountUsage }) => {
  const rows = [
    { label: "Questions asked", value: usage.chats.toLocaleString() },
    { label: "Documents added", value: usage.documents.toLocaleString() },
    { label: "Passages searchable", value: usage.chunks.toLocaleString() },
    { label: "Words written", value: usage.tokensOut > 0 ? approximate(usage.tokensOut) : "—" },
    { label: "Words read", value: usage.tokensIn > 0 ? approximate(usage.tokensIn) : "—" },
  ];

  return (
    <div>
      <h2 className="mb-1 border-rule border-b pb-2 font-record text-label text-faint uppercase tracking-[0.13em]">
        This account
      </h2>

      <dl className="m-0 grid">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-baseline justify-between gap-6 border-rule border-b py-2.5"
          >
            <dt className="font-record text-record text-soft">{row.label}</dt>
            <dd className="m-0 font-record text-record text-ink tabular">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

/**
 * `12,400` rather than `12,412`, and `1.2m` past a million.
 *
 * A token count is an estimate of an estimate, so printing every digit claims a
 * precision it does not have.
 */
const approximate = (tokens: number): string => {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}m`;
  if (tokens >= 1_000) return `${Math.round(tokens / 100) / 10}k`;

  return tokens.toLocaleString();
};
