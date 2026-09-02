"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * The theme, in the three states DESIGN.md requires: an explicit choice stamps
 * `data-theme` on the root, and no choice resolves through
 * `prefers-color-scheme`.
 *
 * This used to gate the provider behind a `mounted` flag set in an effect, which
 * meant the provider first rendered on the client. next-themes reads the stored
 * choice from a `<script>` that has to run before first paint, and React does
 * not execute a script tag rendered on the client, so the script was inert and
 * logged an error. Rendering the provider on the server is the whole point of
 * it; `suppressHydrationWarning` on `<html>` is what makes that legal, and it is
 * set in the root layout.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
