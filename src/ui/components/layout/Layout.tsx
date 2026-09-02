import React from "react";
import Navbar from "@/ui/components/landing-page/Navbar";
import Footer from "@/ui/components/landing-page/Footer";
import { LayoutProps } from "@/ui/lib/ui.types";

/**
 * Provides a standard page layout: a Navbar, the content area and a Footer.
 *
 * @param {LayoutProps} props - The component props.
 * @param {React.ReactNode} props.children - Main content to render.
 * @param {boolean} [props.enableNavbarBlur=true] - Toggles the navbar's blur effect.
 * @param {string} [props.contentClassName=""] - Custom classes for the main content area.
 * @param {boolean} [props.showFooter=true] - Toggles the footer.
 * @returns {JSX.Element} The rendered layout component.
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  enableNavbarBlur = true,
  contentClassName = "",
  showFooter = true,
}) => {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <header className="relative z-50">
        {enableNavbarBlur && (
          <div className="absolute inset-0 bg-background/20 backdrop-blur-md border-b border-border/20" />
        )}
        <div className="relative">
          <Navbar />
        </div>
      </header>

      <main className={`flex-1 relative z-10 ${contentClassName}`}>{children}</main>

      {showFooter && (
        <footer className="relative z-10">
          <Footer />
        </footer>
      )}
    </div>
  );
};

export default Layout;
