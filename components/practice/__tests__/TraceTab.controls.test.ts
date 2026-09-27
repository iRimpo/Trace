import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import TraceTab from "@/components/practice/TraceTab";

function renderControls(): HTMLDivElement {
  const container = document.createElement("div");
  container.innerHTML = renderToStaticMarkup(
    React.createElement(TraceTab, { videoUrl: "blob:reference-video" }),
  );
  return container;
}

function namedButton(container: ParentNode, name: string): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
  expect(button, `${name} should be a native named button`).not.toBeNull();
  return button!;
}

describe("TraceTab stage controls", () => {
  it("names toggle controls and exposes their current state", () => {
    const container = renderControls();

    expect(namedButton(container, "Auto-align reference").disabled).toBe(false);
    expect(namedButton(container, "Show keyboard shortcuts").getAttribute("aria-expanded")).toBe("false");
    expect(namedButton(container, "Enter fullscreen")).toBeTruthy();
    expect(namedButton(container, "Open tools").getAttribute("aria-expanded")).toBe("false");
    expect(namedButton(container, "Hide controls")).toBeTruthy();
  });

  it("keeps every evidenced target at least 44px with a visible focus style", () => {
    const container = renderControls();
    const squareControls = [
      "Auto-align reference",
      "Show keyboard shortcuts",
      "Enter fullscreen",
      "Open tools",
    ].map(name => namedButton(container, name));

    for (const button of squareControls) {
      expect(button.className).toContain("h-11");
      expect(button.className).toContain("w-11");
      expect(button.className).not.toMatch(/sm:h-8|sm:w-8/);
      expect(button.className).toContain("focus-visible:ring-2");
    }

    const hide = namedButton(container, "Hide controls");
    expect(hide.className).toContain("min-h-11");
    expect(hide.className).toContain("focus-visible:ring-2");
  });
});
