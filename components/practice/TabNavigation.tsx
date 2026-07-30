"use client";

import { motion } from "framer-motion";

export type TabId = "trace" | "test" | "sync";

interface Tab {
  id: TabId;
  number: string;
  label: string;
}

const TABS: Tab[] = [
  { id: "trace", number: "01", label: "TRACE" },
  { id: "test",  number: "02", label: "TEST"  },
  { id: "sync",  number: "03", label: "SYNC"  },
];

const TAB_ORDER: TabId[] = ["trace", "test", "sync"];

export interface TabNavigationProps {
  currentTab: TabId;
  onTabChange: (tab: TabId) => void;
  completedTabs: TabId[];
}

function getTabState(
  tab: TabId,
  currentTab: TabId,
  completedTabs: TabId[]
): "active" | "completed" | "available" | "locked" {
  if (tab === currentTab) return "active";
  if (completedTabs.includes(tab)) return "completed";
  const tabIndex = TAB_ORDER.indexOf(tab);
  if (tabIndex === 0) return "available";
  const prevTab = TAB_ORDER[tabIndex - 1];
  if (completedTabs.includes(prevTab)) return "available";
  return "locked";
}

export default function TabNavigation({ currentTab, onTabChange, completedTabs }: TabNavigationProps) {
  return (
    /*
      Stage ground, not paper — this pill floats over the live camera feed and
      was `bg-white/90`, which made the tab bar the brightest thing on screen.

      The four states used to differ only by text opacity (45% vs 20% ink),
      which is not a difference you can resolve from ten feet away. Now active
      is a filled pill, completed is a green check on a tinted ground, available
      is plain, and locked is dimmed with a padlock — fill and glyph, not
      opacity alone.
    */
    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-stage-glass p-1 shadow-stage backdrop-blur-xl">
      {TABS.map((tab) => {
        const state = getTabState(tab.id, currentTab, completedTabs);
        const isClickable = state !== "locked";

        return (
          <button
            key={tab.id}
            onClick={() => isClickable && onTabChange(tab.id)}
            disabled={!isClickable}
            aria-current={state === "active" ? "step" : undefined}
            aria-label={`${tab.number} ${tab.label}${state === "locked" ? " (locked)" : state === "completed" ? " (done)" : ""}`}
            className={`touch-target relative flex min-h-[38px] items-center gap-1.5 rounded-full px-3.5 text-hud font-extrabold tracking-wider transition-ui sm:px-4 ${
              state === "active"
                ? "text-white"
                : state === "completed"
                  ? "cursor-pointer bg-duo-green/20 text-duo-green hover:bg-duo-green/30"
                  : state === "available"
                    ? "cursor-pointer text-stage-text/75 hover:text-stage-text"
                    : "cursor-not-allowed text-stage-text/30"
            }`}
          >
            {state === "active" && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-duo-green"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {state === "completed" ? (
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <span className="text-hud opacity-60">{tab.number}</span>
              )}
              {tab.label}
              {state === "locked" && (
                <svg className="h-3 w-3 opacity-70" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM12 17c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM9 8V6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9z" />
                </svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
