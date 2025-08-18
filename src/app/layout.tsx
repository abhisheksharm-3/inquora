import type { Metadata } from "next";
import { Literata, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import QueryProvider from "@/providers/QueryProvider";

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
 * @description SEO metadata for the application.
 */
export const metadata: Metadata = {
  title: "Inquora",
  description: "Inquora – Chat with documents, videos, and more using AI.",
};

/**
 * The root layout for the application.
 *
 * This component sets up the main HTML structure, applies global fonts,
 * and wraps children with necessary context providers like `QueryProvider`.
 *
 * @param {{ children: React.ReactNode }} props - The component props.
 * @returns {React.ReactElement} The root layout element.
 */
const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html lang="en" className="dar">
    <body
      className={`${literata.variable} ${jetbrainsMono.variable} font-serif antialiased`}
    >
      <QueryProvider>{children}</QueryProvider>
    </body>
  </html>
);

export default RootLayout;