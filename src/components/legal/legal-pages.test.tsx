import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BANNED_CLAIMS, findClaims } from "../../../tests/helpers/claims";
import {
  Fact,
  formatPolicyDate,
  LegalPage,
  LegalSection,
  legalMetadata,
  Pending,
} from "./legal-page";

describe("formatPolicyDate", () => {
  it("prints an ISO date as day, month name and year, without Intl", () => {
    expect(formatPolicyDate("2026-11-17")).toBe("17 November 2026");
    expect(formatPolicyDate("2027-01-05")).toBe("5 January 2027");
  });
});

describe("LegalPage", () => {
  it("puts the title in the forest band and the prose, with the last-updated line, on the sheet", () => {
    const { container } = render(
      <LegalPage title="Privacy policy" sub="How we use your data.">
        <LegalSection title="Who we are">
          <p>body</p>
        </LegalSection>
      </LegalPage>,
    );
    const h1 = screen.getByRole("heading", { level: 1, name: "Privacy policy" });
    expect(h1.closest(".band")).not.toBeNull();
    expect(container.querySelector(".band-sub")?.textContent).toBe("How we use your data.");
    const article = container.querySelector(".work article.prose")!;
    expect(article.textContent).toContain("Last updated 17 November 2026");
    expect(article.querySelector("time")?.getAttribute("datetime")).toBe("2026-11-17");
    const section = article.querySelector("section")!;
    expect(section.querySelector("h2")?.textContent).toBe("Who we are");
    expect(section.textContent).toContain("body");
  });

  it("Pending renders the To be added chip", () => {
    const { container } = render(<Pending />);
    expect(container.innerHTML).toBe('<span class="pending">To be added</span>');
  });

  it("Fact prints a supplied value, and Pending while it is unset or blank", () => {
    expect(render(<Fact value="A. Officer" />).container.innerHTML).toBe("A. Officer");
    for (const unset of [null, undefined, "  "]) {
      const { container } = render(<Fact value={unset} />);
      expect(container.querySelector(".pending")?.textContent).toBe("To be added");
    }
  });

  it("legalMetadata gives the page title and description", () => {
    expect(legalMetadata("Terms of use", "The terms.")).toEqual({
      title: "Terms of use",
      description: "The terms.",
    });
  });
});

describe("findClaims", () => {
  it("returns each invented claim it finds", () => {
    expect(findClaims("Rated 4.8 by 10,000+ customers. Licensed and certified.")).toEqual([
      "Licensed",
      "certified",
      "10,000+ customers",
      "Rated",
    ]);
    expect(findClaims("Read 120 reviews of our bestseller")).toEqual(["120 reviews", "bestseller"]);
  });

  it("passes plain copy and the real Rx status Under review", () => {
    expect(findClaims("Under review. Your order is under review by our pharmacist.")).toEqual([]);
    expect(findClaims("Sign-in is rate-limited and stored securely.")).toEqual([]);
    expect(BANNED_CLAIMS).toHaveLength(14);
  });
});
