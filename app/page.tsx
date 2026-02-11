import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Problem from "@/components/landing/Problem";
import StickySteps from "@/components/landing/StickySteps";
import Features from "@/components/landing/Features";
import Testimonial from "@/components/landing/Testimonial";
import Waitlist from "@/components/landing/Waitlist";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <Problem />
      <StickySteps />
      <Features />
      <Testimonial />
      <Waitlist />
      <Footer />
    </main>
  );
}
