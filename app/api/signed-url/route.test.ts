import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getUser = vi.fn();
  const getSession = vi.fn();
  const createSignedUrl = vi.fn();
  const from = vi.fn(() => ({ createSignedUrl }));
  const cookieGet = vi.fn();
  const cookieSet = vi.fn();

  return {
    getUser,
    getSession,
    createSignedUrl,
    from,
    cookieGet,
    cookieSet,
    createServerClient: vi.fn(() => ({
      auth: { getUser, getSession },
      storage: { from },
    })),
    cookies: vi.fn(() => ({ get: cookieGet, set: cookieSet })),
  };
});

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}));

import { POST } from "./route";

const authenticatedUser = {
  id: "returning-user",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: "2026-09-01T12:00:00.000Z",
};

function postRequest(path: unknown) {
  return new Request("http://localhost/api/signed-url", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path }),
  });
}

describe("POST /api/signed-url", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: authenticatedUser },
      error: null,
    });
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: "untrusted-access-token",
          refresh_token: "untrusted-refresh-token",
          expires_in: 3600,
          expires_at: 1_800_000_000,
          token_type: "bearer",
          user: authenticatedUser,
        },
      },
      error: null,
    });
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed-video" },
      error: null,
    });
  });

  it("returns 401 on an authentication error before reading the body or storage", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { name: "AuthApiError", message: "invalid token", status: 401 },
    });
    const request = postRequest("returning-user/legacy/video.mp4");
    const readBody = vi.spyOn(request, "json");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(readBody).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 401 when server validation finds no user before reading the body or storage", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const request = postRequest("returning-user/legacy/video.mp4");
    const readBody = vi.spyOn(request, "json");

    const response = await POST(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Unauthorized" });
    expect(readBody).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 400 for an empty path without using storage", async () => {
    const response = await POST(postRequest("   "));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No path provided" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 403 for a traversal path without using storage", async () => {
    const response = await POST(
      postRequest("returning-user/legacy/../other-user/video.mp4")
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 403 for another user's namespace without using storage", async () => {
    const response = await POST(postRequest("other-user/legacy/video.mp4"));

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("normalizes and signs an owned legacy video path for one hour", async () => {
    const response = await POST(
      postRequest("  returning-user//legacy///video.mp4  ")
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://storage.example/signed-video",
    });
    expect(mocks.from).toHaveBeenCalledWith("dance-videos");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "returning-user/legacy/video.mp4",
      3600
    );
  });
});
