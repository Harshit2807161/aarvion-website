import { describe, expect, it } from "vitest";
import { findClaims } from "../../tests/helpers/claims";

describe("findClaims: visible-text bans", () => {
  it.each([
    "Cardiac therapy for you",
    "Our Cardiology range",
    "Ophthalmology products",
    "Diabetology care",
    "Therapy area: heart",
  ])("flags %j", (text) => {
    expect(findClaims(text).length).toBeGreaterThan(0);
  });

  it("lets the shopper names through, and slugs are not visible text", () => {
    expect(findClaims("Heart care, Eye care, Diabetes care and Respiratory care")).toEqual([]);
    expect(findClaims("Open the category page")).toEqual([]);
  });
});

describe("findClaims: Rx-universal copy [C25]", () => {
  it.each([
    "Every medicine needs a prescription.",
    "All of our medicines require a valid prescription.",
    "These products all need a prescription.",
    "You need a prescription for all medicines.",
    "A prescription is required for every medicine we sell.",
    "Prescription needed on each pack.",
    "Every order needs a prescription.",
    "Each order requires a valid Rx.",
    "No medicine is sold without a prescription.",
    "No medicines are dispensed without a valid prescription.",
  ])("flags %j", (text) => {
    expect(findClaims(text).length).toBeGreaterThan(0);
  });

  it.each([
    "A medicine that needs a prescription is sold only against a valid prescription.",
    "Schedule H and H1 medicines need a prescription.",
    "Upload your prescription for your order.",
    "We check every prescription before packing.",
    "Your order is packed after a pharmacist checks the prescription.",
    "Our pharmacist checks the prescription for every order.",
    "Pick the medicine, then add a photo of a valid prescription.",
  ])("lets the stated rule through: %j", (text) => {
    expect(findClaims(text)).toEqual([]);
  });

  it("skips only the Rx-universal patterns when the page computed allRx", () => {
    expect(findClaims("You need a prescription for all medicines.", { allRx: true })).toEqual([]);
    expect(findClaims("No medicine is sold without a prescription.", { allRx: true })).toEqual([]);
    expect(findClaims("Every medicine needs a prescription. Best price.", { allRx: true })).toEqual(
      ["Best price"],
    );
  });
});
