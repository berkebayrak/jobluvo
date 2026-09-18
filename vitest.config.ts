import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globalSetup: ["./vitest.globalSetup.ts"],
    setupFiles: ["./vitest.setup.ts"],
    reporters: ["default", "./vitest.reporter.ts"],
    /* The database backed tests share one connection pool; keep them in one worker. */
    fileParallelism: false,
    testTimeout: 30_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
