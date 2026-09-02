"use client";

import { useFormStatus } from "react-dom";
import { cn } from "@/ui/lib/cn";

/**
 * The submit control: an outline in the mark, uppercase mono, no fill. It reads
 * its own pending state from `useFormStatus`, so no form has to drill a
 * `isSubmitting` prop down to it.
 *
 * `pendingLabel` is what a person reads while waiting, so it says what is
 * happening rather than spinning.
 */
export const Action = ({
  children,
  pendingLabel,
  className,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) => {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      // aria-live so a screen reader hears the label change rather than only
      // seeing it.
      aria-live="polite"
      className={cn(
        "mt-5 inline-flex min-h-11 items-center gap-2.5 rounded-hair border border-mark px-4 py-2 font-record text-label text-mark uppercase tracking-[0.13em]",
        "transition-colors duration-150 ease-out-quart hover:bg-wash",
        "disabled:cursor-progress disabled:text-faint disabled:border-rule",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
};
