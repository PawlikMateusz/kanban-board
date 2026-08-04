import { defineConfig, devices } from "@playwright/test"

const VITE_PORT = process.env.VITE_PORT || "5174"
const BASE_URL = `http://localhost:${VITE_PORT}`
const PB_TEST_URL = process.env.PB_TEST_URL || "http://localhost:8091"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      PORT: VITE_PORT,
      PB_PROXY_TARGET: PB_TEST_URL,
    },
  },
})
