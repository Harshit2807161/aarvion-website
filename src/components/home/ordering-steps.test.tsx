import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SITE_CONFIG } from "@/config/site";
import { findClaims } from "../../../tests/helpers/claims";
import { OrderingSteps } from "./ordering-steps";

function setup() {
  const { container } = render(<OrderingSteps />);
  return container;
}

describe("OrderingSteps (static composition, C3)", () => {
  it("is the pinned act with a stage holding the steps column and the pictures", () => {
    const c = setup();
    const act = c.querySelector("section#how.act.act-steps");
    expect(act?.getAttribute("data-act")).toBe("pin");
    expect(act?.getAttribute("aria-labelledby")).toBe("how-title");
    expect(act?.querySelector(":scope > .stage > .steps-col")).not.toBeNull();
    expect(act?.querySelector(":scope > .stage > .steps-vis")).not.toBeNull();
  });

  it("has the heading and the three verbatim steps, the first active", () => {
    const c = setup();
    expect(c.querySelector("h2.h-display")?.textContent).toBe("How ordering works");
    expect([...c.querySelectorAll("li.step h3")].map((h) => h.textContent)).toEqual([
      "Add your medicines, upload your prescription",
      "A pharmacist checks it",
      "We deliver it free",
    ]);
    const steps = [...c.querySelectorAll("li.step")];
    expect(steps.map((s) => s.classList.contains("is-active"))).toEqual([true, false, false]);
    expect(steps.map((s) => s.querySelector(".step-dot")?.textContent)).toEqual(["1", "2", "3"]);
    expect(steps[1]?.querySelector("p")?.textContent).toContain("refund your payment");
  });

  it("labels each picture as an example", () => {
    const c = setup();
    expect([...c.querySelectorAll(".doc-tag")].map((t) => t.textContent)).toEqual([
      "Example prescription",
      "Example order",
      "Example shipping label",
    ]);
  });

  it("states the free delivery on the label and the sender from SITE_CONFIG", () => {
    const c = setup();
    expect(c.querySelector(".label-fee dd")?.textContent).toBe("₹0");
    const dds = [...c.querySelectorAll(".label dd")].map((d) => d.textContent);
    expect(dds).toContain(`${SITE_CONFIG.legalName}, Patparganj, New Delhi 110092`);
  });

  it("carries the film attributes the engine reads", () => {
    const c = setup();
    const attr = (sel: string, name: string) => c.querySelector(sel)?.getAttribute(name);
    expect(attr(".perf-fill", "data-in")).toBe("0 .9");
    expect(attr("figure.vis-rx", "data-out")).toBe(".27 .38 in");
    expect(attr("figure.vis-log", "data-in")).toBe(".29 .41 out");
    expect(attr("figure.vis-log", "data-out")).toBe(".6 .71 in");
    expect(attr("figure.vis-label", "data-in")).toBe(".62 .74 out");
    expect(c.querySelector("figure.vis-label")?.hasAttribute("data-out")).toBe(false);
    expect(c.querySelector(".perf")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("makes no invented claims", () => {
    expect(findClaims(setup().textContent ?? "")).toEqual([]);
  });
});
