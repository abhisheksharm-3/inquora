import { cn } from "@/ui/lib/cn";

/**
 * The layout law, on every surface: substance on the left, apparatus on the
 * right. Whatever the surface is about occupies the reading column; everything
 * that supports, explains or records it occupies the right column.
 *
 * Below 1150px the apparatus becomes footnotes, which is what an apparatus has
 * always done on a narrow page: it moves below the substance in document order,
 * loses its panel and its left border, and keeps a rule above it.
 *
 * A server component. It holds no state, so nothing here ships to the browser.
 */
export const Surface = ({
  children,
  apparatus,
  chrome,
  className,
}: {
  children: React.ReactNode;
  apparatus: React.ReactNode;
  /** Optional top bar, spanning both columns. */
  chrome?: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid min-h-dvh grid-cols-1 content-start wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]",
      className,
    )}
  >
    {chrome}
    {children}
    <aside className="border-rule border-t px-6 py-7 wide:border-t-0 wide:border-l wide:bg-panel">
      {apparatus}
    </aside>
  </div>
);

/**
 * The reading column. Its measure is capped inside it rather than here, because
 * a document viewer and a form want different widths on the same rule.
 */
export const Reading = ({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) => (
  <main className={cn("flex min-w-0 flex-col px-6 py-7 wide:px-9 wide:py-8", className)}>
    {children}
  </main>
);
