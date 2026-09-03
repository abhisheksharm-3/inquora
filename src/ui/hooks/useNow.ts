"use client";

import { useEffect, useState } from "react";

/**
 * The current time, but only once the browser has it.
 *
 * `Date.now()` during render is an unstable value, and `cacheComponents`
 * refuses to prerender one: reading the clock while building a shell that is
 * meant to be reusable is a contradiction, and Next says so rather than
 * shipping a timestamp frozen at build time.
 *
 * So this returns null on the server and on the first client render, and the
 * real time after mount. A caller shows something time-independent for that one
 * frame — an absolute date, or no verdict about whether a job has stalled — and
 * the relative form arrives immediately after.
 *
 * It ticks, so "2 minutes ago" becomes "3 minutes ago" on a page somebody has
 * left open, and a document that stops moving is noticed without a reload.
 */
export const useNow = (everyMs = 30_000): number | null => {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());

    const timer = setInterval(() => setNow(Date.now()), everyMs);

    return () => clearInterval(timer);
  }, [everyMs]);

  return now;
};
