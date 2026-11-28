import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { findClaims } from "../../../tests/helpers/claims";
import { rxListItem } from "../../../tests/helpers/rx-list-item";
import type { RxListItem } from "./rx-api";
import { RX_COPY } from "./rx-copy";
import { RxList } from "./rx-list";
import { formatIstDay, istDayOf, RX_PAGE_COPY as C } from "./rx-page-copy";

const ITEMS: RxListItem[] = [
  rxListItem({ id: "000000000000000000000001", uploadedAt: "2026-11-12T20:00:00.000Z" }),
  rxListItem({
    id: "000000000000000000000002",
    patientName: "Priya Sharma",
    kind: "pdf",
    pages: 2,
    status: "approved",
    validUntilDay: "2027-05-11",
  }),
  rxListItem({ id: "000000000000000000000003", status: "expired", expiredOnDay: "2026-08-28" }),
  rxListItem({
    id: "000000000000000000000004",
    status: "rejected",
    rejection: { reason: "incomplete", note: "Please include the stamp." },
  }),
];

const text = () => document.body.textContent!.replace(/\s+/g, " ");

describe("RxList", () => {
  it("renders each status with its exact tag, why and View link", () => {
    render(<RxList items={ITEMS} onUploadAnother={() => {}} />);
    const items = screen.getAllByRole("listitem");
    const [review, approved, expired, rejected] = items.map((li) => within(li));

    expect(review!.getByText("Asha Rao")).toHaveClass("rx-title");
    // 20:00 UTC is 01:30 the next day in IST.
    expect(review!.getByText("Photo · uploaded 13 Nov 2026")).toHaveClass("rx-meta");
    expect(review!.getByText("Under review").closest(".tag")).toHaveClass("tag--wait");
    expect(review!.getByText(C.checking)).toBeInTheDocument();

    expect(approved!.getByText("Priya Sharma")).toBeInTheDocument();
    expect(approved!.getByText(/^PDF · 2 pages · uploaded /)).toBeInTheDocument();
    expect(approved!.getByText("Approved · valid until 11 May 2027").closest(".tag")).toHaveClass(
      "tag--ok",
    );
    expect(items[1]!.querySelector(".rx-why")).toBeNull();

    expect(expired!.getByText("Expired on 28 Aug 2026").closest(".tag")).toHaveClass("tag--off");
    expect(expired!.getByText(C.expiredWhy)).toBeInTheDocument();

    expect(rejected!.getByText("Rejected").closest(".tag")).toHaveClass("tag--bad");
    expect(rejected!.getByText(RX_COPY.reasons.incomplete)).toBeInTheDocument();
    expect(rejected!.getByText("Please include the stamp.")).toBeInTheDocument();
    expect(items[3]!.querySelector(".rx-why.is-bad")).not.toBeNull();

    const view = review!.getByRole("link", { name: `${C.view} ${C.newTab}` });
    expect(view).toHaveAttribute("href", "/api/prescriptions/000000000000000000000001/file");
    expect(view).toHaveAttribute("target", "_blank");
    expect(view).toHaveAttribute("rel", "noopener");
    expect(view).toHaveAccessibleDescription("Asha Rao");
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  it("words every rejection reason, and a missing reason as other", () => {
    const reasons = Object.keys(RX_COPY.reasons) as (keyof typeof RX_COPY.reasons)[];
    render(
      <RxList
        onUploadAnother={() => {}}
        items={[
          ...reasons.map((reason, i) =>
            rxListItem({
              id: String(i).padStart(24, "0"),
              status: "rejected",
              rejection: { reason, note: null },
            }),
          ),
          rxListItem({ id: "f".repeat(24), status: "rejected", rejection: null }),
        ]}
      />,
    );
    for (const reason of reasons) expect(text()).toContain(RX_COPY.reasons[reason]);
    expect(screen.getAllByText(RX_COPY.reasons.other)).toHaveLength(2);
  });

  it("Upload another asks the page to open the form", async () => {
    const onUploadAnother = vi.fn();
    render(<RxList items={ITEMS.slice(3)} onUploadAnother={onUploadAnother} />);
    await userEvent.click(screen.getByRole("button", { name: C.uploadAnother }));
    expect(onUploadAnother).toHaveBeenCalledOnce();
  });

  it("formats IST days and makes no banned claim", () => {
    expect(formatIstDay("2027-05-12")).toBe("12 May 2027");
    expect(istDayOf("2026-11-12T18:29:59.999Z")).toBe("2026-11-12");
    expect(istDayOf("2026-11-12T18:30:00.000Z")).toBe("2026-11-13");
    render(<RxList items={ITEMS} onUploadAnother={() => {}} />);
    expect(findClaims(text())).toEqual([]);
    const strings = Object.values(C).filter((v) => typeof v === "string");
    expect(findClaims([...strings, ...Object.values(RX_COPY.reasons)].join(" "))).toEqual([]);
  });
});
