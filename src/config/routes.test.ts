import { describe, expect, it } from "vitest";
import { PENDING_ROUTES, ROUTES } from "./routes";

describe("ROUTES", () => {
  it("maps the store pages", () => {
    expect(ROUTES.home).toBe("/");
    expect(ROUTES.medicines).toBe("/#medicines");
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
    expect(PENDING_ROUTES).toEqual([
      "/cart",
      "/account",
      "/account/prescriptions",
      "/category/cardiology",
      "/category/diabetology",
      "/category/ophthalmology",
      "/category/respiratory",
    ]);
  });
});
