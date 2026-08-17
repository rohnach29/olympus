import { defineConfig } from "vitest/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Same "@/" alias Next uses, so the modules under test import idiomatically.
    alias: { "@": path.resolve(path.dirname(fileURLToPath(import.meta.url)), "src") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
