"use client";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import React from "react";

/**
 * @description A list of features included in the free beta plan.
 */
const featuresIncluded = [
  "AI-powered conversations",
  "Support for all document formats",
  "Unlimited uploads & queries",
  "Secure cloud storage",
  "Real-time collaboration",
];

/**
 * Renders the pricing section for the landing page.
 * It displays a single "Free during Beta" plan, listing the included features
 * and a call-to-action to get started.
 * @returns {JSX.Element} The pricing section component.
 */
const Pricing = () => {
  return (
    <section
      id="pricing"
      className="relative w-full border-b border-border bg-cover bg-center py-24 sm:py-32"
    >
      <div className="absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-7xl px-6 text-center">
        <div className="mb-8 flex justify-center">
          <Badge
            variant="outline"
            className="inline-flex items-center gap-2 rounded-full border-border bg-background/5 px-4 py-2 text-muted-foreground transition-colors hover:bg-background/10"
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary/80" />
            <span className="text-sm font-medium tracking-wide">Pricing</span>
          </Badge>
        </div>
        <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground md:text-5xl">
          Free While We&apos;re in Beta
        </h2>
        <p className="mx-auto mb-16 max-w-3xl text-lg font-light text-muted-foreground md:text-xl">
          Join our journey and enjoy full access to Inquora. No limits, no
          costs—just your feedback to help us build the best product possible.
        </p>
        <div className="relative mx-auto max-w-2xl rounded-2xl border border-border bg-card/50 p-8 text-left backdrop-blur-sm">
          <div className="flex flex-col gap-8 md:flex-row md:items-center">
            <div className="flex-1 text-center md:text-left">
              <p className="text-sm font-medium text-primary">PLAN</p>
              <p className="mt-2 text-7xl font-bold tracking-tighter text-foreground">
                Free
              </p>
              <p className="text-muted-foreground">During our Beta phase</p>
            </div>
            <div className="flex-1 border-t border-border pt-8 md:border-l md:border-t-0 md:pl-8 md:pt-0">
              <p className="mb-4 font-semibold text-foreground">
                Includes full access to:
              </p>
              <ul className="space-y-3">
                {featuresIncluded.map((feature, index) => (
                  <li key={index} className="flex items-center gap-3">
                    <Check className="h-5 w-5 flex-shrink-0 text-primary" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-border pt-8">
            <Button
              size="lg"
              className="w-full font-semibold transition-all active:scale-[0.98] cursor-pointer"
            >
              Get Started for Free
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground/70">
              No credit card required.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Pricing;