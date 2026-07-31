"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ErrorBoundary from "@/components/ErrorBoundary";
import IconButton from "@/components/ui/IconButton";
import LoadingState from "@/components/states/LoadingState";
import AppNav, { useNavInset } from "@/components/nav/AppNav";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, loading, signOut } = useAuth();
  const navInset = useNavInset();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-cream">
        {/* The same moment as the practice page's session check, so the same
            component — this was a hand-rolled framer ring drawing a second
            spinner for one wait. */}
        <LoadingState message="Checking your session…" />
      </div>
    );
  }

  if (!user) return null;

  const displayInitial =
    (user.user_metadata?.full_name ?? user.user_metadata?.name)?.trim()[0] ??
    user.email?.[0] ??
    "U";
  const userInitial = displayInitial.toUpperCase();

  /* Identity and the account action, handed to whichever nav shape is on
     screen. One definition — the header and the bar cannot drift. */
  const account = (
    <div className="flex items-center gap-1.5">
      {/* Not interactive, so no hover and no label — it identifies, the
          button beside it acts. */}
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-ink text-sm font-extrabold text-white">
        {userInitial}
      </div>
      <IconButton
        aria-label="Log out"
        title="Log out"
        visual="md"
        round={false}
        onClick={handleSignOut}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      </IconButton>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-brand-cream" style={navInset}>
      {/*
        The header now carries identity only — the logo and the wordmark.
        Navigation and the account action moved into AppNav, which puts them
        within a thumb's reach instead of in the top corner of a phone.

        Sticky, because the page below it scrolls. `bg-brand-cream/90
        backdrop-blur` rather than opaque cream so content passing underneath
        reads as passing underneath, not as being clipped.
      */}
      <header className="sticky top-0 z-30 border-b-2 border-duo-edge bg-brand-cream/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <img src="/trace_logo.svg" width="34" height="34" alt="" className="rounded-full" />
            <span className="text-hud-lg font-extrabold uppercase tracking-[0.18em] text-ink">
              Trace
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      <AppNav account={account} />
    </div>
  );
}
