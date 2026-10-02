import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config.ts"

// AD-31: tests run in UTC (time-sensitive suites add one explicit Asia/Karachi case).
process.env.TZ = "UTC"

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: false,
      setupFiles: ["./src/test/setup.ts"],
      include: ["src/**/*.test.{ts,tsx}", "tests/**/*.test.ts"],
      env: { TZ: "UTC" },
      restoreMocks: true,
    },
  }),
)
