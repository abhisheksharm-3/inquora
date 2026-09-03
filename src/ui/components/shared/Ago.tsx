"use client";

import { formatWhen } from "@/ui/components/documents/document.format";
import { useNow } from "@/ui/hooks/useNow";

/**
 * When something happened, relative to now.
 *
 * A client component because it reads the clock, and reading the clock during a
 * server render is an unstable value that `cacheComponents` will not prerender.
 * Before it mounts it shows the date, which is true and needs no clock; after,
 * it shows "yesterday".
 *
 * `<time>` carries the machine-readable value either way, so what a screen
 * reader or a crawler gets does not depend on which frame it caught.
 */
export const Ago = ({ iso, className }: { iso: string; className?: string }) => {
  const now = useNow();

  return (
    <time dateTime={iso} className={className}>
      {now === null
        ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(Date.parse(iso))
        : formatWhen(iso, now)}
    </time>
  );
};
