"use client";

import { motion, AnimatePresence } from "framer-motion";
import { FaLock, FaCheck } from "react-icons/fa";

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
    <div className="w-full">
      <div className="grid grid-cols-3 gap-3">
        {TABS.map((tab) => {
          const state = getTabState(tab.id, currentTab, completedTabs);
          const isClickable = state !== "locked";

          return (
            <button
              key={tab.id}
              onClick={() => isClickable && onTabChange(tab.id)}
              disabled={!isClickable}
              aria-label={
                state === "locked"
                  ? `${tab.label} — locked, complete previous step first`
                  : state === "completed"
                    ? `${tab.label} — completed`
                    : tab.label
              }
              className={`group relative overflow-hidden rounded-2xl border px-4 py-5 text-center transition-all duration-300 sm:px-6 sm:py-7 ${
                state === "active"
                  ? "border-brand-primary/30 bg-gradient-to-br from-brand-primary to-blue-500 shadow-xl shadow-brand-primary/25"
                  : state === "completed"
                    ? "cursor-pointer border-emerald-400/25 bg-emerald-50 hover:border-emerald-400/40"
                    : state === "available"
                      ? "cursor-pointer border-brand-primary/10 bg-white hover:border-brand-primary/20 hover:bg-brand-bg"
                      : "cursor-not-allowed border-brand-dark/[0.04] bg-brand-dark/[0.02]"
              }`}
            >
              {/* Active glow */}
              {state === "active" && (
                <motion.div
                  layoutId="tab-active-glow"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-br from-brand-primary to-blue-500"
                  transition={{ type: "spring", stiffness: 400, damping: 35 }}
                />
              )}

              <div className="relative z-10">
                <AnimatePresence mode="wait">
                  {state === "completed" ? (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, rotate: -45 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-400/20 sm:h-12 sm:w-12"
                    >
                      <FaCheck className="text-emerald-500 sm:text-lg" />
                    </motion.div>
                  ) : (
                    <motion.p
                      key="number"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className={`text-3xl font-bold tracking-tight sm:text-[2.5rem] ${
                        state === "active"
                          ? "text-white"
                          : state === "locked"
                            ? "text-brand-dark/10"
                            : "text-brand-dark/15"
                      }`}
                    >
                      {tab.number}
                    </motion.p>
                  )}
                </AnimatePresence>

                <p className={`mt-2 text-xs font-bold tracking-widest sm:text-sm ${
                  state === "active"
                    ? "text-white/90"
                    : state === "completed"
                      ? "text-emerald-500"
                      : state === "locked"
                        ? "text-brand-dark/15"
                        : "text-brand-dark/30"
                }`}>
                  {tab.label}
                </p>
              </div>

              {/* Lock icon */}
              {state === "locked" && (
                <div className="absolute right-2.5 top-2.5 sm:right-3 sm:top-3">
                  <FaLock className="text-brand-dark/10 text-xs" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Progress bar */}
      <div className="mx-auto mt-4 flex max-w-xs items-center gap-1">
        {TAB_ORDER.map((tabId, i) => (
          <div key={tabId} className="flex flex-1 items-center gap-1">
            <motion.div
              className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                completedTabs.includes(tabId)
                  ? "bg-emerald-400"
                  : tabId === currentTab
                    ? "bg-brand-primary"
                    : "bg-brand-dark/[0.06]"
              }`}
            />
            {i < TAB_ORDER.length - 1 && (
              <div className={`h-1 w-1 flex-shrink-0 rounded-full transition-colors duration-500 ${
                completedTabs.includes(tabId) ? "bg-emerald-400" : "bg-brand-dark/[0.06]"
              }`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
