"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

/**
 * One button that cycles the three theme states, showing the one in force.
 *
 * Three earlier versions put all three states on the bar at once — as words,
 * then as a bordered segmented control, then as three loose marks. Each added
 * a third control language to a bar that only needs two, and on a phone it took
 * space the primary action needed. One button is one object, and the state it
 * shows is the state you are in.
 *
 * The label says what it is and what clicking does, because an icon alone
 * cannot: a moon could mean "you are in dark" or "switch to dark".
 */
const CYCLE = [
  { value: "light", name: "Light", mark: <Sun /> },
  { value: "dark", name: "Dark", mark: <Moon /> },
  { value: "system", name: "System", mark: <Half /> },
] as const;

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, setTheme } = useTheme();

  /*
   * The stored choice exists only in the browser, so the server cannot render
   * it. Rendering it anyway is a hydration mismatch — React reported the label
   * and the icon both differing on every page load for somebody whose theme is
   * not the default — and the tree gets thrown away and rebuilt. So the first
   * client render matches the server, and the real state arrives after it.
   */
  const [ready, setReady] = useState(false);

  useEffect(() => setReady(true), []);

  const at = Math.max(
    0,
    CYCLE.findIndex((choice) => choice.value === (ready ? (theme ?? "system") : "system")),
  );
  const current = CYCLE[at];
  const next = CYCLE[(at + 1) % CYCLE.length];

  return (
    <button
      type="button"
      onClick={() => setTheme(next.value)}
      title={`Theme: ${current.name}. Switch to ${next.name}.`}
      aria-label={`Theme: ${current.name}. Switch to ${next.name}.`}
      className={`flex size-9 items-center justify-center rounded-hair border border-rule text-soft transition-colors duration-150 ease-out-quart hover:border-soft hover:text-ink ${className ?? ""}`}
    >
      {current.mark}
    </button>
  );
};

const shape = {
  width: 14,
  height: 14,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.3,
  strokeLinecap: "round" as const,
};

function Sun() {
  return (
    <svg {...shape} aria-hidden>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.1 3.1l1.1 1.1M11.8 11.8l1.1 1.1M12.9 3.1l-1.1 1.1M4.2 11.8l-1.1 1.1" />
    </svg>
  );
}

function Half() {
  return (
    <svg {...shape} aria-hidden>
      <circle cx="8" cy="8" r="6" />
      <path d="M8 2a6 6 0 0 0 0 12z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Moon() {
  return (
    <svg {...shape} aria-hidden>
      <path d="M13.2 9.8A5.6 5.6 0 0 1 6.2 2.8a5.6 5.6 0 1 0 7 7z" />
    </svg>
  );
}
