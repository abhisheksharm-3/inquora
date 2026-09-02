"use client";
import Link from "next/link";
import ButtonCta from "./ButtonCta";
import { Menu, X, Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/ui/components/ui/button";
import { useState, useEffect } from "react";
import { CtaButtons, PublicNavbarRoutes } from "@/ui/lib/nav-items";
import { cn } from "@/ui/lib/cn";
import { ModeToggle } from "@/ui/components/shared/mode-toggle";
import { useTheme } from "next-themes";

/**
 * Renders the main responsive navigation bar.
 *
 * Features a "glassmorphism" effect that appears on scroll, a standard
 * desktop layout, and a full-screen overlay menu for mobile devices.
 * @returns {JSX.Element} The rendered navigation bar component.
 */
const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const toggleMenu = () => setIsOpen(!isOpen);
  const closeMenu = () => setIsOpen(false);

  /**
   * Mobile theme selector that matches the style of other menu items
   */
  const MobileThemeSelector = () => {
    const { setTheme, theme } = useTheme();

    return (
      <div className="space-y-4 pt-4 border-t border-border/20">
        <p className="text-center text-sm font-medium text-muted-foreground">Theme</p>
        <div className="flex justify-center gap-4">
          <Button
            variant={theme === "light" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("light")}
            className="flex items-center gap-2"
          >
            <Sun className="h-4 w-4" />
            Light
          </Button>
          <Button
            variant={theme === "dark" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("dark")}
            className="flex items-center gap-2"
          >
            <Moon className="h-4 w-4" />
            Dark
          </Button>
          <Button
            variant={theme === "system" ? "default" : "outline"}
            size="sm"
            onClick={() => setTheme("system")}
            className="flex items-center gap-2"
          >
            <Laptop className="h-4 w-4" />
            System
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /**
   * Renders the list of public navigation links.
   * @param {{ isMobile?: boolean, onItemClick?: () => void }} props - Component props.
   */
  const NavigationList = ({
    isMobile = false,
    onItemClick,
  }: {
    isMobile?: boolean;
    onItemClick?: () => void;
  }) => (
    <ul
      className={cn(isMobile ? "space-y-6 text-center" : "flex items-center gap-8 justify-center")}
    >
      {PublicNavbarRoutes.map((item, index) => (
        <li key={index}>
          <Link
            href={item.url}
            className={cn(
              "transition-colors duration-300",
              isMobile
                ? "block text-xl font-medium text-foreground hover:text-primary"
                : "relative group text-sm font-medium text-muted-foreground hover:text-foreground",
            )}
            onClick={onItemClick}
          >
            {item.label}
            {!isMobile && (
              <span className="absolute left-0 -bottom-1.5 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full" />
            )}
          </Link>
        </li>
      ))}
    </ul>
  );

  /**
   * Renders the call-to-action buttons (e.g., Log In, Sign Up).
   * @param {{ isMobile?: boolean }} props - Component props.
   */
  const CTAButtons = ({ isMobile = false }: { isMobile?: boolean }) => (
    <div className={cn(isMobile ? "flex flex-col gap-4 w-full pt-8" : "flex items-center gap-3")}>
      {CtaButtons.map(({ label, link, variant }) => (
        <ButtonCta
          key={label}
          label={label}
          link={link}
          size="sm"
          className={cn(
            "font-semibold rounded-full transition-transform duration-200 hover:scale-105",
            variant === "outline"
              ? "border-border/50 bg-background/10 text-foreground hover:bg-accent"
              : "bg-foreground text-background hover:bg-foreground/90",
            isMobile && "w-full text-lg py-6",
          )}
        />
      ))}
    </div>
  );

  return (
    <header className="fixed top-0 z-50 w-full">
      <div
        className={cn(
          "mx-auto border-b transition-all duration-300",
          scrolled
            ? "bg-background/70 backdrop-blur-md border-border/50"
            : "bg-transparent border-transparent",
        )}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between p-4 px-6 lg:px-8">
          <Link href="/" className="flex items-center justify-center">
            <span className="text-2xl font-bold text-foreground transition-colors duration-300 hover:text-primary">
              inquora
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <nav>
              <NavigationList />
            </nav>
            <div className="flex items-center gap-3">
              <CTAButtons />
            </div>
            <ModeToggle />
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-accent md:hidden"
            onClick={toggleMenu}
          >
            <Menu className="h-6 w-6" />
            <span className="sr-only">Open menu</span>
          </Button>
        </div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="fixed inset-0 bg-background/90 backdrop-blur-sm" onClick={closeMenu}>
            <div className="flex h-full flex-col p-6 pt-4">
              <div className="flex items-center justify-between">
                <Link href="/" className="text-2xl font-bold text-foreground" onClick={closeMenu}>
                  inquora
                </Link>
                <Button variant="ghost" size="icon" onClick={closeMenu}>
                  <X className="h-6 w-6 text-foreground" />
                  <span className="sr-only">Close menu</span>
                </Button>
              </div>
              <div className="flex flex-1 flex-col items-center justify-center">
                <nav>
                  <NavigationList isMobile onItemClick={closeMenu} />
                </nav>
                <div className="flex flex-col items-center w-full">
                  <CTAButtons isMobile />
                  <MobileThemeSelector />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
