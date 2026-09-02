import type { Metadata } from "next";
import { JetBrains_Mono, Literata } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/ui/providers/QueryProvider";
import { SupabaseProvider } from "@/ui/providers/SupabaseProvider";
import { ThemeProvider } from "@/ui/providers/ThemeProvider";

const literata = Literata({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

/**
 * SEO metadata for the application.
 */
export const metadata: Metadata = {
  title: "Inquora",
  description: "Inquora – Chat with documents, videos, and more using AI.",
};

/**
 * The root layout for the application.
 */
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="en">
    <body className={`${literata.variable} ${jetbrainsMono.variable} font-serif antialiased`}>
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SupabaseProvider>{children}</SupabaseProvider>
        </ThemeProvider>
      </QueryProvider>
    </body>
  </html>
);

export default RootLayout;
