import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeState } from "@/lib/videoStore";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  getResume: vi.fn(),
  saveResume: vi.fn(),
  traceTab: vi.fn((props: Record<string, unknown>) => { void props; return null; }),
  calibration: vi.fn((props: Record<string, unknown>) => { void props; return null; }),
}));

vi.mock("@/lib/videoStore", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/videoStore")>()),
  getResume: mocks.getResume,
  saveResume: mocks.saveResume,
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("next/link", () => ({ default: (props: Record<string, unknown>) =>
  React.createElement("a", props) }));
vi.mock("@/components/practice/TraceTab", () => ({ default: mocks.traceTab }));
vi.mock("@/components/practice/CalibrationModal", () => ({ default: mocks.calibration }));
vi.mock("@/components/practice/TestTab", () => ({ default: () => null }));
vi.mock("@/components/practice/SyncTab", () => ({ default: () => null }));
vi.mock("@/components/practice/TabNavigation", () => ({ default: () => null }));
vi.mock("@/components/practice/InstallGate", () => ({ default: () => null }));
vi.mock("@/components/ErrorBoundary", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@/lib/useWakeLock", () => ({ useWakeLock: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ track: vi.fn() }));
vi.mock("@/lib/feedback", () => ({
  unlockAudio: vi.fn(), isMuted: () => false, setMuted: vi.fn(),
}));
vi.mock("@/lib/videoIdentity", () => ({
  parseIdentityKey: () => ({ source: "file", id: "saved-video" }),
}));

import PracticeView from "@/components/practice/PracticeView";

const completeResume: ResumeState = {
  trimStart: 12,
  trimEnd: 52,
  loopStart: 20,
  loopEnd: 28,
  offsetXNorm: -0.125,
  offsetYNorm: 0.08,
  zoom: 1.45,
  personCenter: { x: 0.72, y: 0.46 },
  solo: false,
  updatedAt: 1_700_000_000_000,
};

describe("PracticeView saved-session gate", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  function renderPractice() {
    root.render(React.createElement(PracticeView, {
      videoUrl: "blob:saved-video",
      videoId: null,
      videoTitle: "Saved dance",
      videoSource: "upload",
      identityKey: "file:saved-video",
    }));
  }

  it("mounts neither practice nor persistence while the resume read is pending", async () => {
    mocks.getResume.mockReturnValue(new Promise<ResumeState>(() => undefined));

    await act(async () => renderPractice());

    expect(mocks.traceTab).not.toHaveBeenCalled();
    expect(mocks.saveResume).not.toHaveBeenCalled();
    expect(mocks.calibration).not.toHaveBeenCalled();
  });

  it("passes the complete saved setup to TraceTab before persistence can begin", async () => {
    mocks.getResume.mockResolvedValue(completeResume);

    await act(async () => renderPractice());

    expect(mocks.traceTab).toHaveBeenCalledOnce();
    const props = mocks.traceTab.mock.calls[0][0];
    expect(props.initialFraming).toEqual(completeResume);
    expect(props.initialResume).toEqual(completeResume);
    expect(mocks.saveResume).not.toHaveBeenCalled();
  });

  it("opens calibration for a corrupt saved record", async () => {
    mocks.getResume.mockResolvedValue({ ...completeResume, zoom: Number.NaN });

    await act(async () => renderPractice());

    expect(mocks.calibration).toHaveBeenCalledOnce();
    expect(mocks.traceTab).not.toHaveBeenCalled();
  });

  it("keeps an explicit recalibration path after automatic resume", async () => {
    mocks.getResume.mockResolvedValue(completeResume);
    await act(async () => renderPractice());

    const button = container.querySelector<HTMLButtonElement>("button[aria-label='Recalibrate video']");
    expect(button).not.toBeNull();
    await act(async () => button!.click());

    expect(mocks.calibration).toHaveBeenCalledOnce();
  });
});
