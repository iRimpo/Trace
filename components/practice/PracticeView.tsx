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
import { track } from "@/lib/posthog";

export interface PracticeViewProps {
  videoUrl:    string;
  videoId:     string | null;
  videoTitle:  string;
  videoSource: "youtube" | "tiktok" | "upload";
  /** Optional banner rendered below the header (e.g. session-only warning) */
  banner?: React.ReactNode;
}

export default function PracticeView({ videoUrl, videoId, videoTitle, videoSource, banner }: PracticeViewProps) {
  const router = useRouter();
  const [currentTab,    setCurrentTab]    = useState<TabId>("trace");
  const [completedTabs, setCompletedTabs] = useState<TabId[]>([]);
  const [sessionId,     setSessionId]     = useState("");
  const [traceTimeSeconds, setTraceTimeSeconds] = useState(0);

  const [calibrated,      setCalibrated]      = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationData | null>(null);

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
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      {/* Calibration modal */}
      {!calibrated && videoUrl && (
        <CalibrationModal videoUrl={videoUrl} onCalibrated={handleCalibrated} onSkip={handleCalibrationSkip} />
      )}

      {/* ── Floating header bar ──────────────────────────────────── */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 px-3 py-3">
        <div className="flex items-center justify-between">
          {/* Back + title */}
          <div className="pointer-events-auto flex items-center gap-3">
            <Link href="/dashboard" className="flex h-8 items-center gap-1.5 rounded-full bg-black/60 px-3 text-[11px] font-semibold text-white/60 backdrop-blur-xl border border-white/[0.08] transition-all hover:text-white hover:bg-black/80">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
              <span className="hidden sm:inline max-w-[160px] truncate">{videoTitle}</span>
            </Link>
          </div>

          {/* Logo badge */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex h-8 w-8 flex-col items-center justify-center rounded-full bg-black/60 backdrop-blur-xl border border-white/[0.08]">
              <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                <path d="M7 1L13 4.5V9.5L7 13L1 9.5V4.5L7 1Z" stroke="white" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7"/>
                <circle cx="7" cy="7" r="2" fill="white" opacity="0.7"/>
              </svg>
            </div>
          </div>
        </div>

        {/* Top dynamic island nav (centered) */}
        <div className="pointer-events-auto absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} completedTabs={completedTabs} />
        </div>
      </div>

      {/* Optional banner (session-only warning, etc.) */}
      {banner}

      {/* ── Tab content (full viewport) ──────────────────────────── */}
      <ErrorBoundary>
        {currentTab === "trace" && videoUrl && (
          <TraceTab videoUrl={videoUrl} onComplete={handleTraceComplete} initialFraming={calibrationData ?? undefined} />
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
