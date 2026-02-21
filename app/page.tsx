import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import LogoCloud from "@/components/landing/LogoCloud";
import HowItWorks from "@/components/landing/HowItWorks";
import Problem from "@/components/landing/Problem";
import Features from "@/components/landing/Features";
import Waitlist from "@/components/landing/Waitlist";
import Footer from "@/components/landing/Footer";

export default function Home() {
  return (
    <main>
      <Navbar />
      <Hero />
      <LogoCloud />
      <HowItWorks />
      <Problem />
      <Features />
      <Waitlist />
      <Footer />
    </main>
  );
}
