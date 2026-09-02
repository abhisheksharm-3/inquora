import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/ui/providers/QueryProvider";
import { SupabaseProvider } from "@/ui/providers/SupabaseProvider";
import { ThemeProvider } from "@/ui/providers/ThemeProvider";

/**
 * Two faces, and the pairing is the design rather than a delivery vehicle for
 * it: a humanist serif carries everything read, an engineered mono carries
 * everything recorded. `next/font` self-hosts both, so there is no request to
 * fonts.googleapis.com on first paint and no layout shift when they land.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "Inquora", template: "%s · Inquora" },
  description: "Ask a question of your documents and get an answer you can verify.",
};

/** Zoom is never disabled, so no `maximum-scale` and no `user-scalable`. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

const RootLayout = ({ children }: Readonly<{ children: React.ReactNode }>) => (
  // suppressHydrationWarning is required, and only here: next-themes stamps
  // data-theme on this element before React hydrates, so the server markup and
  // the first client render legitimately differ by that one attribute.
  <html
    lang="en"
    suppressHydrationWarning
    className={`${newsreader.variable} ${plexMono.variable}`}
  >
    <body>
      <ThemeProvider>
        <QueryProvider>
          <SupabaseProvider>{children}</SupabaseProvider>
        </QueryProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
