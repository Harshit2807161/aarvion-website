import { Fragment } from "react";
import { formatRupees } from "@/lib/format/rupees";

/**
 * Integer paise as a rupee string, each digit-group comma in `span.cm`. Inside the
 * dot-matrix `.dm` mask a comma is too small to survive, so `.cm` draws it in the sans face.
 */
export function Rupees({ paise }: { paise: number }) {
  const parts = formatRupees(paise).split(",");
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="cm">,</span>}
          {part}
        </Fragment>
      ))}
    </>
  );
}
