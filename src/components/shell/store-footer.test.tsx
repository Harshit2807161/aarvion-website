import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Category } from "@/server/catalogue/schema";
import { StoreFooter } from "./store-footer";

const categories: Category[] = [
  { slug: "cardiology", name: "Heart care", status: "live", sortOrder: 0 },
  { slug: "diabetology", name: "Diabetes care", status: "live", sortOrder: 1 },
  { slug: "ophthalmology", name: "Eye care", status: "live", sortOrder: 2 },
  { slug: "respiratory", name: "Respiratory care", status: "live", sortOrder: 3 },
];

const href = (name: string) => screen.getByRole("link", { name }).getAttribute("href");

describe("StoreFooter", () => {
  it("is the contact landmark with the four column headings", () => {
    const { container } = render(<StoreFooter categories={categories} />);
    const foot = container.querySelector("footer.foot");
    expect(foot?.id).toBe("contact");
    for (const h of ["Shop by category", "Help and policies", "Company", "Contact"]) {
      expect(screen.getByRole("heading", { name: h })).toBeInTheDocument();
    }
  });

  it("links each live category, then All medicines", () => {
    render(<StoreFooter categories={categories} />);
    expect(href("Heart care")).toBe("/category/cardiology");
    expect(href("Diabetes care")).toBe("/category/diabetology");
    expect(href("Eye care")).toBe("/category/ophthalmology");
    expect(href("Respiratory care")).toBe("/category/respiratory");
    expect(href("All medicines")).toBe("/#medicines");
  });

  it("only lists the categories it is given", () => {
    render(<StoreFooter categories={categories.slice(0, 1)} />);
    expect(screen.queryByRole("link", { name: "Eye care" })).toBeNull();
  });

  it("links the help and policy pages", () => {
    render(<StoreFooter categories={categories} />);
    expect(href("How ordering works")).toBe("/#how");
    expect(href("Questions")).toBe("/#questions");
    expect(href("Track an order")).toBe("/account");
    expect(href("Refunds and cancellation")).toBe("/legal/returns-cancellation");
    expect(href("Shipping")).toBe("/legal/shipping");
    expect(href("Prescription policy")).toBe("/legal/prescription-policy");
    expect(href("Privacy policy")).toBe("/legal/privacy");
    expect(href("Terms of use")).toBe("/legal/terms");
    expect(href("Grievances")).toBe("/legal/grievance");
    expect(href("Why some packs say Win2Age")).toBe("/#faq-win2age");
    expect(href("Your account")).toBe("/account");
    expect(href("Contact")).toBe("/contact");
  });

  it("keeps About Aarvion as a placeholder, not a link", () => {
    render(<StoreFooter categories={categories} />);
    expect(screen.queryByRole("link", { name: /About Aarvion/ })).toBeNull();
    const item = screen.getByText("About Aarvion").closest("li")!;
    expect(item).toHaveTextContent("To be added");
  });

  it("shows the reversed logo, the about line and the address with the legal name", () => {
    const { container } = render(<StoreFooter categories={categories} />);
    expect(container.querySelector(".foot-logo img")?.getAttribute("src")).toBe(
      "/brand/aarvion-logo-reversed.svg",
    );
    expect(container.querySelector(".foot-about")?.textContent).toBe(
      "Aarvion’s own prescription medicines, sold by Aarvion. A pharmacist checks every prescription before an order is packed.",
    );
    const addr = container.querySelector("address")!;
    expect(addr.textContent).toContain("Aarvion Pharmaceuticals");
    expect(addr.textContent).toContain("Plot No. 70, Second Floor, Functional Industrial Estate,");
    expect(addr.textContent).toContain("Patparganj, New Delhi 110092");
  });

  it("shows To be added for phone, email and the four legal facts", () => {
    const { container } = render(<StoreFooter categories={categories} />);
    const legal = container.querySelector(".foot-legal")!;
    const dts = [...legal.querySelectorAll("dt")].map((d) => d.textContent);
    expect(dts).toEqual([
      "Drug licence no.",
      "Registered pharmacist",
      "Grievance officer",
      "GSTIN",
    ]);
    for (const dd of legal.querySelectorAll("dd")) expect(dd.textContent).toBe("To be added");
    const contact = within(container.querySelector("address")!.parentElement!);
    expect(contact.getByText("Phone").nextElementSibling?.textContent).toBe("To be added");
    expect(contact.getByText("Email").nextElementSibling?.textContent).toBe("To be added");
  });

  it("lists the payment methods", () => {
    const { container } = render(<StoreFooter categories={categories} />);
    const pay = container.querySelector(".foot-pay")!;
    expect(pay.textContent).toContain("Pay with");
    for (const m of ["UPI", "Cards", "Netbanking", "Cash on delivery"]) {
      expect(pay.textContent).toContain(m);
    }
    expect(pay.textContent).toContain("through Razorpay, or");
  });

  it("ends with the exact copyright line", () => {
    const { container } = render(<StoreFooter categories={categories} />);
    expect(container.querySelector(".foot-base")?.textContent).toBe(
      "© 2026 Aarvion Pharmaceuticals. Prescription medicines are dispensed only against a valid prescription.",
    );
  });

  it("makes no invented claims", () => {
    const { container } = render(<StoreFooter categories={categories} />);
    expect(container.textContent).not.toMatch(/licensed|certified|rated/i);
  });
});
