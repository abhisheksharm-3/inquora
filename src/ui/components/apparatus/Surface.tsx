import { cn } from "@/ui/lib/cn";

/**
 * The layout law, on every surface: substance on the left, apparatus on the
 * right. Whatever the surface is about occupies the reading column; everything
 * that supports, explains or records it occupies the right column.
 *
 * Below 1150px the apparatus becomes footnotes, which is what an apparatus has
 * always done on a narrow page: it moves below the substance, loses its panel
 * and its border, and keeps only a rule above it.
 *
 * A server component. It holds no state, so nothing here needs to ship.
 */
export const Surface = ({
  children,
  apparatus,
  className,
}: {
  children: React.ReactNode;
  apparatus: React.ReactNode;
  className?: string;
}) => (
  <div
    className={cn(
      "grid min-h-dvh grid-cols-1 wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]",
      className,
    )}
  >
    {children}
    <aside
      // `order` rather than a second render: one apparatus in the tree, placed
      // by the grid at wide widths and by document order below the fold.
      className="border-rule border-t px-6 py-7 wide:border-t-0 wide:border-l wide:bg-panel wide:px-6 wide:py-7"
    >
      {apparatus}
    </aside>
  </div>
);

/**
 * The reading column. Its measure is capped because a 90-character line is
 * unreadable however good the type is.
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
