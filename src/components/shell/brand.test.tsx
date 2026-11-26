import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Brand } from "./brand";

describe("Brand", () => {
  it("lazy-loads the footer logo, so React never preloads it ahead of the page's LCP image", () => {
    const html = renderToString(<Brand />);
    expect(html).toContain('loading="lazy"');
    expect(html).not.toContain('rel="preload"');
  });

  it("keeps the header logo eager: it is above the fold", () => {
    expect(renderToString(<Brand placement="header" />)).not.toContain('loading="lazy"');
  });
});
