import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: { baseURL: `http://localhost:${PORT}`, trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { browserName: "chromium" } }],
  webServer: {
    command: "pnpm build && pnpm start",
    url: `http://localhost:${PORT}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    env: {
      PORT: String(PORT),
      MONGODB_URI:
        process.env.MONGODB_URI ??
        "mongodb://localhost:27017/?replicaSet=rs0&directConnection=true",
      MONGODB_DB: "aarvion_e2e",
      OTP_PEPPER: randomBytes(32).toString("hex"),
      ALLOW_MOCKS_IN_PROD_BUILD: "1",
    },
  },
});
