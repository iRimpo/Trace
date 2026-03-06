/**
 * Client-side analytics helper. Sends events to /api/events which stores in product_events.
 */
export function track(
  eventName: string,
  properties?: Record<string, unknown>,
  options?: { source?: string; sessionId?: string }
) {
  if (typeof window === "undefined") return;

  fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      eventName,
      properties: properties ?? {},
      source: options?.source ?? "web",
      sessionId: options?.sessionId ?? undefined,
    }),
  }).catch(() => {
    // Fire-and-forget; don't block UX
  });
}
