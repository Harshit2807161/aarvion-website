"use client";

/**
 * The prescription file picker of the upload form (prototype flows.js `Upload` and the account
 * page's `.upl` markup): the drop zone with the file and camera pickers, then, once a file is
 * chosen, the file card with its thumbnail and Remove. Controlled: `RxUploadForm` owns the file
 * and the error. Chosen files pass through `prepareRxFile` (a convenience; the server decides).
 * It adds no live region: "added" and "removed" are spoken through `announce()`.
 * Nothing here logs: file names and contents are personal data.
 */
import { type DragEvent, useEffect, useRef, useState } from "react";
import { buttonClass } from "@/components/base/button-class";
import { Button } from "@/components/base/button.client";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { cn } from "@/lib/cn";
import { prepareRxFile } from "./prepare-file";
import { fileSize, RX_COPY } from "./rx-copy";

export const RX_PICK_ID = "rx-pick";
const HINT_ID = "rx-file-hint";
const ERR_ID = "rx-file-err";
const ACCEPT = ".jpg,.jpeg,.png,.webp,.pdf,image/jpeg,image/png,image/webp,application/pdf";

export type RxPickedFile = { name: string; blob: Blob; kind: "image" | "pdf" };

/** The prototype's camera and trash glyphs, drawn here so the first-load icon set does not grow. */
function Glyph({ d, circle }: { d: string; circle?: boolean }) {
  return (
    <svg
      className="i"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path d={d} />
      {circle ? <circle cx="12" cy="12.6" r="3.3" /> : null}
    </svg>
  );
}
const CAMERA =
  "M4 8.5c0-1.1.9-2 2-2h1.8l1.4-2h5.6l1.4 2H18c1.1 0 2 .9 2 2V17c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z";
const TRASH = "M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13";

/** An image preview from an object URL, revoked when the card goes (StrictMode-safe: no state). */
function Thumb({ blob }: { blob: Blob }) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const url = URL.createObjectURL(blob);
    if (ref.current) ref.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [blob]);
  // eslint-disable-next-line @next/next/no-img-element -- a local object URL, not an optimisable asset
  return <img ref={ref} alt="" />;
}

export type RxFilePickerProps = {
  file: RxPickedFile | null;
  /** `alert`: the message gets its own `role="alert"` (false when a summary or `announce()` speaks). */
  error: { message: string; alert: boolean } | null;
  disabled?: boolean;
  /** A file was chosen and prepared, or (null) removed. */
  onChange: (file: RxPickedFile | null) => void;
  /** A chosen file cannot be used; the message says why. */
  onRefused: (message: string) => void;
};

export function RxFilePicker({ file, error, disabled, onChange, onRefused }: RxFilePickerProps) {
  const [over, setOver] = useState(false);
  const fileIn = useRef<HTMLInputElement>(null);
  const camIn = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const picks = useRef(0);
  const refocus = useRef(false);

  // After Remove, focus goes back to "Choose a file" once the drop zone is shown again.
  useEffect(() => {
    if (!refocus.current || file) return;
    refocus.current = false;
    document.getElementById(RX_PICK_ID)?.focus();
  });

  async function take(f: File | undefined) {
    if (!f) return;
    const pick = ++picks.current;
    const ready = await prepareRxFile(f);
    if (pick !== picks.current) return; // a newer pick won
    if (!ready.ok) return onRefused(ready.message);
    onChange({ name: f.name, blob: ready.blob, kind: ready.kind });
    announce(RX_COPY.added(f.name));
  }

  function remove() {
    picks.current++;
    refocus.current = true;
    onChange(null);
    announce(RX_COPY.removed);
  }

  function onDrag(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (e.type === "dragenter") depth.current++;
    if (e.type === "dragleave") depth.current = Math.max(0, depth.current - 1);
    if (e.type === "drop") depth.current = 0;
    setOver(depth.current > 0);
    if (e.type === "drop") void take(e.dataTransfer?.files?.[0]);
  }

  const message = file ? null : error?.message;
  return (
    <div className="grid gap-2.5">
      {file ? (
        <div className="file">
          <span className="file-thumb">
            {file.kind === "image" ? <Thumb blob={file.blob} /> : <Icon name="file" />}
          </span>
          <span className="file-info">
            <span className="file-name">{file.name}</span>
            <span className="file-meta">
              <Icon name="check" />
              <span>{RX_COPY.ready(fileSize(file.blob.size))}</span>
            </span>
          </span>
          <button
            type="button"
            className={buttonClass({ variant: "quiet", size: "sm" })}
            aria-label={RX_COPY.remove(file.name)}
            onClick={remove}
            disabled={disabled}
          >
            <Glyph d={TRASH} />
          </button>
        </div>
      ) : (
        <div
          className={cn("drop", over && "is-over", message && "is-invalid")}
          onDragEnter={onDrag}
          onDragOver={onDrag}
          onDragLeave={onDrag}
          onDrop={onDrag}
        >
          <span className="drop-icon">
            <Icon name="upload" />
          </span>
          <p className="drop-title">
            <span className="t-fine">{RX_COPY.dropTitleFine}</span>
            <span className="t-coarse">{RX_COPY.dropTitleCoarse}</span>
          </p>
          <p className="drop-hint" id={HINT_ID}>
            {RX_COPY.dropHint}
          </p>
          <div className="drop-actions">
            <Button
              id={RX_PICK_ID}
              size="sm"
              icon="file"
              aria-describedby={message ? `${HINT_ID} ${ERR_ID}` : HINT_ID}
              aria-invalid={message ? true : undefined}
              onClick={() => fileIn.current?.click()}
            >
              {RX_COPY.pick}
            </Button>
            <Button
              variant="quiet"
              size="sm"
              className="t-coarse"
              onClick={() => camIn.current?.click()}
            >
              <Glyph d={CAMERA} circle />
              {RX_COPY.camera}
            </Button>
          </div>
          {[
            { ref: fileIn, label: RX_COPY.pick, accept: ACCEPT, capture: undefined },
            {
              ref: camIn,
              label: RX_COPY.camera,
              accept: "image/*",
              capture: "environment" as const,
            },
          ].map((i) => (
            <input
              key={i.label}
              ref={i.ref}
              type="file"
              hidden
              aria-label={i.label}
              accept={i.accept}
              capture={i.capture}
              onChange={(e) => {
                void take(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          ))}
        </div>
      )}
      {message ? (
        <p className="field-err" id={ERR_ID} role={error?.alert ? "alert" : undefined}>
          <Icon name="alert" size={18} />
          {message}
        </p>
      ) : null}
    </div>
  );
}
