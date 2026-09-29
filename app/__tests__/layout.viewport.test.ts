import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => {
  const font = () => ({ variable: "--font-test" });

  return {
    Calistoga: font,
    DM_Sans: font,
    Inter: font,
    Nunito: font,
    Outfit: font,
    Plus_Jakarta_Sans: font,
    Raleway: font,
    Space_Mono: font,
  };
});

import { viewport } from "@/app/layout";

describe("root viewport accessibility", () => {
  it("keeps browser zoom available while preserving safe-area layout", () => {
    expect(viewport.viewportFit).toBe("cover");
    expect(viewport.userScalable).not.toBe(false);

    if (typeof viewport.maximumScale === "number") {
      expect(viewport.maximumScale).toBeGreaterThanOrEqual(2);
    }
  });
});
