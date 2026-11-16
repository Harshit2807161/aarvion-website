import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "happy-dom",
          include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "int",
          environment: "node",
          include: ["tests/int/**/*.test.ts"],
          globalSetup: ["tests/helpers/global-setup.ts"],
          testTimeout: 30_000,
          hookTimeout: 180_000,
        },
      },
    ],
  },
});
