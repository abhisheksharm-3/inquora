import type { Metadata } from "next";
import { Literata, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { SupabaseProvider } from "@/providers/SupabaseProvider";

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
    <body
      className={`${literata.variable} ${jetbrainsMono.variable} font-serif antialiased`}
    >
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SupabaseProvider>
            {children}
          </SupabaseProvider>
        </ThemeProvider>
      </QueryProvider>
    </body>
  </html>
);

export default RootLayout;
