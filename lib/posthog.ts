import posthog from "posthog-js";

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

let initialized = false;

export function initPostHog() {
  if (typeof window === "undefined" || initialized || !POSTHOG_KEY) return;
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    capture_pageview: true,
    capture_pageleave: true,
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

export function identify(userId: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.identify(userId, properties);
}

export function resetIdentity() {
  if (!POSTHOG_KEY) return;
  posthog.reset();
}

export function track(event: string, properties?: Record<string, unknown>) {
  if (!POSTHOG_KEY) return;
  posthog.capture(event, properties);
}

export { posthog };
