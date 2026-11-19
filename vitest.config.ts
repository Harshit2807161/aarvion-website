import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const alias = { "@": fileURLToPath(new URL("./src", import.meta.url)) };

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.ts"],
        },
      },
      {
        plugins: [react()],
        resolve: { alias },
        test: {
          name: "ui",
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          exclude: ["**/node_modules/**"],
          setupFiles: ["tests/helpers/ui-setup.ts"],
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
