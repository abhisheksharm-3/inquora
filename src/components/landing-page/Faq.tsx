"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { FaqData } from "@/constants/FaqData";
import React from "react";

/**
 * Renders the FAQ section of the landing page.
 * It displays a list of questions and answers in an accordion, pulling data
 * from the `FaqData` constant.
 * @returns {JSX.Element} The FAQ section component.
 */
const Faqs = () => {
  return (
    <section
      id="faq"
      className="relative w-full bg-cover bg-center py-24 sm:py-32"
    >
      <div className="absolute inset-0 z-0" />
      <div className="relative z-10 mx-auto max-w-4xl px-6 text-center">
        <div className="mb-8 flex justify-center">
          <Badge
            variant="outline"
            className="inline-flex items-center gap-2 rounded-full border-border bg-background/5 px-4 py-2 text-muted-foreground transition-colors hover:bg-background/10"
          >
            <div className="h-2 w-2 animate-pulse rounded-full bg-primary/80" />
            <span className="text-sm font-medium tracking-wide">Questions</span>
          </Badge>
        </div>
        <h2 className="mb-4 text-4xl font-bold leading-tight tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-foreground to-muted-foreground md:text-5xl">
          Frequently Asked Questions
        </h2>
        <p className="mx-auto mb-16 max-w-3xl text-lg font-light text-muted-foreground md:text-xl">
          Have questions? We&apos;ve got answers. If you can&apos;t find what
          you&apos;re looking for, feel free to reach out to our support team.
        </p>
        <div className="rounded-2xl border border-border bg-card/50 text-left backdrop-blur-sm">
          <Accordion type="single" collapsible className="w-full">
            {FaqData.map((item, index) => (
              <AccordionItem
                key={item.value}
                value={item.value}
                className={
                  index === FaqData.length - 1
                    ? "border-none"
                    : "border-b border-border"
                }
              >
                <AccordionTrigger className="p-6 text-lg font-medium text-foreground transition-colors hover:bg-accent hover:no-underline">
                  <span className="text-left">{item.question}</span>
                </AccordionTrigger>
                <AccordionContent className="px-6 pb-6 text-base leading-relaxed text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};

export default Faqs;