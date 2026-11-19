import { cn } from "@/lib/cn";

/** "Rx" mark: an `abbr` that sits at the end of a product name. `lg` is the cart's Rx group head. */
export function RxBadge({ size = "md" }: { size?: "md" | "lg" }) {
  return (
    <abbr className={cn("rx", size === "lg" && "rx--lg")} title="Prescription required">
      Rx
    </abbr>
  );
}

export type StatusTone = "ok" | "wait" | "hold" | "bad" | "off" | "done";

/** A status pill. The dot plus the words carry the meaning, never the colour alone. */
export function StatusTag({ tone, children }: { tone: StatusTone; children: React.ReactNode }) {
  return (
    <span className={cn("tag", `tag--${tone}`)}>
      <span className="tag-dot" aria-hidden="true" />
      {children}
    </span>
  );
}
