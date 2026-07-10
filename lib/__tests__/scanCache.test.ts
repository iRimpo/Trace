import { describe, it, expect, vi, beforeEach } from "vitest";
import { cacheRowKey, getCachedTimeline, putCachedTimeline } from "../scanCache";
import { SCAN_VERSION, type ChoreoTimeline } from "../choreoTimeline";

// ── Supabase stub ─────────────────────────────────────────────────────────
const state: {
  rows: Record<string, unknown>[];
  inserted: Record<string, unknown>[];
  user: { id: string } | null;
} = { rows: [], inserted: [], user: { id: "user-1" } };

vi.mock("../supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: state.user } }) },
    from: (table: string) => {
      expect(table).toBe("scan_cache");
      const filters: Record<string, unknown> = {};
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => { filters[col] = val; return chain; },
        limit: () => chain,
        maybeSingle: async () => {
          const hit = state.rows.find(r =>
            Object.entries(filters).every(([k, v]) => r[k] === v));
          return { data: hit ?? null, error: null };
        },
        insert: async (row: Record<string, unknown>) => {
          state.inserted.push(row);
          return { error: null };
        },
      };
      return chain;
    },
  },
}));

const timeline: ChoreoTimeline = {
  version: SCAN_VERSION, bpm: 120, beatOneOffset: 0, videoHeight: 720, entries: [],
};

beforeEach(() => { state.rows = []; state.inserted = []; state.user = { id: "user-1" }; });

describe("cacheRowKey", () => {
  it("rounds segment bounds to 0.1s and stamps the scan version", () => {
    const key = cacheRowKey({
      identity: { kind: "youtube", id: "abc" },
      segmentStart: 1.2345, segmentEnd: 30.078,
    });
    expect(key).toEqual({
      video_identity: "youtube:abc",
      segment_start: 1.2,
      segment_end: 30.1,
      scan_version: SCAN_VERSION,
    });
  });
});

describe("getCachedTimeline", () => {
  it("returns the timeline on a cache hit", async () => {
    state.rows.push({
      video_identity: "youtube:abc", segment_start: 0, segment_end: 30,
      scan_version: SCAN_VERSION, timeline,
    });
    const got = await getCachedTimeline({
      identity: { kind: "youtube", id: "abc" }, segmentStart: 0, segmentEnd: 30,
    });
    expect(got).toEqual(timeline);
  });

  it("returns null on miss", async () => {
    const got = await getCachedTimeline({
      identity: { kind: "youtube", id: "missing" }, segmentStart: 0, segmentEnd: 30,
    });
    expect(got).toBeNull();
  });
});

describe("putCachedTimeline", () => {
  it("inserts shared row (owner null) for link videos", async () => {
    await putCachedTimeline(
      { identity: { kind: "youtube", id: "abc" }, segmentStart: 0, segmentEnd: 30 },
      timeline, false,
    );
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).toMatchObject({
      video_identity: "youtube:abc", is_upload: false, owner_id: null,
    });
  });

  it("inserts owner-scoped row for uploads", async () => {
    await putCachedTimeline(
      { identity: { kind: "file", sha256: "ff" }, segmentStart: 0, segmentEnd: 15 },
      timeline, true,
    );
    expect(state.inserted[0]).toMatchObject({
      video_identity: "file:ff", is_upload: true, owner_id: "user-1",
    });
  });

  it("swallows errors (best-effort put)", async () => {
    state.user = null; // upload put with no user would be invalid — must not throw
    await expect(putCachedTimeline(
      { identity: { kind: "file", sha256: "ee" }, segmentStart: 0, segmentEnd: 15 },
      timeline, true,
    )).resolves.toBeUndefined();
    expect(state.inserted).toHaveLength(0);
  });
});
