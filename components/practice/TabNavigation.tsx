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
    <div className="flex items-center gap-1 rounded-full bg-white/90 p-1 backdrop-blur-xl border border-[#1a0f00]/10 shadow-sm">
      {TABS.map((tab) => {
        const state = getTabState(tab.id, currentTab, completedTabs);
        const isClickable = state !== "locked";

        return (
          <button
            key={tab.id}
            onClick={() => isClickable && onTabChange(tab.id)}
            disabled={!isClickable}
            className={`relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[11px] font-bold tracking-wider transition-all ${
              state === "active"
                ? "text-white"
                : state === "completed"
                  ? "cursor-pointer text-emerald-600 hover:text-emerald-500"
                  : state === "available"
                    ? "cursor-pointer text-[#1a0f00]/45 hover:text-[#1a0f00]/80"
                    : "cursor-not-allowed text-[#1a0f00]/20"
            }`}
          >
            {state === "active" && (
              <motion.div
                layoutId="tab-pill"
                className="absolute inset-0 rounded-full bg-[#080808]"
                transition={{ type: "spring", stiffness: 400, damping: 35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {state === "completed" ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              ) : (
                <span className="text-[9px] opacity-60">{tab.number}</span>
              )}
              {tab.label}
              {state === "locked" && (
                <svg className="h-2.5 w-2.5 opacity-40" fill="currentColor" viewBox="0 0 24 24">
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
