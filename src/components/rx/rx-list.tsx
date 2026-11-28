import { StatusTag, type StatusTone } from "@/components/base/badge";
import { Icon, type IconName } from "@/components/base/icon";
import { cn } from "@/lib/cn";
import type { RxListItem } from "./rx-api";
import { RX_COPY } from "./rx-copy";
import { formatIstDay, istDayOf, RX_PAGE_COPY as C } from "./rx-page-copy";

/** The file route (R5): ownership-checked, inline, sandbox CSP, `rx.view` audited, never cached. */
export const rxFileUrl = (id: string) => `/api/prescriptions/${encodeURIComponent(id)}/file`;

function meta(rx: RxListItem): string {
  const kind = rx.kind === "pdf" ? `${C.pdf} · ${C.pages(rx.pages)}` : C.photo;
  return `${kind} · ${C.uploaded(formatIstDay(istDayOf(rx.uploadedAt)))}`;
}

function tag(rx: RxListItem): { tone: StatusTone; text: string } {
  switch (rx.status) {
    case "approved":
      return {
        tone: "ok",
        text: rx.validUntilDay ? C.approved(formatIstDay(rx.validUntilDay)) : C.approvedPlain,
      };
    case "expired":
      return {
        tone: "off",
        text: rx.expiredOnDay ? C.expiredOn(formatIstDay(rx.expiredOnDay)) : C.expired,
      };
    case "rejected":
      return { tone: "bad", text: C.rejected };
    default:
      return { tone: "wait", text: C.underReview };
  }
}

function Why({
  icon,
  bad,
  children,
}: {
  icon: IconName;
  bad?: boolean;
  children: React.ReactNode;
}) {
  return (
    <p className={cn("rx-why", bad && "is-bad")}>
      <Icon name={icon} size={18} />
      <span>{children}</span>
    </p>
  );
}

/**
 * The shopper's prescriptions, newest first (prototype account.html `.rx-list`). The status and
 * its days come from the server (R1's customer view, the 6-month IST rule); the patient's name is
 * the one the server recorded. "View" opens the R5 file route in a new tab: the bytes never pass
 * through this page's script.
 */
export function RxList({
  items,
  onUploadAnother,
}: {
  items: readonly RxListItem[];
  onUploadAnother: () => void;
}) {
  return (
    <ul className="rx-list">
      {items.map((rx) => {
        const t = tag(rx);
        const titleId = `rx-${rx.id}-title`;
        return (
          <li className="rx-item" key={rx.id}>
            <span className="rx-doc" aria-hidden="true">
              <span>Rx</span>
            </span>
            <div>
              <p className="rx-title" id={titleId}>
                {rx.patientName}
              </p>
              <p className="rx-meta">{meta(rx)}</p>
              <a
                className="link"
                href={rxFileUrl(rx.id)}
                target="_blank"
                rel="noopener"
                aria-describedby={titleId}
              >
                {C.view}
                <span className="sr-only"> {C.newTab}</span>
              </a>
            </div>
            <StatusTag tone={t.tone}>{t.text}</StatusTag>
            {rx.status === "under_review" ? <Why icon="pharm">{C.checking}</Why> : null}
            {rx.status === "expired" ? <Why icon="clock">{C.expiredWhy}</Why> : null}
            {rx.status === "rejected" ? (
              <Why icon="alert" bad>
                <span className="block">{RX_COPY.reasons[rx.rejection?.reason ?? "other"]}</span>
                {rx.rejection?.note ? <span className="block">{rx.rejection.note}</span> : null}
                <button className="link" type="button" onClick={onUploadAnother}>
                  {C.uploadAnother}
                </button>
              </Why>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
