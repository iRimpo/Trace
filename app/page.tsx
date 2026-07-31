import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import MeetTrace from "@/components/landing/MeetTrace";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Waitlist from "@/components/landing/Waitlist";
import Footer from "@/components/landing/Footer";
import FloatingCTA from "@/components/landing/FloatingCTA";

/**
 * The landing page sits on the same cream paper as `/login` and `/dashboard`.
 *
 * It used to alternate white, cream, white and near-black across seven grounds
 * stitched together with checkerboard stripes, and then handed off to a cream
 * login page — so the first thing a new account saw was the product changing
 * colour. One ground, one type scale, one button.
 */
export default function Home() {
  return (
    <div className="min-h-screen bg-brand-cream text-ink">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:flex focus:h-11 focus:items-center focus:rounded-2xl focus:bg-ink focus:px-5 focus:text-sm focus:font-extrabold focus:text-white"
      >
        Skip to content
      </a>

      <Navbar />

      <main id="main">
        <Hero />
        <MeetTrace />
        <HowItWorks />
        <Features />
        <Waitlist />
      </main>

      <Footer />
      <FloatingCTA />
    </div>
  );
}
