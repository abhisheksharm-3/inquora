import Features from "@/components/landing-page/Features";
import Hero from "@/components/landing-page/Hero";
import Pricing from "@/components/landing-page/Pricing";
import Faqs from "@/components/landing-page/Faq";
import Layout from "@/components/layout/Layout";
import Dither from "@/components/backgrounds/Dither/Dither";

/**
 * Renders the main landing page, which assembles the Hero, Features, Pricing,
 * and FAQs sections.
 *
 * It features a unique full-screen dither effect for the hero section that
 * transitions smoothly into a solid background for the subsequent content.
 * @returns {JSX.Element} The complete landing page component.
 */
const Home = () => {
  const brandViolet: [number, number, number] = [0.408, 0.212, 0.796];

  return (
    <Layout showDitherBackground={false} contentClassName="p-0">
      <div className="relative min-h-screen">
        <div className="absolute inset-0 z-0">
          <Dither
            waveColor={brandViolet}
            disableAnimation={false}
            enableMouseInteraction={true}
            mouseRadius={0.3}
            colorNum={3}
            waveAmplitude={0.2}
            waveFrequency={1.5}
            waveSpeed={0.02}
          />
        </div>

        <div className="relative z-40">
          <Hero />
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-b from-transparent to-background z-30" />
      </div>

      <div className="bg-white/70 dark:bg-black/70 relative z-20">
        <Features />
        <Pricing />
        <Faqs />
      </div>
    </Layout>
  );
};

export default Home;
