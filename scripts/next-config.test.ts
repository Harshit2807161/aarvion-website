import { expect, it } from "vitest";
import config from "../next.config.ts";

// Cache Components with Partial Prefetching, as the Next 16 docs recommend for new apps (unset
// logs a warning on every build); image qualities listed so 70 and 85 are not coerced to 75 [C10].
it("pins the Next config", () => {
  expect(config).toEqual({
    cacheComponents: true,
    partialPrefetching: true,
    images: { formats: ["image/avif", "image/webp"], qualities: [70, 75, 85] },
  });
});
