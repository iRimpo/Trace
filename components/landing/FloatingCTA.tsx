"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import Pressable from "@/components/ui/Pressable";

/**
 * A thumb-reachable "Get Started" once the hero's copy has scrolled away.
 *
 * Two rules keep it from being noise. It does not appear while the hero's own
 * CTA is still on screen, and it gets out of the way once the invite form it
 * points at is visible — a floating button that covers the form it scrolls you
 * to is a trap. Both are decided by an IntersectionObserver on `#waitlist`
 * rather than by a pixel guess about page height.
 *
 * It is redundant chrome, not content: the header carries the same action at
 * every scroll position, so nothing is lost if this never mounts.
 */
export default function FloatingCTA() {
  const { user, loading } = useAuth();
  const [pastHero, setPastHero] = useState(false);
  const [atForm, setAtForm] = useState(false);

  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > window.innerHeight * 0.75);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const target = document.getElementById("waitlist");
    if (!target) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtForm(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  const show = !loading && !user && pastHero && !atForm;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
          className="pb-safe fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:px-0"
        >
          <Pressable href="#waitlist" variant="primary" size="md">
            Get Started
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Pressable>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
