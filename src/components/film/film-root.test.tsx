import { act } from "react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FILM_FLAG_SCRIPT, FilmRoot } from "./film-root";

const page = (
  <FilmRoot>
    <section data-act="pin" id="how">
      <div className="stage" />
    </section>
  </FilmRoot>
);

let motion = true;

beforeEach(() => {
  motion = true;
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: q.includes("no-preference") ? motion : false,
    addEventListener() {},
    removeEventListener() {},
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  window.scrollTo = vi.fn() as never;
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("FilmRoot", () => {
  it("renders the complete home root on the server, with no film class and the flag script first", () => {
    const html = renderToString(page);
    const host = document.createElement("div");
    host.innerHTML = html;
    const home = host.querySelector("main#home.home.film-root")!;
    expect(home.classList.contains("film")).toBe(false);
    expect(home.firstElementChild?.tagName).toBe("SCRIPT");
    expect(home.firstElementChild?.textContent).toBe(FILM_FLAG_SCRIPT);
    expect(home.querySelector("section#how > .stage")).not.toBeNull();
  });

  it("adds film to #home when the flag script runs with motion allowed, and not under reduced motion", () => {
    for (const allowed of [true, false]) {
      motion = allowed;
      document.body.innerHTML = renderToString(page);
      new Function(FILM_FLAG_SCRIPT)();
      expect(document.getElementById("home")!.classList.contains("film")).toBe(allowed);
    }
  });

  it("hydrates the film-flagged server HTML without a recoverable error and keeps film", async () => {
    document.body.innerHTML = `<div id="root">${renderToString(page)}</div>`;
    new Function(FILM_FLAG_SCRIPT)();
    const errors: unknown[] = [];
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(document.getElementById("root")!, page, {
        onRecoverableError: (e) => errors.push(e),
      });
    });
    expect(errors).toEqual([]);
    expect(logged.mock.calls.filter((c) => /hydrat/i.test(String(c[0])))).toEqual([]);
    expect(document.getElementById("home")!.classList.contains("film")).toBe(true);
    await act(async () => root.unmount());
  });

  it("adds film at mount for a soft navigation that never ran the script, and not under reduced motion", async () => {
    for (const allowed of [true, false]) {
      motion = allowed;
      document.body.innerHTML = `<div id="root">${renderToString(page)}</div>`;
      let root!: ReturnType<typeof hydrateRoot>;
      await act(async () => {
        root = hydrateRoot(document.getElementById("root")!, page);
      });
      expect(document.getElementById("home")!.classList.contains("film")).toBe(allowed);
      await act(async () => root.unmount());
    }
  });
});
