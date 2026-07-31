"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useIsPortrait } from "@/components/practice/chrome";

/**
 * The app's navigation — a bottom tab bar on a phone, a left rail otherwise.
 *
 * Before this, every destination and both account actions lived in a top
 * header. On a phone the top of the screen is the hardest place to reach and
 * the least safe place to put a control — it is where the notch, the status bar
 * and the browser chrome all compete — and it meant the two things a user
 * actually does here, *start practising* and *sign out*, were in the one corner
 * a thumb cannot get to without regripping.
 *
 * ── Why these three ──────────────────────────────────────────────────────
 *
 * The program document proposes Practice · Progress · Profile. Progress and
 * Profile are not routes that exist, and inventing two empty pages to fill a
 * tab bar is how navigation ends up describing an app that isn't there. So the
 * bar carries what is real: the two routes (`/practice`, `/dashboard`) and the
 * account action that was stranded in the top-right. If a Profile route lands
 * later, it takes the third slot and `Account` moves into it.
 *
 * ── Orientation, not width ───────────────────────────────────────────────
 *
 * Same rule as the practice surfaces (contract §7). A phone in landscape has
 * ~390px of height and a bottom bar eats an eighth of it, so it gets the rail;
 * a tablet held upright has room and a thumb far from the top, so it gets the
 * bar. `sm:`/`md:` cannot express either.
 */

interface Item {
  href: string;
  label: string;
  icon: ReactNode;
  /** Also match nested routes — /practice/[videoId] is still "Practice". */
  prefix?: boolean;
}

const ITEMS: Item[] = [
  {
    href: "/dashboard",
    label: "Library",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25A2.25 2.25 0 0 1 13.5 8.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
  },
  {
    href: "/practice",
    label: "Practice",
    prefix: true,
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-6 w-6">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 0 1 0 1.971l-11.54 6.347a1.125 1.125 0 0 1-1.667-.985V5.653Z" />
      </svg>
    ),
  },
];

interface Props {
  /** Rendered inside the Account slot — the avatar and sign-out. */
  account: ReactNode;
}

export default function AppNav({ account }: Props) {
  const pathname = usePathname();
  const isPortrait = useIsPortrait();

  const isActive = (item: Item) =>
    item.prefix ? pathname.startsWith(item.href) : pathname === item.href;

  const links = ITEMS.map(item => {
    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        aria-current={active ? "page" : undefined}
        /*
          Active is a filled ink pill, not a green one. Green means "go /
          commit" everywhere in this app (contract §2) and a permanently-green
          nav tab would make the one colour that means "start" ambient — the
          same mistake the practice toolbar makes with five colours at equal
          weight. Ink is neutral, and fill-vs-no-fill survives being seen from
          across a room in a way a tint never does.
        */
        className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 transition-ui duration-150 ease-out-strong active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 ${
          active
            ? "bg-ink text-white shadow-chunk-ink"
            : "text-clay hover:bg-ink/[0.06] hover:text-ink"
        }`}
      >
        {item.icon}
        <span className="text-hud font-extrabold tracking-wide">{item.label}</span>
      </Link>
    );
  });

  if (isPortrait) {
    return (
      <nav
        aria-label="Main"
        /* Sticky-bottom rather than in flow: the page below scrolls, and a bar
           that scrolls away takes every destination with it. */
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-duo-edge bg-brand-cream/95 backdrop-blur-md"
        style={{ paddingBottom: "max(0.25rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-3xl items-stretch gap-1 px-2 pt-1">
          {links}
          <div className="flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1">
            {account}
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Main"
      className="fixed inset-y-0 left-0 z-40 flex w-24 flex-col items-stretch gap-2 border-r-2 border-duo-edge bg-brand-cream px-2 py-4"
    >
      <Link href="/" className="mb-2 flex flex-col items-center gap-1.5" aria-label="Trace home">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/trace_logo.svg" width="34" height="34" alt="" className="rounded-full" />
      </Link>
      {links}
      <div className="mt-auto flex flex-col items-center gap-2">{account}</div>
    </nav>
  );
}

/** Space the nav occupies, for the layout to reserve. */
export function useNavInset(): { paddingBottom?: string; paddingLeft?: string } {
  const isPortrait = useIsPortrait();
  return isPortrait
    ? { paddingBottom: "calc(4.5rem + env(safe-area-inset-bottom))" }
    : { paddingLeft: "6rem" };
}
