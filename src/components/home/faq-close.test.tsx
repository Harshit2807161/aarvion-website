import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ROUTES } from "@/config/routes";
import { SITE_CONFIG } from "@/config/site";
import { findClaims } from "../../../tests/helpers/claims";
import { Close } from "./close";
import { Faq } from "./faq";

function faq(allRx: boolean, onlinePayments = false) {
  return render(<Faq allRx={allRx} onlinePayments={onlinePayments} />).container;
}
const answers = (c: HTMLElement) => [...c.querySelectorAll("details p")].map((p) => p.textContent);

describe("Faq (static composition, C3)", () => {
  it("is the questions section with the six verbatim questions", () => {
    const c = faq(true);
    const sec = c.querySelector("section#questions.faq");
    expect(sec?.getAttribute("aria-labelledby")).toBe("faq-title");
    expect(c.querySelector("h2.h-section#faq-title")?.textContent).toBe("Questions");
    expect([...c.querySelectorAll("details > summary")].map((s) => s.textContent)).toEqual([
      "Do I need a prescription?",
      "Can I reuse a prescription I uploaded before?",
      "How can I pay?",
      "What happens if my prescription is rejected?",
      "Can I cancel or return an order?",
      "Why do some packs say Win2Age Pharma?",
    ]);
  });

  it("carries the anchors that links target, and the footer's route constants resolve to them", () => {
    const c = faq(true);
    expect(c.querySelector("details#faq-returns")).not.toBeNull();
    expect(c.querySelector("details#faq-win2age summary")?.textContent).toContain("Win2Age");
    expect(ROUTES.questions).toBe("/#questions");
    expect(ROUTES.faqWin2age).toBe("/#faq-win2age");
  });

  it("uses native disclosure with no live region and no script hooks", () => {
    const c = faq(true);
    expect(c.querySelectorAll("details").length).toBe(6);
    expect(c.querySelector("[aria-live], [role=status], [role=alert]")).toBeNull();
  });

  it("[C25] says every medicine is Rx only when the catalogue is all Rx", () => {
    expect(answers(faq(true))[0]).toMatch(/^Yes\. Every medicine here is a prescription medicine\. /);
    const mixed = answers(faq(false))[0] ?? "";
    expect(mixed).toMatch(/^Medicines marked Rx need one\. Upload a photo or PDF/);
    expect(mixed).not.toMatch(/every medicine/i);
  });

  it("names online payment and the refund only when online payments are live", () => {
    const on = answers(faq(true, true));
    expect(on[2]).toBe("Online through Razorpay, or cash on delivery for orders up to ₹5,000.");
    expect(on[3]).toContain("and refund your payment");
    const off = faq(true, false).textContent ?? "";
    expect(off).not.toMatch(/razorpay|online|refund|upi|card/i);
    expect(answers(faq(true, false))[2]).toBe("Cash on delivery, for orders up to ₹5,000.");
  });

  it("follows SITE_CONFIG.onlinePayments by default (false today)", () => {
    expect(SITE_CONFIG.onlinePayments).toBe(false);
    expect(render(<Faq allRx />).container.textContent).not.toMatch(/razorpay/i);
  });

  it("fails the Rx-universal check when the line is not gated on allRx", () => {
    expect(findClaims(faq(true).textContent ?? "")).not.toEqual([]);
    expect(findClaims(faq(false).textContent ?? "")).toEqual([]);
  });

  it("makes no invented claims in any state", () => {
    for (const [rx, pay] of [[true, true], [true, false], [false, true], [false, false]] as const) {
      expect(findClaims(faq(rx, pay).textContent ?? "", { allRx: rx })).toEqual([]);
    }
  });
});

describe("Close (static composition, C3)", () => {
  const setup = () => render(<Close />).container;

  it("is the pinned lead act with the field, the logo and the copy in the stage", () => {
    const act = setup().querySelector("section#close.act.act-close");
    expect(act?.getAttribute("data-act")).toBe("pin");
    expect(act?.hasAttribute("data-lead")).toBe(true);
    expect(act?.getAttribute("aria-labelledby")).toBe("close-title");
    expect(act?.querySelector(":scope > .stage > .field")).not.toBeNull();
    expect(act?.querySelector(":scope > .stage > .close-swoosh")).not.toBeNull();
    expect(act?.querySelector(":scope > .stage > .close-copy")).not.toBeNull();
  });

  it("carries the film ranges the engine reads", () => {
    const c = setup();
    expect(c.querySelector(".close-swoosh")?.getAttribute("data-in")).toBe("0 .62 io");
    expect(c.querySelector(".close-copy")?.getAttribute("data-in")).toBe(".56 .84 out");
  });

  it("shows the reversed vector logo as decoration", () => {
    const sw = setup().querySelector(".close-swoosh");
    expect(sw?.getAttribute("aria-hidden")).toBe("true");
    const img = sw?.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/brand/aarvion-logo-reversed.svg");
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("has the heading, the lead and both calls to action", () => {
    const c = setup();
    expect(c.querySelector("h2.h-display#close-title")?.textContent).toBe(
      "Ready when your prescription is.",
    );
    expect(c.querySelector("p.lead")?.textContent).toBe(
      "Find your medicine, add it to your cart and upload a photo or PDF of your prescription.",
    );
    const [rx, search] = [...c.querySelectorAll(".close-actions a")];
    expect(rx?.textContent).toBe("Upload prescription");
    expect(rx?.getAttribute("href")).toBe(ROUTES.uploadRx);
    expect(rx?.classList.contains("btn-sand") && rx.classList.contains("btn-lg")).toBe(true);
    expect(search?.textContent).toBe("Search medicines");
    expect(search?.getAttribute("href")).toBe("#q");
    expect(search?.hasAttribute("data-search")).toBe(true);
    expect(search?.classList.contains("btn-ghost") && search.classList.contains("btn-lg")).toBe(true);
  });

  it("makes no invented claims", () => {
    expect(findClaims(setup().textContent ?? "")).toEqual([]);
  });
});
