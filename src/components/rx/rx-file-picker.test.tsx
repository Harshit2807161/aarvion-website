import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RX_COPY } from "./rx-copy";
import { RxFilePicker, type RxPickedFile } from "./rx-file-picker";

const announce = vi.hoisted(() => vi.fn());
vi.mock("@/components/feedback/live-region", () => ({ announce }));

/** The picker is controlled; this holds its state the way RxUploadForm does. */
function Harness({ onRefused }: { onRefused: (m: string) => void }) {
  const [file, setFile] = useState<RxPickedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <RxFilePicker
      file={file}
      error={error ? { message: error, alert: true } : null}
      onChange={setFile}
      onRefused={(m) => {
        setError(m);
        onRefused(m);
      }}
    />
  );
}

function setup() {
  const onRefused = vi.fn();
  const user = userEvent.setup();
  const view = render(<Harness onRefused={onRefused} />);
  const input = screen.getByLabelText(RX_COPY.pick, { selector: "input" }) as HTMLInputElement;
  return { onRefused, user, view, input };
}
const png = () => new File([new Uint8Array(2048)], "rx.png", { type: "image/png" });

beforeEach(() => {
  vi.resetAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:thumb");
  URL.revokeObjectURL = vi.fn();
});

describe("RxFilePicker", () => {
  it("renders the drop zone and two labelled, hidden file inputs", () => {
    const { view, input } = setup();
    expect(view.container.querySelector(".drop .t-fine")).toHaveTextContent(RX_COPY.dropTitleFine);
    expect(view.container.querySelector(".drop .t-coarse")).toHaveTextContent(
      RX_COPY.dropTitleCoarse,
    );
    expect(input).toHaveAttribute(
      "accept",
      ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf",
    );
    expect(input).not.toBeVisible();
    const cam = screen.getByLabelText(RX_COPY.camera, { selector: "input" });
    expect(cam).toHaveAttribute("accept", "image/*");
    expect(cam).toHaveAttribute("capture", "environment");
    expect(screen.getByRole("button", { name: RX_COPY.pick })).toHaveAttribute(
      "aria-describedby",
      "rx-file-hint",
    );
  });

  it("shows the card with a thumbnail; Remove revokes it and refocuses the picker", async () => {
    const s = setup();
    await s.user.upload(s.input, png());
    await screen.findByText(RX_COPY.ready("2 KB"));
    expect(screen.getByText("rx.png")).toHaveClass("file-name");
    expect(s.view.container.querySelector(".file-thumb img")).toHaveAttribute("src", "blob:thumb");
    expect(announce).toHaveBeenLastCalledWith(RX_COPY.added("rx.png"));
    await s.user.click(screen.getByRole("button", { name: RX_COPY.remove("rx.png") }));
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:thumb");
    expect(screen.getByRole("button", { name: RX_COPY.pick })).toHaveFocus();
    expect(announce).toHaveBeenLastCalledWith(RX_COPY.removed);
  });

  it("revokes the thumbnail on unmount and shows no preview for a PDF", async () => {
    const s = setup();
    await s.user.upload(s.input, png());
    await screen.findByText(RX_COPY.ready("2 KB"));
    s.view.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:thumb");

    const t = setup();
    vi.mocked(URL.createObjectURL).mockClear();
    await t.user.upload(
      t.input,
      new File([new Uint8Array(10)], "rx.pdf", { type: "application/pdf" }),
    );
    await screen.findByText(RX_COPY.ready("1 KB"));
    expect(t.view.container.querySelector(".file-thumb img")).toBeNull();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("marks a drag over the zone and refuses a dropped file it cannot use", async () => {
    const s = setup();
    const drop = s.view.container.querySelector(".drop")!;
    const exe = new File([new Uint8Array(10)], "setup.exe", { type: "application/x-msdownload" });
    fireEvent.dragEnter(drop, { dataTransfer: { files: [exe] } });
    expect(drop).toHaveClass("is-over");
    fireEvent.dragLeave(drop);
    expect(drop).not.toHaveClass("is-over");
    fireEvent.drop(drop, { dataTransfer: { files: [exe] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(RX_COPY.unsupported("setup.exe"));
    expect(s.onRefused).toHaveBeenCalledWith(RX_COPY.unsupported("setup.exe"));
    expect(drop).toHaveClass("is-invalid");
    expect(screen.getByRole("button", { name: RX_COPY.pick })).toHaveAttribute(
      "aria-describedby",
      "rx-file-hint rx-file-err",
    );
  });
});
