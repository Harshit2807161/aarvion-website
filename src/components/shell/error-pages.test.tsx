import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/fonts", () => ({ fontVariables: "" }));
vi.mock("@/lib/catalogue/cached", () => ({
  getCachedCategories: vi.fn(async () => [
    { slug: "cardiology", name: "Heart care", status: "live", sortOrder: 0 },
  ]),
}));

import GlobalError from "../../app/global-error";
import ErrorPage from "../../app/error";
import NotFound, { metadata } from "../../app/not-found";
import { EmptyState } from "./empty-state";

afterEach(() => vi.restoreAllMocks());

describe("404 page", () => {
  it("has the h1, the two links and the 404 count, inside the store chrome", async () => {
    const { container } = render(await NotFound());
    expect(metadata.title).toBe("Page not found");
    expect(screen.getByRole("heading", { level: 1, name: "We can’t find that page" })).toBeTruthy();
    expect(screen.getByText("The link may be old, or the page may have moved.")).toBeTruthy();
    expect(container.querySelector(".well-count")?.textContent).toBe("404");
    expect(screen.getByRole("link", { name: "Go to the home page" }).getAttribute("href")).toBe(
      "/",
    );
    expect(screen.getByRole("link", { name: "Browse medicines" }).getAttribute("href")).toBe(
      "/#medicines",
    );
    expect(container.querySelector("header[data-store-head]")).not.toBeNull();
    expect(container.querySelector("footer#contact")).not.toBeNull();
    expect(container.querySelectorAll("main#main")).toHaveLength(1);
  });
});

describe("error page", () => {
  it("calls retry once on Try again and shows no error detail", () => {
    const retry = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("secret db detail"), { digest: "abc123" });
    const { container } = render(<ErrorPage error={error} retry={retry} />);
    expect(screen.getByRole("heading", { level: 1, name: "Something went wrong" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledTimes(1);
    expect(container.textContent).not.toContain("secret db detail");
    expect(container.textContent).not.toContain("abc123");
  });

  it("logs only the digest, never the message or stack", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("secret db detail"), { digest: "abc123" });
    render(<ErrorPage error={error} retry={vi.fn()} />);
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secret db detail");
    expect(JSON.stringify(spy.mock.calls)).toContain("abc123");
  });
});

describe("global error page", () => {
  it("is its own document with the same copy and no error detail", () => {
    const error = new Error("secret db detail");
    const markup = renderToStaticMarkup(<GlobalError error={error} retry={vi.fn()} />);
    expect(markup).toMatch(/^<html lang="en-IN">.*<body/);
    expect(markup).toContain("Something went wrong");
    expect(markup).toContain("This page didn’t load. Try again, or go back to the home page.");
    expect(markup).not.toContain("secret db detail");
  });
});

describe("EmptyState", () => {
  it("renders the dashed well with the count, the title, copy and actions", () => {
    const { container } = render(
      <EmptyState count="0" title="Nothing here" actions={<button type="button">Next step</button>}>
        Some words.
      </EmptyState>,
    );
    expect(container.querySelector(".well--empty .well-count.dm")?.textContent).toBe("0");
    expect(screen.getByRole("heading", { level: 2, name: "Nothing here" })).toBeTruthy();
    expect(container.querySelector(".empty-actions button")).not.toBeNull();
  });
});
