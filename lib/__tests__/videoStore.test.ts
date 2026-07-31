import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  putVideo, getVideo, listVideos, deleteVideo, evictionCandidates, idbAvailable,
  saveResume, getResume, clearResume,
} from "../videoStore";

beforeEach(() => {
  // Fresh DB per test
  (globalThis as Record<string, unknown>).indexedDB = new IDBFactory();
});

const sample = (key: string, content = "video-bytes") => ({
  key,
  blob: new Blob([content], { type: "video/mp4" }),
  fileName: `${key}.mp4`,
  songName: `Song ${key}`,
});

describe("videoStore", () => {
  it("reports availability", () => {
    expect(idbAvailable()).toBe(true);
  });

  it("round-trips a video with metadata and byte size", async () => {
    await putVideo(sample("file:aaa", "hello"));
    const got = await getVideo("file:aaa");
    expect(got).not.toBeNull();
    expect(got!.fileName).toBe("file:aaa.mp4");
    expect(got!.songName).toBe("Song file:aaa");
    expect(got!.bytes).toBe(5);
    expect(await got!.blob.text()).toBe("hello");
  });

  it("returns null for missing keys", async () => {
    expect(await getVideo("nope")).toBeNull();
  });

  it("bumps lastUsedAt on get", async () => {
    await putVideo(sample("k1"));
    const first = (await getVideo("k1"))!.lastUsedAt;
    await new Promise(r => setTimeout(r, 10));
    const second = (await getVideo("k1"))!.lastUsedAt;
    expect(second).toBeGreaterThan(first);
  });

  it("lists metadata only, most recently used first", async () => {
    await putVideo(sample("old"));
    await new Promise(r => setTimeout(r, 10));
    await putVideo(sample("new"));
    await new Promise(r => setTimeout(r, 10));
    await getVideo("old"); // bump old → now most recent
    const list = await listVideos();
    expect(list.map(v => v.key)).toEqual(["old", "new"]);
    expect((list[0] as Record<string, unknown>).blob).toBeUndefined();
  });

  it("deletes videos", async () => {
    await putVideo(sample("gone"));
    await deleteVideo("gone");
    expect(await getVideo("gone")).toBeNull();
  });

  it("returns LRU eviction candidates above the byte budget", async () => {
    await putVideo(sample("lru-old", "x".repeat(60)));
    await new Promise(r => setTimeout(r, 10));
    await putVideo(sample("lru-new", "y".repeat(60)));
    // Budget 100 bytes, total 120 → oldest (lru-old) should be offered
    const cands = await evictionCandidates(100);
    expect(cands.map(c => c.key)).toEqual(["lru-old"]);
    // Generous budget → nothing to evict
    expect(await evictionCandidates(1000)).toEqual([]);
  });
});

// ── Resume state ───────────────────────────────────────────────────────────

describe("resume state", () => {
  it("round-trips a section", async () => {
    await saveResume("k1", {
      trimStart: 12.5, trimEnd: 48,
      loopStart: 20, loopEnd: 28,
      offsetXNorm: -0.1, offsetYNorm: 0.05, zoom: 1.4,
      solo: true,
    });
    const got = await getResume("k1");
    expect(got).toMatchObject({
      trimStart: 12.5, trimEnd: 48, loopStart: 20, loopEnd: 28, zoom: 1.4, solo: true,
    });
    expect(got!.updatedAt).toBeGreaterThan(0);
  });

  it("returns null for a key that was never saved", async () => {
    expect(await getResume("nope")).toBeNull();
  });

  it("overwrites rather than accumulating", async () => {
    await saveResume("k1", { loopStart: 1, loopEnd: 2 });
    await saveResume("k1", { loopStart: 9, loopEnd: 10 });
    const got = await getResume("k1");
    expect(got).toMatchObject({ loopStart: 9, loopEnd: 10 });
  });

  it("clears", async () => {
    await saveResume("k1", { loopStart: 1, loopEnd: 2 });
    await clearResume("k1");
    expect(await getResume("k1")).toBeNull();
  });

  it("does not disturb the stored video, and survives beside it", async () => {
    // The whole reason resume has its own object store: saving it must not
    // touch the record holding the video bytes.
    await putVideo(sample("k1"));
    await saveResume("k1", { loopStart: 3, loopEnd: 4 });
    const v = await getVideo("k1");
    expect(v).not.toBeNull();
    expect(await v!.blob.text()).toBe("video-bytes");
    expect(await getResume("k1")).toMatchObject({ loopStart: 3, loopEnd: 4 });
  });

  it("ignores an empty key rather than writing a junk row", async () => {
    await saveResume("", { loopStart: 1 });
    expect(await getResume("")).toBeNull();
  });
});
