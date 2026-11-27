import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rxListItem } from "../../../tests/helpers/rx-list-item";
import { ERROR_SUMMARY_COPY } from "@/components/form/error-summary";
import { RX_DECLARATION_TEXT } from "@/server/prescriptions/review";
import { uploadRx } from "./rx-api";
import { RX_COPY } from "./rx-copy";
import { RxUploadForm } from "./rx-upload-form";

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/components/feedback/live-region", () => ({ announce }));
const openLogin = vi.hoisted(() => vi.fn());
vi.mock("@/components/auth/account-pill", () => ({ openLogin }));
vi.mock("./rx-api", () => ({ uploadRx: vi.fn() }));
const upload = vi.mocked(uploadRx);

const RX = rxListItem();

const png = () => new File([new Uint8Array(2048)], "rx.png", { type: "image/png" });

function setup(userOptions: Parameters<typeof userEvent.setup>[0] = {}) {
  const onUploaded = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup(userOptions);
  const view = render(<RxUploadForm onUploaded={onUploaded} onCancel={onCancel} />);
  // A getter: the input is re-rendered when the drop zone comes back after Remove.
  const fileInput = () =>
    view.container.querySelector<HTMLInputElement>("input[type=file]:not([capture])")!;
  return { onUploaded, onCancel, user, view, fileInput };
}

async function fillAll(s: ReturnType<typeof setup>) {
  await s.user.upload(s.fileInput(), png());
  await screen.findByText(RX_COPY.ready("2 KB"));
  await s.user.type(screen.getByLabelText(RX_COPY.patientLabel), "Asha Rao");
  await s.user.click(screen.getByRole("checkbox"));
}

const submit = () => screen.getByRole("button", { name: RX_COPY.submit });

beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:thumb");
  URL.revokeObjectURL = vi.fn();
});

describe("RxUploadForm", () => {
  it("keeps the declaration pinned to the server's text", () => {
    expect(RX_COPY.declaration).toBe(RX_DECLARATION_TEXT);
  });

  it("renders the labelled drop zone, inputs and fields, and no live region", () => {
    const { view } = setup();
    const form = view.container.querySelector("form#rx-form.form")!;
    expect(form).toBeInTheDocument();
    expect(form.querySelector(".drop .t-fine")).toHaveTextContent(RX_COPY.dropTitleFine);
    expect(form.querySelector(".drop .t-coarse")).toHaveTextContent(RX_COPY.dropTitleCoarse);
    expect(screen.getByLabelText(RX_COPY.pick, { selector: "input" })).toHaveAttribute(
      "type",
      "file",
    );
    expect(screen.getByLabelText(RX_COPY.patientLabel)).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: RX_COPY.declaration })).toBeInTheDocument();
    expect(document.querySelector("[aria-live]")).toBeNull();
  });

  it("submitting empty shows one focused summary of 3 problems and no field alerts", async () => {
    const s = setup();
    await s.user.click(submit());
    const summary = screen.getByRole("group", { name: ERROR_SUMMARY_COPY.many(3) });
    expect(summary).toHaveFocus();
    expect(screen.queryAllByRole("alert")).toEqual([]);
    expect(s.view.container.querySelector(".drop")).toHaveClass("is-invalid");
    expect(upload).not.toHaveBeenCalled();
  });

  it("only the declaration missing: the checkbox's own alert, no summary", async () => {
    const s = setup();
    await s.user.upload(s.fileInput(), png());
    await screen.findByText(RX_COPY.ready("2 KB"));
    await s.user.type(screen.getByLabelText(RX_COPY.patientLabel), "Asha Rao");
    await s.user.click(submit());
    expect(screen.getByRole("alert")).toHaveTextContent(RX_COPY.declarationRequired);
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("checkbox")).toHaveFocus();
  });

  it("dropping a .gif shows the unsupported message on the drop zone", async () => {
    const s = setup();
    const drop = s.view.container.querySelector(".drop")!;
    const gif = new File([new Uint8Array(10)], "funny.gif", { type: "image/gif" });
    fireEvent.dragEnter(drop, { dataTransfer: { files: [gif] } });
    expect(drop).toHaveClass("is-over");
    fireEvent.drop(drop, { dataTransfer: { files: [gif] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(RX_COPY.unsupported("funny.gif"));
    expect(drop).toHaveClass("is-invalid");
    expect(drop).not.toHaveClass("is-over");
  });

  it("a successful upload calls onUploaded once and focuses the note, with the recorded name", async () => {
    // A resume can return the name first recorded, not the one typed since (review M3).
    const recorded = { ...RX, patientName: "Asha R. Rao" };
    upload.mockResolvedValue({ ok: true, rx: recorded });
    const s = setup();
    await fillAll(s);
    await s.user.click(submit());
    await waitFor(() => expect(s.onUploaded).toHaveBeenCalledOnce());
    expect(s.onUploaded).toHaveBeenCalledWith(recorded);
    expect(upload.mock.calls[0]![0]).toMatchObject({ patientName: "Asha Rao" });
    expect(screen.getByText(RX_COPY.sentFor("Asha R. Rao"))).toHaveFocus();
    // Focused, so not also announced (review M2).
    expect(announce).not.toHaveBeenCalledWith(RX_COPY.sentFor("Asha R. Rao"));
  });

  it("a double click on submit sends one upload, with the form busy meanwhile", async () => {
    let finish!: (v: Awaited<ReturnType<typeof uploadRx>>) => void;
    upload.mockImplementation(() => new Promise((r) => (finish = r)));
    const s = setup();
    await fillAll(s);
    await s.user.dblClick(submit());
    expect(upload).toHaveBeenCalledOnce();
    expect(s.view.container.querySelector("form")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: RX_COPY.sending })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    await act(async () => finish({ ok: true, rx: RX }));
    expect(s.onUploaded).toHaveBeenCalledOnce();
  });

  it("a file error from the server goes on the drop zone and focuses the picker", async () => {
    upload.mockResolvedValue({ ok: false, error: "too_small" });
    const s = setup();
    await fillAll(s);
    await s.user.click(submit());
    expect(await screen.findByText(RX_COPY.tooSmall)).toBeInTheDocument();
    expect(s.view.container.querySelector(".drop")).toHaveClass("is-invalid");
    expect(screen.getByRole("button", { name: RX_COPY.pick })).toHaveFocus();
    expect(announce).toHaveBeenLastCalledWith(RX_COPY.tooSmall);
  });

  it("any other failure is a focused form note, and a busy one says to try again", async () => {
    upload.mockResolvedValue({ ok: false, error: "rate_limited", retryAfterSec: 1500 });
    const s = setup();
    await fillAll(s);
    await s.user.click(submit());
    const note = await screen.findByText(RX_COPY.rateLimited("25 minutes"));
    expect(note.closest(".note--bad")).toHaveFocus();
    expect(announce).not.toHaveBeenCalledWith(RX_COPY.rateLimited("25 minutes"));
  });

  it("keeps the slot until the answer is definite, so a resend never uploads a copy (I2)", async () => {
    const slot = "abcdefghijklmnopqrstuv";
    upload
      .mockResolvedValueOnce({
        ok: false,
        error: "upload_unconfirmed",
        retryAfterSec: 30,
        stagingId: slot,
      })
      .mockResolvedValueOnce({ ok: false, error: "busy", retryAfterSec: 5, stagingId: slot })
      .mockResolvedValueOnce({ ok: true, rx: RX });
    const s = setup();
    await fillAll(s);
    await s.user.click(submit());
    expect(await screen.findByText(RX_COPY.unconfirmed("30 seconds"))).toBeInTheDocument();
    await s.user.click(submit());
    await screen.findByText(RX_COPY.busy);
    await s.user.click(submit());
    await waitFor(() => expect(s.onUploaded).toHaveBeenCalledOnce());
    expect(upload.mock.calls[1]![0]).toMatchObject({ stagingId: slot });
    expect(upload.mock.calls[2]![0]).toMatchObject({ stagingId: slot });
  });

  it("a 401 opens the sign-in dialog and keeps the chosen file", async () => {
    upload.mockResolvedValue({ ok: false, error: "unauthenticated" });
    const s = setup();
    await fillAll(s);
    await s.user.click(submit());
    expect(await screen.findByText(RX_COPY.signIn)).toBeInTheDocument();
    expect(openLogin).toHaveBeenCalledOnce();
    expect(screen.getByText("rx.png")).toBeInTheDocument();
  });

  it("Cancel calls onCancel", async () => {
    const s = setup();
    await s.user.click(screen.getByRole("button", { name: RX_COPY.cancel }));
    expect(s.onCancel).toHaveBeenCalledOnce();
  });
});
