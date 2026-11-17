import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/**
 * Integration tests: real PostgreSQL via `TEST_DATABASE_URL` (falls back to `DATABASE_URL`).
 * Every file resets the schema and re-applies migrations, so files run sequentially and the
 * target database is wiped — never point this at a database you care about.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@insta/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/integration/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
