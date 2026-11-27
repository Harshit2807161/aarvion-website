import type { Page } from "@playwright/test";

/** Slow 4G plus a 4x slower CPU, over CDP (Chromium only): the plan's mobile budget conditions. */
export async function emulateMobile(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: 204_800,
    uploadThroughput: 96_000,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

export type Lcp = { ms: number; tag: string; lazy: boolean; src: string };

/** The page's final largest-contentful-paint entry. Call after `load`. */
export async function measureLcp(page: Page): Promise<Lcp> {
  return page.evaluate(
    () =>
      new Promise<{ ms: number; tag: string; lazy: boolean; src: string }>((resolve) => {
        const read = (list: PerformanceObserverEntryList) => {
          const entry = list.getEntries().at(-1) as
            (PerformanceEntry & { element?: Element | null; url?: string }) | undefined;
          if (!entry) return;
          const el = entry.element as HTMLImageElement | null | undefined;
          resolve({
            ms: entry.startTime,
            tag: el?.tagName ?? "",
            lazy: el?.getAttribute("loading") === "lazy",
            src: entry.url ?? "",
          });
        };
        new PerformanceObserver((list, observer) => {
          read(list);
          observer.disconnect();
        }).observe({ type: "largest-contentful-paint", buffered: true });
        // No LCP entry means a broken page: fail the assertions, do not hang to the test timeout.
        setTimeout(
          () => resolve({ ms: Number.POSITIVE_INFINITY, tag: "", lazy: false, src: "" }),
          3000,
        );
      }),
  );
}

/** Start counting layout shifts that no input caused; read the total with `readCls`. */
export async function watchCls(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __cls: number };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & {
        hadRecentInput: boolean;
        value: number;
      })[]) {
        if (!e.hadRecentInput) w.__cls += e.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

export const readCls = (page: Page): Promise<number> =>
  page.evaluate(() => (window as unknown as { __cls: number }).__cls);

/** The encoded body size in bytes of each resource whose URL matches `filter`. */
export async function resourceBytes(
  page: Page,
  filter: RegExp,
): Promise<{ url: string; bytes: number }[]> {
  const source = filter.source;
  const flags = filter.flags;
  return page.evaluate(
    ([src, fl]) => {
      const re = new RegExp(src, fl);
      return performance
        .getEntriesByType("resource")
        .filter((e) => re.test(e.name))
        .map((e) => ({ url: e.name, bytes: (e as PerformanceResourceTiming).encodedBodySize }));
    },
    [source, flags] as const,
  );
}

/**
 * First-load JS as transferred: the encoded (compressed) body size of every script the page
 * fetched, from Resource Timing (same-origin, so the sizes are exposed). Never `content-length`:
 * Next streams compressed chunks without it.
 */
export async function scriptBytes(page: Page): Promise<{ total: number; count: number }> {
  return page.evaluate(() => {
    const scripts = performance
      .getEntriesByType("resource")
      .filter(
        (e) =>
          (e as PerformanceResourceTiming).initiatorType === "script" || /\.js(\?|$)/.test(e.name),
      );
    const total = scripts.reduce((a, e) => a + (e as PerformanceResourceTiming).encodedBodySize, 0);
    return { total, count: scripts.length };
  });
}
