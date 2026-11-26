import { describe, expect, it } from "vitest";
import { PENDING_ANCHORS, PENDING_ROUTES, ROUTES } from "./routes";

describe("ROUTES", () => {
  it("maps the store pages", () => {
    expect(ROUTES.home).toBe("/");
    expect(ROUTES.medicines).toBe("/#medicines");
    expect(ROUTES.how).toBe("/#how");
    expect(ROUTES.questions).toBe("/#questions");
    expect(ROUTES.faqWin2age).toBe("/#faq-win2age");
    expect(ROUTES.uploadRx).toBe("/account/prescriptions");
    expect(ROUTES.category("cardiology")).toBe("/category/cardiology");
    expect(ROUTES.product("sacuwin-50")).toBe("/product/sacuwin-50");
  });

  it("puts the policies under /legal", () => {
    expect(ROUTES.legal.privacy).toBe("/legal/privacy");
    expect(ROUTES.legal.terms).toBe("/legal/terms");
    expect(ROUTES.legal.returns).toBe("/legal/returns-cancellation");
    expect(ROUTES.legal.shipping).toBe("/legal/shipping");
    expect(ROUTES.legal.prescription).toBe("/legal/prescription-policy");
    expect(ROUTES.legal.grievance).toBe("/legal/grievance");
  });

  it("lists the routes that must still 404", () => {
    expect(PENDING_ROUTES).toEqual(["/login", "/cart", "/account", "/account/prescriptions"]);
  });

  it("lists the home sections that links target but nothing builds yet (none today)", () => {
    expect(PENDING_ANCHORS).toEqual([]);
    expect(ROUTES.questions).toBe("/#questions");
    expect(ROUTES.faqWin2age).toBe("/#faq-win2age");
  });
});
