import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

/** Unit tests: domain, mappers, adapters and the HTTP platform with fake ports (no database). */
export default defineConfig({
  resolve: {
    alias: {
      "@insta/contracts": fileURLToPath(new URL("../../packages/contracts/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/unit/**/*.test.ts"],
    environment: "node",
    testTimeout: 15_000,
  },
});
