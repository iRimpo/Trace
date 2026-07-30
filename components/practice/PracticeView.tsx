"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import TabNavigation, { TabId } from "@/components/practice/TabNavigation";
import TraceTab from "@/components/practice/TraceTab";
import TestTab from "@/components/practice/TestTab";
import SyncTab from "@/components/practice/SyncTab";
import CalibrationModal, { type CalibrationData } from "@/components/practice/CalibrationModal";
import ErrorBoundary from "@/components/ErrorBoundary";
import InstallGate from "@/components/practice/InstallGate";
import { track } from "@/lib/posthog";
import { parseIdentityKey } from "@/lib/videoIdentity";
import { useWakeLock } from "@/lib/useWakeLock";

export interface PracticeViewProps {
  videoUrl:    string;
  videoId:     string | null;
  videoTitle:  string;
  videoSource: "youtube" | "tiktok" | "upload";
  /** identityKey (videoIdentity.ts) — enables the shared scan cache. */
  identityKey?: string | null;
  /** Optional banner rendered below the header (e.g. session-only warning) */
  banner?: React.ReactNode;
}

export default function PracticeView({ videoUrl, videoId, videoTitle, videoSource, identityKey, banner }: PracticeViewProps) {
  const router = useRouter();
  const [currentTab,    setCurrentTab]    = useState<TabId>("trace");
  const [completedTabs, setCompletedTabs] = useState<TabId[]>([]);
  const [sessionId,     setSessionId]     = useState("");
  const [traceTimeSeconds, setTraceTimeSeconds] = useState(0);

  const [calibrated,      setCalibrated]      = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);

  // The user is dancing away from the phone for the whole session — don't let
  // the screen sleep mid-song.
  useWakeLock();

  const handleTraceComplete = useCallback((seconds: number) => {
    setTraceTimeSeconds(seconds);
    setCompletedTabs((prev) => prev.includes("trace") ? prev : [...prev, "trace"]);
    setCurrentTab("test");
    track("trace_phase_completed", { videoId, traceTimeSeconds: seconds });
  }, [videoId]);

  const handleTestComplete = useCallback((sid: string) => {
    setSessionId(sid);
    setCompletedTabs((prev) => prev.includes("test") ? prev : [...prev, "test"]);
    setCurrentTab("sync");
    track("test_phase_completed", { videoId, sessionId: sid });
  }, [videoId]);

  const handleCalibrated = useCallback((data: CalibrationData) => {
    setCalibrationData(data);
    setCalibrated(true);
  }, []);

  const handleCalibrationSkip = useCallback(() => {
    setCalibrated(true);
  }, []);

  const handlePracticeAgain = useCallback(() => {
    setCompletedTabs([]);
    setCurrentTab("trace");
    setSessionId("");
    setTraceTimeSeconds(0);
  }, []);

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black md:h-screen">
      {/* iOS has no Fullscreen API, so installing is the only way to practise
          without Safari's address bar covering the frame. Mounted here rather
          than in the root layout: a takeover on the landing page or dashboard
          would fire long before the user has a reason to want the app. */}
      <InstallGate />

      {/* Calibration modal */}
      {!calibrated && videoUrl && (
        <CalibrationModal videoUrl={videoUrl} onCalibrated={handleCalibrated} onSkip={handleCalibrationSkip} />
      )}

      {/* ── Floating header bar ──────────────────────────────────── */}
      <div
        className="pointer-events-none absolute left-0 right-0 top-0 z-50 px-3 py-3"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        {/*
          Three columns, all in normal flow. The tab bar used to be
          `absolute top-1/2 -translate-y-1/2`, which centres on the *padding*
          box — so on a Dynamic Island iPhone the ~59px safe-area inset counted
          as centreable space and the bar landed underneath the status bar,
          colliding with the back button sitting correctly below it. A grid
          keeps the bar optically centred without leaving the padded flow.
        */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2">
          {/* Back + title */}
          <div className="pointer-events-auto flex items-center gap-3">
            <Link href="/dashboard" className="touch-target flex h-9 items-center gap-1.5 rounded-full border border-white/10 bg-stage-glass px-3 text-hud font-extrabold text-stage-text/80 backdrop-blur-xl transition-ui hover:bg-stage/80 hover:text-stage-text">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
              <span className="hidden sm:inline max-w-[160px] truncate">{videoTitle}</span>
            </Link>
          </div>

          {/* Tab bar — centre column. */}
          <div className="pointer-events-auto flex justify-center">
            <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} completedTabs={completedTabs} />
          </div>

          {/* Logo badge — decorative, and it sits on the same coordinates as
              TraceTab's top-right controls (auto-align / help / fullscreen).
              At z-50 vs their z-30 it covered the fullscreen button outright,
              so it's hidden until there's room for both. */}
          <div className="pointer-events-auto hidden items-center gap-2 sm:flex">
            <div className="flex h-9 w-9 flex-col items-center justify-center rounded-full border border-white/10 bg-stage-glass backdrop-blur-xl">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
                <circle cx="7" cy="7" r="2" fill="white" opacity="0.7"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Optional banner (session-only warning, etc.) */}
      {banner}

      {/* ── Tab content (full viewport) ──────────────────────────── */}
      <ErrorBoundary>
        {currentTab === "trace" && videoUrl && (
          <TraceTab
            videoUrl={videoUrl}
            onComplete={handleTraceComplete}
            initialFraming={calibrationData ?? undefined}
            videoIdentity={identityKey ? parseIdentityKey(identityKey) : null}
          />
        )}

        {currentTab === "test" && videoUrl && (
          <TestTab
            videoUrl={videoUrl}
            videoId={videoId}
            videoSource={videoSource}
            videoTitle={videoTitle}
            traceTimeSeconds={traceTimeSeconds}
            onComplete={handleTestComplete}
            initialFraming={calibrationData ?? undefined}
          />
        )}

        {currentTab === "sync" && videoUrl && (
          <SyncTab videoUrl={videoUrl} sessionId={sessionId} initialFraming={calibrationData ?? undefined} onPracticeAgain={handlePracticeAgain} onGoToDashboard={() => router.push(`/dashboard?t=${Date.now()}`)} />
        )}
      </ErrorBoundary>
    </div>
  );
}
