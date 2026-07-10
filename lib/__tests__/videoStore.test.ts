import "fake-indexeddb/auto";
import { describe, it, expect, beforeEach } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import {
  putVideo, getVideo, listVideos, deleteVideo, evictionCandidates, idbAvailable,
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
