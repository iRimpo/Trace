import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  deleteVideo: vi.fn(),
  getResume: vi.fn(),
  getVideo: vi.fn(),
  listVideos: vi.fn(),
  push: vi.fn(),
  storeVideoSession: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
}));
vi.mock("@/lib/videoStore", async importOriginal => ({
  ...(await importOriginal<typeof import("@/lib/videoStore")>()),
  deleteVideo: mocks.deleteVideo,
  getResume: mocks.getResume,
  getVideo: mocks.getVideo,
  listVideos: mocks.listVideos,
}));
vi.mock("@/lib/sessionVideoStorage", () => ({
  storeVideoSession: mocks.storeVideoSession,
}));
vi.mock("@/lib/posthog", () => ({ track: vi.fn() }));

import DeviceVideos from "@/components/dashboard/DeviceVideos";

const savedVideo = {
  key: "file:saved-dance",
  fileName: "saved-dance.mp4",
  songName: "Saved dance",
  bytes: 4_194_304,
  lastUsedAt: 1_700_000_000_000,
};
const secondVideo = {
  key: "file:second-dance",
  fileName: "second-dance.mp4",
  songName: "Second dance",
  bytes: 2_097_152,
  lastUsedAt: 1_699_999_999_000,
};

describe("DeviceVideos deletion safeguard", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listVideos.mockResolvedValue([savedVideo]);
    mocks.getResume.mockResolvedValue(null);
    mocks.deleteVideo.mockResolvedValue(true);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function renderVideos() {
    await act(async () => {
      root.render(React.createElement(DeviceVideos));
    });
  }

  function button(label: string): HTMLButtonElement {
    const match = Array.from(container.querySelectorAll("button"))
      .find(candidate => candidate.getAttribute("aria-label") === label);
    expect(match, `expected a button named "${label}"`).toBeDefined();
    return match!;
  }

  it("requires a named second action and lets the dancer keep the video", async () => {
    await renderVideos();

    const remove = button("Remove Saved dance from this device");
    remove.focus();
    await act(async () => remove.click());

    expect(mocks.deleteVideo).not.toHaveBeenCalled();
    const confirm = button("Confirm remove Saved dance from this device");
    expect(document.activeElement).toBe(confirm);

    const keep = button("Keep Saved dance");
    keep.focus();
    await act(async () => keep.click());

    expect(mocks.deleteVideo).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button("Remove Saved dance from this device"));
    expect(button("Open Saved dance in practice")).toBeDefined();
    expect(container.querySelector('[aria-label="Confirm remove Saved dance from this device"]')).toBeNull();
  });

  it("keeps the tile until the selected video has finished deleting", async () => {
    let finishDelete!: (deleted: boolean) => void;
    mocks.deleteVideo.mockReturnValue(new Promise<boolean>(resolve => { finishDelete = resolve; }));
    await renderVideos();

    await act(async () => button("Remove Saved dance from this device").click());
    act(() => button("Confirm remove Saved dance from this device").click());

    expect(mocks.deleteVideo).toHaveBeenCalledOnce();
    expect(mocks.deleteVideo).toHaveBeenCalledWith(savedVideo.key);
    expect(button("Open Saved dance in practice")).toBeDefined();

    await act(async () => finishDelete(true));

    expect(container.querySelector('[aria-label="Open Saved dance in practice"]')).toBeNull();
  });

  it("serializes destructive work while another video is deleting", async () => {
    mocks.listVideos.mockResolvedValue([savedVideo, secondVideo]);
    let finishDelete!: (deleted: boolean) => void;
    mocks.deleteVideo.mockReturnValue(new Promise<boolean>(resolve => { finishDelete = resolve; }));
    await renderVideos();

    await act(async () => button("Remove Saved dance from this device").click());
    const confirm = button("Confirm remove Saved dance from this device");
    confirm.focus();
    act(() => confirm.click());

    expect(button("Remove Second dance from this device").disabled).toBe(true);
    expect(container.querySelector('[role="status"]')?.textContent)
      .toBe("Removing Saved dance from this device");
    button("Remove Second dance from this device").click();
    expect(mocks.deleteVideo).toHaveBeenCalledOnce();

    await act(async () => finishDelete(true));

    expect(document.activeElement).toBe(button("Open Second dance in practice"));
    expect(container.querySelector('[role="status"]')?.textContent)
      .toBe("Removed Saved dance from this device");
  });

  it("keeps the tile and exposes a retryable error when storage deletion fails", async () => {
    mocks.deleteVideo.mockResolvedValue(false);
    await renderVideos();

    await act(async () => button("Remove Saved dance from this device").click());
    await act(async () => button("Confirm remove Saved dance from this device").click());

    expect(button("Open Saved dance in practice")).toBeDefined();
    expect(button("Confirm remove Saved dance from this device").disabled).toBe(false);
    expect(container.querySelector('[role="alert"]')?.textContent)
      .toContain("Couldn’t remove Saved dance. Try again.");
  });
});
