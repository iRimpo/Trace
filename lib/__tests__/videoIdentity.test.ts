import { describe, it, expect } from "vitest";
import { parseLinkIdentity, fileIdentity, identityKey, parseIdentityKey } from "../videoIdentity";

describe("parseLinkIdentity", () => {
  it("parses youtube watch URLs", () => {
    expect(parseLinkIdentity("https://www.youtube.com/watch?v=dQw4w9WgXcQ"))
      .toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
  });
  it("parses youtu.be short links", () => {
    expect(parseLinkIdentity("https://youtu.be/dQw4w9WgXcQ?t=10"))
      .toEqual({ kind: "youtube", id: "dQw4w9WgXcQ" });
  });
  it("parses youtube shorts", () => {
    expect(parseLinkIdentity("https://www.youtube.com/shorts/abc123DEF45"))
      .toEqual({ kind: "youtube", id: "abc123DEF45" });
  });
  it("parses tiktok video URLs", () => {
    expect(parseLinkIdentity("https://www.tiktok.com/@dancer/video/7301234567890123456"))
      .toEqual({ kind: "tiktok", id: "7301234567890123456" });
  });
  it("returns null for unrecognized URLs", () => {
    expect(parseLinkIdentity("https://vm.tiktok.com/ZM123/")).toBeNull();
    expect(parseLinkIdentity("not a url")).toBeNull();
    expect(parseLinkIdentity("https://example.com/watch?v=x")).toBeNull();
  });
});

describe("fileIdentity", () => {
  it("hashes blob bytes with SHA-256", async () => {
    const id = await fileIdentity(new Blob(["abc"]));
    expect(id).toEqual({
      kind: "file",
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    });
  });
});

describe("identityKey", () => {
  it("formats keys per kind", () => {
    expect(identityKey({ kind: "youtube", id: "x1" })).toBe("youtube:x1");
    expect(identityKey({ kind: "tiktok", id: "99" })).toBe("tiktok:99");
    expect(identityKey({ kind: "file", sha256: "deadbeef" })).toBe("file:deadbeef");
  });
});

describe("parseIdentityKey", () => {
  it("round-trips every kind", () => {
    for (const v of [
      { kind: "youtube", id: "x1" },
      { kind: "tiktok", id: "99" },
      { kind: "file", sha256: "deadbeef" },
    ] as const) {
      expect(parseIdentityKey(identityKey(v))).toEqual(v);
    }
  });
  it("rejects malformed keys", () => {
    expect(parseIdentityKey("nonsense")).toBeNull();
    expect(parseIdentityKey("vimeo:123")).toBeNull();
    expect(parseIdentityKey("file:")).toBeNull();
  });
});
