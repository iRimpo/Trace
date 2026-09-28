import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: () => null }),
}));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: {
      email: "dancer@example.com",
      user_metadata: { full_name: "Avery Dancer" },
    },
  }),
}));
vi.mock("@/components/dashboard/DeviceVideos", () => ({ default: () => null }));
vi.mock("@/components/dashboard/SongCard", () => ({ default: () => null }));

import DashboardPage from "@/app/dashboard/page";

describe("dashboard tutorial help", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    const stored = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => stored.clear(),
      getItem: (key: string) => stored.get(key) ?? null,
      removeItem: (key: string) => stored.delete(key),
      setItem: (key: string, value: string) => stored.set(key, value),
      get length() { return stored.size; },
      key: (index: number) => Array.from(stored.keys())[index] ?? null,
    });
    localStorage.setItem("trace_onboarding_v1_done", "1");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    if (root) await act(async () => root.unmount());
    container?.remove();
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("reopens the real onboarding dialog from a named dashboard control", async () => {
    await act(async () => root.render(React.createElement(DashboardPage)));

    const launcher = container.querySelector<HTMLButtonElement>('button[aria-label="How Trace works"]');
    expect(launcher, "the dashboard should expose its promised onboarding entry").not.toBeNull();

    await act(async () => launcher!.click());

    expect(container.querySelector('[role="dialog"][aria-label="How Trace works"]')).not.toBeNull();
  });
});
