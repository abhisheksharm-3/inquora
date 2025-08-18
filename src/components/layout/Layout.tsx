import React from "react";
import Navbar from "@/components/landing-page/Navbar";
import Footer from "@/components/landing-page/Footer";
import Dither from "@/components/backgrounds/Dither/Dither";
import { LayoutProps } from "@/types/TypeUi";

const defaultDitherConfig = {
  waveColor: [0.1, 0.1, 0.2] as [number, number, number],
  fullscreen: false,
};

/**
 * Provides a standard page layout including a Navbar, Footer, and a dynamic
 * dither background. The background can be configured to be full-screen or
 * limited to the header area.
 *
 * @param {LayoutProps} props - The component props.
 * @param {React.ReactNode} props.children - Main content to render.
 * @param {boolean} [props.showDitherBackground=true] - Toggles the dither background.
 * @param {boolean} [props.enableNavbarBlur=true] - Toggles the navbar's blur effect.
 * @param {string} [props.contentClassName=""] - Custom classes for the main content area.
 * @param {boolean} [props.showFooter=true] - Toggles the footer.
 * @param {object} [props.ditherConfig={}] - Overrides for the default dither background.
 * @returns {JSX.Element} The rendered layout component.
 */
const Layout: React.FC<LayoutProps> = ({
  children,
  showDitherBackground = true,
  enableNavbarBlur = true,
  contentClassName = "",
  showFooter = true,
  ditherConfig = {},
}) => {
  const finalDitherConfig = { ...defaultDitherConfig, ...ditherConfig };

  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      {showDitherBackground && (
        <div
          className={`absolute inset-0 z-0 ${
            finalDitherConfig.fullscreen ? "h-full" : "h-32"
          }`}
        >
          <Dither {...finalDitherConfig} />
        </div>
      )}

      <header className="relative z-50">
        {enableNavbarBlur && (
          <div className="absolute inset-0 bg-background/20 backdrop-blur-md border-b border-border/20" />
        )}
        <div className="relative">
          <Navbar />
        </div>
      </header>

      <main className={`flex-1 relative z-10 ${contentClassName}`}>
        {children}
      </main>

      {showFooter && (
        <footer className="relative z-10">
          <Footer />
        </footer>
      )}
    </div>
  );
};

export default Layout;