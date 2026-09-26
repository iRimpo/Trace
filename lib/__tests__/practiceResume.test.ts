import { describe, expect, it } from "vitest";
import type { ResumeState } from "../videoStore";
import * as videoStore from "../videoStore";

type Restorable = ResumeState & Required<Pick<ResumeState,
  "trimStart" | "trimEnd" | "loopStart" | "loopEnd" |
  "offsetXNorm" | "offsetYNorm" | "zoom" | "solo"
>>;

const api = videoStore as typeof videoStore & {
  restorableResume?: (state: ResumeState | null) => Restorable | null;
  resumeSnapshotWhenReady?: (
    ready: boolean,
    state: Omit<ResumeState, "updatedAt">,
  ) => Omit<ResumeState, "updatedAt"> | null;
};

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

describe("practice resume restoration", () => {
  it("restores every section, framing, and dancer field (catches dropped-field restoration)", () => {
    expect(api.restorableResume?.(completeResume)).toEqual(completeResume);
  });

  it.each([
    null,
    { ...completeResume, offsetXNorm: undefined },
    { ...completeResume, loopEnd: 19 },
    { ...completeResume, zoom: Number.NaN },
    { ...completeResume, personCenter: { x: 4, y: 0.46 } },
  ])("keeps calibration for missing or corrupt state %# (catches permissive resume validation)", state => {
    expect(api.restorableResume?.(state)).toBeNull();
  });

  it("blocks persistence until restoration finishes (catches the empty-write mount race)", () => {
    const { updatedAt: _updatedAt, ...snapshot } = completeResume;

    expect(api.resumeSnapshotWhenReady?.(false, snapshot)).toBeNull();
    expect(api.resumeSnapshotWhenReady?.(true, snapshot)).toEqual(snapshot);
  });
});
