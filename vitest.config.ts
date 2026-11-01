import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    // Database-backed suites share one disposable database. Keep suites
    // sequential to avoid cross-suite SSI conflicts; concurrency behavior is
    // exercised explicitly within the relevant suites.
    fileParallelism: false,
  },
});
