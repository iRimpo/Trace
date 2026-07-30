/**
 * VERIFIER CONFIG — READ ONLY to the improvement loop's agent.
 *
 * Deliberately separate from the project's vitest.config.ts. verify.sh invokes
 * this file by explicit path, so editing the project config cannot remove the
 * property suite from the run.
 */
import { defineConfig } from "vitest/config";
import path from "path";

const root = path.resolve(__dirname, "..");

export default defineConfig({
  resolve: { alias: { "@": root } },
  test: {
    root,
    environment: "jsdom",
    include: ["loop/properties/**/*.props.test.ts"],
    // A high LOOP_RUNS is the point of the ratchet; vitest's 5s default
    // cap turned 20000 runs into nine timeouts that looked like findings.
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
});
