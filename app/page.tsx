import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import MeetTrace from "@/components/landing/MeetTrace";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Waitlist from "@/components/landing/Waitlist";
import Footer from "@/components/landing/Footer";
import FloatingCTA from "@/components/landing/FloatingCTA";

export default function Home() {
  return (
    <main className="bg-white text-[#1a0f00] overflow-x-hidden">
      <Navbar />
      <Hero />
      <MeetTrace />
      <HowItWorks />
      <Features />
      <Waitlist />
      <Footer />
      <FloatingCTA />
    </main>
  );
}
