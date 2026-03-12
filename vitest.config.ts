import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 120_000,
    pool: "forks",
    include: [
      "src/**/*.test.ts",
      "packages/deepscholar-contracts/src/**/*.test.ts",
      "services/**/*.test.ts",
    ],
    exclude: [
      "dist/**",
      "**/node_modules/**",
      "**/vendor/**",
      "**/*.e2e.test.ts",
      "**/*.live.test.ts",
    ],
  },
});

