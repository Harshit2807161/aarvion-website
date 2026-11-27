"use client";

/**
 * The prescription upload form (prototype account.html `#rx-form` and flows.js `Upload`): the drop
 * zone with file and camera pickers, the file card, the patient's name and the declaration. It is
 * lazy: import it only through `loadRxUploadForm` (or `next/dynamic`) where it is used, never from
 * first-load code (rx-api.test.ts checks). Styles: src/styles/rx.css and forms.css.
 *
 * Accessibility: each field keeps its own `role="alert"` when it alone is wrong; two or more
 * problems show one focused `ErrorSummary` instead. Progress and server answers speak through the
 * page's single live region (`announce()`), and focus moves to the error or the success note.
 * Client checks are a convenience: the server checks the file again and its answer wins.
 * Nothing here logs: file names and contents are personal data.
 */
import { type FormEvent, useEffect, useRef, useState } from "react";
import { openLogin } from "@/components/auth/account-pill";
import { SIGNED_IN_EVENT } from "@/components/auth/events";
import { mmss } from "@/components/auth/login-copy";
import { Button } from "@/components/base/button.client";
import { Icon } from "@/components/base/icon";
import { announce } from "@/components/feedback/live-region";
import { Checkbox } from "@/components/form/checkbox";
import { ErrorSummary, type SummaryError } from "@/components/form/error-summary";
import { TextField } from "@/components/form/text-field";
import { cn } from "@/lib/cn";
import { type RxListItem, uploadRx } from "./rx-api";
import { RX_COPY } from "./rx-copy";
import { RX_PICK_ID, RxFilePicker, type RxPickedFile } from "./rx-file-picker";
import { patientError, rxFailure } from "./rx-messages";

const ID = {
  pick: RX_PICK_ID,
  patient: "rx-patient",
  declare: "rx-declare",
  note: "rx-note",
  send: "rx-send",
  wait: "rx-wait",
} as const;

/** `quiet`: set from a server answer, which `announce()` speaks, so the field adds no alert. */
type FieldErrors = { file?: string; patient?: string; declare?: string; quiet?: boolean };

export type RxUploadFormProps = {
  onUploaded: (item: RxListItem) => void;
  onCancel: () => void;
};

export function RxUploadForm({ onUploaded, onCancel }: RxUploadFormProps) {
  const [file, setFile] = useState<RxPickedFile | null>(null);
  const [fileErr, setFileErr] = useState<{ message: string; alert: boolean } | null>(null);
  const [patient, setPatient] = useState("");
  const [declared, setDeclared] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<SummaryError[]>([]);
  const [submits, setSubmits] = useState(0);
  const [note, setNote] = useState<{ message: string; bad: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  /** Seconds until Send works again after an open answer that named a wait (I2). */
  const [waitLeft, setWaitLeft] = useState(0);
  const inFlight = useRef(false);
  /**
   * The slot of an upload whose outcome is still open: the next send finishes it instead of
   * sending a copy. rx-api hands one back for every answer that does not settle the slot, so it
   * is kept until a success, a settled answer or a new file (review I2).
   */
  const resume = useRef<string | undefined>(undefined);
  const waitUntil = useRef(0);
  const focusNext = useRef<string | null>(null);
  const abort = useRef<AbortController | null>(null);

  // Focus after the render that shows the target (the picker comes back when the card goes).
  useEffect(() => {
    const id = focusNext.current;
    if (!id) return;
    focusNext.current = null;
    document.getElementById(id)?.focus();
  });
  useEffect(() => () => abort.current?.abort(), []);

  // The visible countdown while Send waits out Retry-After.
  const waiting = waitLeft > 0;
  useEffect(() => {
    if (!waiting) return;
    const id = setInterval(() => {
      setWaitLeft(Math.max(0, Math.ceil((waitUntil.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [waiting]);

  // After a 401 the dialog signs the shopper in; then Send has focus and the note says to press it.
  const signInNote = note?.message === RX_COPY.signIn;
  useEffect(() => {
    if (!signInNote) return;
    const onSignedIn = () => {
      setNote({ message: RX_COPY.signedIn, bad: false });
      focusNext.current = ID.send;
      announce(RX_COPY.signedIn);
    };
    window.addEventListener(SIGNED_IN_EVENT, onSignedIn);
    return () => window.removeEventListener(SIGNED_IN_EVENT, onSignedIn);
  }, [signInNote]);

  const many = summary.length > 1;

  function onFile(next: RxPickedFile | null) {
    // A new file is a new upload: the old slot and its wait no longer apply.
    resume.current = undefined;
    setWaitLeft(0);
    setFile(next);
    setNote(null);
    if (next) {
      setFileErr(null);
      setErrors((e) => ({ ...e, file: undefined }));
    }
  }

  function onRefused(message: string) {
    setFile(null);
    setNote(null);
    setFileErr({ message, alert: true });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (inFlight.current || waiting) return;
    const found: FieldErrors = {
      file: file ? undefined : RX_COPY.fileRequired,
      patient: patientError(patient),
      declare: declared ? undefined : RX_COPY.declarationRequired,
    };
    const list: SummaryError[] = (
      [
        [ID.pick, found.file],
        [ID.patient, found.patient],
        [ID.declare, found.declare],
      ] as const
    ).flatMap(([id, message]) => (message ? [{ id, message }] : []));
    setErrors(found);
    setSummary(list);
    setSubmits((n) => n + 1);
    setFileErr(found.file ? { message: found.file, alert: list.length === 1 } : null);
    setNote(null);
    if (list.length === 1) focusNext.current = list[0]!.id;
    if (list.length > 0 || !file) return;

    inFlight.current = true;
    setSending(true);
    announce(RX_COPY.sending);
    abort.current = new AbortController();
    const result = await uploadRx(
      { blob: file.blob, patientName: patient, stagingId: resume.current },
      { signal: abort.current.signal },
    );
    inFlight.current = false;
    if (abort.current.signal.aborted) return; // unmounted meanwhile
    setSending(false);

    if (result.ok) {
      resume.current = undefined;
      setFile(null);
      setPatient("");
      setDeclared(false);
      // Focused, so not also announced (M2). The name is the recorded one (M3).
      setNote({ message: RX_COPY.sentFor(result.rx.patientName), bad: false });
      focusNext.current = ID.note;
      onUploaded(result.rx);
      return;
    }
    resume.current = result.stagingId;
    if (result.stagingId && result.retryAfterSec) {
      waitUntil.current = Date.now() + result.retryAfterSec * 1000;
      setWaitLeft(Math.ceil(result.retryAfterSec));
    }
    const { where, message } = rxFailure(result, file);
    // A 401 opens the sign-in dialog, which takes focus: the note is announced instead (E-M2), and
    // focus comes back to Send when the dialog closes (E-M1).
    const signIn = result.error === "unauthenticated";
    // A focused note speaks for itself (M2); a field or the picker gets the words announced.
    if (where !== "form" || signIn) announce(message);
    if (where === "file") {
      setFile(null);
      setFileErr({ message, alert: false });
      focusNext.current = ID.pick;
    } else if (where === "patient") {
      setErrors({ patient: message, quiet: true });
      focusNext.current = ID.patient;
    } else {
      setNote({ message, bad: true });
      if (!signIn) focusNext.current = ID.note;
    }
    if (signIn) openLogin(undefined, { returnFocusId: ID.send });
  }

  return (
    <form
      className="form"
      id="rx-form"
      noValidate
      onSubmit={onSubmit}
      aria-busy={sending || undefined}
    >
      <ErrorSummary errors={many ? summary : []} focusKey={submits} />
      {note ? (
        <p className={cn("note", note.bad && "note--bad")} id={ID.note} tabIndex={-1}>
          <Icon name={note.bad ? "alert" : "check"} size={22} />
          {note.message}
        </p>
      ) : null}
      <RxFilePicker
        file={file}
        error={fileErr && { message: fileErr.message, alert: fileErr.alert && !many }}
        disabled={sending}
        onChange={onFile}
        onRefused={onRefused}
      />
      <TextField
        id={ID.patient}
        label={RX_COPY.patientLabel}
        hint={RX_COPY.patientHint}
        autoComplete="off"
        value={patient}
        onChange={(e) => setPatient(e.target.value)}
        error={errors.patient}
        errorAlert={!many && !errors.quiet}
      />
      <Checkbox
        id={ID.declare}
        label={RX_COPY.declaration}
        checked={declared}
        onChange={(e) => setDeclared(e.target.checked)}
        error={errors.declare}
        errorAlert={!many}
      />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button
          id={ID.send}
          type="submit"
          busy={sending ? RX_COPY.sending : false}
          aria-disabled={waiting ? true : undefined}
          aria-describedby={waiting ? ID.wait : undefined}
        >
          {RX_COPY.submit}
        </Button>
        <Button variant="quiet" onClick={onCancel}>
          {RX_COPY.cancel}
        </Button>
      </div>
      {waiting ? (
        <p className="hint" id={ID.wait}>
          {RX_COPY.sendAgainIn(mmss(waitLeft))}
        </p>
      ) : null}
    </form>
  );
}
