import { defineConfig, type Project } from "@playwright/test"

/**
 * AD-23 / UX-DR58: every UI change is verified on this matrix in light and dark.
 * Viewports are CSS pixels; DPR matches the physical device.
 */
export const DEVICE_MATRIX = [
  { name: "galaxy-s24", browserName: "chromium", viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "redmi-note-13", browserName: "chromium", viewport: { width: 360, height: 800 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "pixel-8", browserName: "chromium", viewport: { width: 412, height: 870 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
  { name: "iphone-15-pro", browserName: "webkit", viewport: { width: 393, height: 852 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  { name: "tablet", browserName: "chromium", viewport: { width: 768, height: 1024 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { name: "desktop", browserName: "chromium", viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
] as const

export const COLOR_SCHEMES = ["light", "dark"] as const

const projects: Project[] = DEVICE_MATRIX.flatMap((device) =>
  COLOR_SCHEMES.map((colorScheme) => ({
    name: `${device.name}-${colorScheme}`,
    use: {
      browserName: device.browserName,
      viewport: device.viewport,
      deviceScaleFactor: device.deviceScaleFactor,
      isMobile: device.isMobile,
      hasTouch: device.hasTouch,
      colorScheme,
      timezoneId: "UTC",
      locale: "en-GB",
    },
  })),
)

const port = 4173
const isCi = Boolean(process.env.CI)

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 1 : 0,
  reporter: isCi ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
  },
  projects,
  webServer: {
    // Serves the production build (run `npm run build` first; `npm run ci` does).
    command: `npx vite preview --port ${port} --strictPort`,
    url: `http://localhost:${port}`,
    reuseExistingServer: !isCi,
    timeout: 60_000,
  },
})
