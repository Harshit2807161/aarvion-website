import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));

import { resetEnvForTests } from "@/server/env";
import { generateMetadata } from "./layout";

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvForTests();
});

describe("root layout metadata", () => {
  it("sets metadataBase from APP_URL so opengraph-image is not localhost", async () => {
    vi.stubEnv("APP_URL", "https://aarvion.example");
    resetEnvForTests();
    const md = await generateMetadata();
    expect((md.metadataBase as URL).origin).toBe("https://aarvion.example");
  });

  it("still sets metadataBase when APP_URL is unset", async () => {
    vi.stubEnv("APP_URL", "");
    resetEnvForTests();
    expect((await generateMetadata()).metadataBase).toBeInstanceOf(URL);
  });
});
