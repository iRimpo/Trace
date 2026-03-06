"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { track } from "@/lib/analytics";

/**
 * After Google OAuth, the user lands with a session but may not have a user_profile yet.
 * We stored the activation code in sessionStorage before redirecting. Call /api/activation/record
 * to create the profile. If user has no profile and no code, they're not activated.
 */
export default function ActivationGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (loading || !user) {
      setChecking(false);
      return;
    }

    let cancelled = false;

    async function checkAndRecord() {
      try {
        const res = await fetch("/api/me");
        if (!res.ok) {
          setChecking(false);
          return;
        }
        const data = await res.json();

        if (data.has_profile && data.is_activated) {
          setChecking(false);
          return;
        }

        // No profile - try to record from sessionStorage (Google OAuth flow)
        const code =
          typeof window !== "undefined" ? window.sessionStorage.getItem("trace_activation_code") : null;

        if (code) {
          const recordRes = await fetch("/api/activation/record", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
          });
          if (typeof window !== "undefined") {
            window.sessionStorage.removeItem("trace_activation_code");
          }
          if (recordRes.ok && !cancelled) {
            track("signup_completed", { source: "google", activation_code: code });
            setChecking(false);
            return;
          }
        }

        // No profile and no code - e.g. used "Log in with Google" but account doesn't exist
        if (!data.is_activated && !data.has_profile) {
          await supabase.auth.signOut();
          router.replace("/signup?error=no_account");
        }
      } catch {
        // Ignore
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkAndRecord();
    return () => {
      cancelled = true;
    };
  }, [user, loading, router]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f8f4e0]">
        <div className="relative h-10 w-10">
          <div className="absolute inset-0 rounded-full border-2 border-[#1a0f00]/10" />
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-transparent border-t-[#1a0f00]"
            animate={{ rotate: 360 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
