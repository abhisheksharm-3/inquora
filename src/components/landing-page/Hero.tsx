"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

/**
 * Renders the hero section for the landing page.
 * It features a headline, subheading, and call-to-action buttons that animate
 * into view on component mount for a dynamic user experience.
 * @returns {JSX.Element} The hero section component.
 */
const Hero = () => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  return (
    <section className="relative w-full min-h-screen flex items-center justify-center overflow-hidden bg-cover bg-center">
      <div className="absolute inset-0 bg-background/80 dark:bg-background/60" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
        <div
          className={`mb-6 transition-all duration-1000 ease-out ${
            isLoaded ? "translate-y-0 opacity-100" : "-translate-y-4 opacity-0"
          }`}
        >
          <Badge
            variant="secondary"
            className="group inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/20 bg-background/5 px-4 py-2 text-muted-foreground shadow-sm transition-colors hover:bg-background/10"
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
            <span className="text-sm font-medium tracking-wide">New: Video & Image Analysis</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground/70 transition-transform group-hover:translate-x-1" />
          </Badge>
        </div>

        <div className="mb-6">
          <h1
            className={`text-5xl pb-1 font-bold leading-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground transition-all duration-1000 ease-out md:text-7xl ${
              isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
            style={{ transitionDelay: "200ms" }}
          >
            Inquire Anything.
          </h1>
          <h1
            className={`text-5xl pb-1 font-bold leading-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground transition-all duration-1000 ease-out md:text-7xl ${
              isLoaded ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            Understand Everything.
          </h1>
        </div>

        <div
          className={`mb-10 transition-all duration-1000 ease-out ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          style={{ transitionDelay: "600ms" }}
        >
          <p className="mx-auto max-w-3xl text-lg font-light leading-relaxed text-muted-foreground md:text-xl">
            Instantly turn your documents, code, images, and videos into intelligent, interactive
            conversations with our secure AI platform.
          </p>
        </div>

        <div
          className={`flex flex-col items-center gap-6 transition-all duration-1000 ease-out ${
            isLoaded ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0"
          }`}
          style={{ transitionDelay: "800ms" }}
        >
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Button
              size="lg"
              className="w-52 rounded-full bg-primary px-8 text-md font-semibold text-primary-foreground transition-all duration-300 hover:scale-105 hover:bg-primary/90 active:scale-95"
              asChild
            >
              <a href="/signup">
                Start for Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="w-52 rounded-full border-border bg-transparent px-8 text-md font-medium text-foreground transition-all duration-300 hover:scale-105 hover:border-border/80 hover:bg-accent hover:text-accent-foreground active:scale-95"
              asChild
            >
              <Link href="/#how-it-works">See it in Action</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
