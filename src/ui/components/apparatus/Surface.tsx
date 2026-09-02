import { cn } from "@/ui/lib/cn";

/**
 * The layout law, on every surface: substance on the left, apparatus on the
 * right. Whatever the surface is about occupies the reading column; everything
 * that supports, explains or records it occupies the right column.
 *
 * Three things this gets right that the first version did not, all of them
 * visible the moment it was opened on a wide display:
 *
 * - **The grid fills the viewport.** Rows are `auto 1fr`, not `content-start`,
 *   so the apparatus panel runs the full height. Before, it stopped where its
 *   content ended and left a floating panel edge over dead space.
 * - **The page has a width.** Content is capped and centred, because a reading
 *   column that grows to 1900px is not a reading column.
 * - **Prose is capped at its measure.** DESIGN.md calls 65 to 75 characters
 *   non-negotiable on the reading surface, and it applies to every line of
 *   text, not only to an answer.
 *
 * A server component. It holds no state, so nothing here ships to the browser
 * except where a client surface places it.
 */
export const Surface = ({
  children,
  apparatus,
  chrome,
  apparatusLabel,
  className,
  /**
   * Locks the surface to the viewport height and lets the columns scroll
   * inside it. The conversation wants this, because its composer sits at the
   * bottom of the column and must not be pushed off a growing page. A list
   * does not, because a list should scroll the page.
   */
  fill = false,
}: {
  children: React.ReactNode;
  apparatus: React.ReactNode;
  chrome?: React.ReactNode;
  apparatusLabel?: string;
  fill?: boolean;
  /** Lets a caller that stacks a header and a footer above and below set the height. */
  className?: string;
}) => (
  <div className="bg-ground">
    <div
      className={cn(
        "grid grid-cols-1 border-rule wide:grid-cols-[minmax(0,1fr)_var(--apparatus)]",
        chrome ? "grid-rows-[auto_minmax(0,1fr)]" : "grid-rows-[minmax(0,1fr)]",
        fill ? "h-dvh wide:overflow-hidden" : "min-h-dvh",
        className,
      )}
    >
      {chrome}
      {children}
      <aside
        aria-label={apparatusLabel ?? "Apparatus"}
        className={cn(
          "h-full border-rule border-t px-7 py-8 wide:border-t-0 wide:border-l wide:bg-panel",
          fill && "wide:overflow-y-auto",
        )}
      >
        {apparatus}
      </aside>
    </div>
  </div>
);

/**
 * The reading column. Generous padding, and the content inside it capped at a
 * measure rather than stretched to the column: the column is where the text
 * lives, not how wide the text is.
 */
export const Reading = ({
  children,
  className,
  scroll = false,
}: {
  children: React.ReactNode;
  className?: string;
  scroll?: boolean;
}) => (
  <main
    className={cn(
      "flex min-w-0 flex-col px-7 py-9 wide:px-11 wide:py-10",
      scroll && "wide:overflow-y-auto",
      className,
    )}
  >
    <div className="flex w-full max-w-[70ch] flex-1 flex-col">{children}</div>
  </main>
);

/**
 * A surface's heading and its one line of explanation, at the sizes the
 * mockups set them: the title in the serif at 1.55rem, the line under it in the
 * mono at 0.84rem. Repeated on four surfaces, so it is a component rather than
 * four copies of two class strings that drift.
 */
export const SurfaceHeading = ({
  children,
  lede,
}: {
  children: React.ReactNode;
  lede?: React.ReactNode;
}) => (
  <header className="mb-8">
    <h1 className="font-light font-reading text-[1.65rem] text-ink leading-tight tracking-[-0.015em]">
      {children}
    </h1>
    {lede ? (
      <p className="mt-2 max-w-[58ch] font-record text-[0.84rem] text-soft leading-relaxed">
        {lede}
      </p>
    ) : null}
  </header>
);
