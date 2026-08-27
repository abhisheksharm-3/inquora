"use client";

import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from "@/components/ui/carousel";
import { TypeSlide } from "@/types/ui";

const slides: TypeSlide[] = [
  {
    type: "image",
    src: "/landing.png",
    title: "Landing Page",
    caption: "",
  },
  {
    type: "image",
    src: "/sample.png",
    title: "Demo Chat",
    caption: "",
  },
];

/**
 * Renders a decorative browser frame around its children.
 * @param {{ children: React.ReactNode }} props - The component props.
 */
const BrowserFrame: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="overflow-hidden rounded-xl border border-border/20 bg-card/30 shadow-2xl backdrop-blur-md">
    <div className="flex items-center gap-2 border-b border-border/10 bg-muted/20 p-3">
      <div className="flex gap-1.5">
        <div className="h-3 w-3 rounded-full bg-destructive/80"></div>
        <div className="h-3 w-3 rounded-full bg-yellow-500/80"></div>
        <div className="h-3 w-3 rounded-full bg-green-500/80"></div>
      </div>
      <div className="mx-auto flex h-6 w-2/3 items-center justify-center rounded-md bg-muted/50 px-3 text-xs text-muted-foreground">
        https://inquora.vercel.app
      </div>
    </div>
    {children}
  </div>
);

/**
 * Renders a branding panel with an auto-playing carousel of product images.
 * This component is typically displayed on authentication pages to showcase
 * the application.
 * @returns {JSX.Element} The rendered branding panel.
 */
export const AuthBrandingPanel: React.FC = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    const onSelect = () => {
      setCurrent(api.selectedScrollSnap());
    };

    setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);

    const interval = setInterval(() => {
      api.scrollNext();
    }, 5000);

    return () => {
      api.off("select", onSelect);
      clearInterval(interval);
    };
  }, [api]);

  return (
    <div className="relative hidden h-full flex-col justify-center p-8 lg:flex xl:p-12">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.8 }}
        className="relative z-10 flex-1 flex flex-col justify-center"
      >
        <Carousel
          setApi={setApi}
          opts={{
            loop: true,
            skipSnaps: false,
            duration: 20,
          }}
          className="w-full max-w-7xl mx-auto"
        >
          <BrowserFrame>
            <CarouselContent>
              {slides.map((slide, index) => (
                <CarouselItem key={index}>
                  <div className="aspect-video overflow-hidden bg-muted/50">
                    {slide.type === "image" ? (
                      <img
                        src={slide.src}
                        alt={slide.caption}
                        className="h-full w-full object-cover object-center transition-transform duration-700"
                      />
                    ) : (
                      <video
                        src={slide.src}
                        className="h-full w-full object-cover object-center"
                        autoPlay
                        muted
                        loop
                        playsInline
                      />
                    )}
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
          </BrowserFrame>
        </Carousel>
      </motion.div>
    </div>
  );
};
