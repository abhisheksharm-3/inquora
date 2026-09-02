import Link from "next/link";
import { cn } from "@/ui/lib/cn";

/**
 * A link whose rule sits under its text.
 *
 * This exists because of a bug worth naming: a 44px touch target and a bottom
 * border on the same element draws the rule at the bottom of the target, 44px
 * below the words. Every underlined link in the first build had a rule floating
 * well beneath it. The target is the outer box; the rule belongs to the inner
 * span.
 */
export const Underlined = ({
  href,
  children,
  tone = "quiet",
  className,
  ...rest
}: {
  href: string;
  children: React.ReactNode;
  /** `loud` gets the mark, which is the one accent this design spends. */
  tone?: "loud" | "quiet";
  className?: string;
} & Omit<React.ComponentProps<typeof Link>, "href" | "children" | "className">) => (
  <Link
    href={href}
    className={cn("inline-flex min-h-11 items-center text-inherit", className)}
    {...rest}
  >
    <span
      className={cn(
        "border-b pb-1",
        tone === "loud" ? "border-mark text-ink" : "border-rule text-faint hover:text-ink",
      )}
    >
      {children}
    </span>
  </Link>
);
