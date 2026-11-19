import { Icon } from "@/components/base/icon";
import { SITE_CONFIG } from "@/config/site";

/**
 * "How ordering works": the static composition of the home page's ordering act (spec C3), the
 * markup of design/prototype/src/index.src.html (the "Ordering film" section). Three steps over a
 * dashed perforation, and three clearly labelled example cards (prescription, order, shipping
 * label). Styles are in src/styles/steps.css.
 *
 * The scroll film (Task 28) animates this markup without changing it: the engine in
 * src/components/film/engine.ts reads `data-act="pin"` on the section, `.stage` inside it, and the
 * `data-in` / `data-out` ranges ("start end in|out") on the elements below, and it toggles
 * `.is-active` on the `.step` items. The payment copy is gated on `onlinePayments` (SITE_CONFIG):
 * no online-payment claim before live keys exist. Do not rename those hooks. The cards are examples, not
 * the customer's data, and the copy makes no delivery-time promise.
 */
const BARCODE =
  "M2 0v40M6 0v40M9 0v40M15 0v40M18 0v40M24 0v40M26 0v40M31 0v40M37 0v40M40 0v40M44 0v40M50 0v40M53 0v40M55 0v40M61 0v40M66 0v40M69 0v40M74 0v40M78 0v40M80 0v40M86 0v40M91 0v40M94 0v40M98 0v40M104 0v40M107 0v40M110 0v40M116 0v40M120 0v40M123 0v40M128 0v40M131 0v40M137 0v40M140 0v40M145 0v40M149 0v40M152 0v40M158 0v40M162 0v40M165 0v40M170 0v40M174 0v40M177 0v40M183 0v40M186 0v40M191 0v40M195 0v40M198 0v40M204 0v40M208 0v40M211 0v40M217 0v40";

export function OrderingSteps({
  onlinePayments = SITE_CONFIG.onlinePayments,
}: {
  onlinePayments?: boolean;
}) {
  return (
    <section className="act act-steps" id="how" data-act="pin" aria-labelledby="how-title">
      <div className="stage">
        <div className="steps-col">
          <h2 className="h-display" id="how-title">
            How ordering works
          </h2>
          <ol className="steps">
            <li className="step is-active">
              <span className="step-dot" aria-hidden="true">
                1
              </span>
              <h3>Add your medicines, upload your prescription</h3>
              <p>
                Pick the exact brand and strength, then add a photo or PDF of a valid prescription.
                You can reuse one you’ve uploaded before.
              </p>
            </li>
            <li className="step">
              <span className="step-dot" aria-hidden="true">
                2
              </span>
              <h3>A pharmacist checks it</h3>
              <p>
                A registered pharmacist matches your order against the prescription before anything
                is packed. If it can’t be approved, we tell you why by SMS or email and refund your
                payment.
              </p>
            </li>
            <li className="step">
              <span className="step-dot" aria-hidden="true">
                3
              </span>
              <h3>We deliver it free</h3>
              <p>
                {onlinePayments
                  ? "Pay online or with cash on delivery."
                  : "Pay by cash on delivery."}{" "}
                Your order is packed and shipped to your door with no delivery charge.
              </p>
            </li>
          </ol>
          <span className="perf" aria-hidden="true">
            <span className="perf-fill" data-in="0 .9"></span>
          </span>
        </div>
        <div className="steps-vis">
          <figure className="vis vis-rx" data-out=".27 .38 in">
            <div className="doc">
              <p className="doc-tag">Example prescription</p>
              <div className="doc-head">
                <p className="doc-who">Prescriber’s name and qualification</p>
                <p className="doc-meta">Registration no. · Clinic address</p>
              </div>
              <div className="doc-row">
                <span>Patient</span>
                <span className="doc-line"></span>
                <span>Date</span>
                <span className="doc-line doc-line--s"></span>
              </div>
              <p className="doc-rx">Rx</p>
              <p className="doc-med">
                Sacuwin 100 <span>1 strip of 14 tablets</span>
              </p>
              <p className="doc-sign">
                <span className="doc-line"></span>
                Prescriber’s signature and stamp
              </p>
            </div>
            <p className="file-chip">
              <Icon name="upload" />
              <span>
                <b>prescription.jpg</b> Uploaded
              </span>
              <Icon name="check" />
            </p>
          </figure>
          <figure className="vis vis-log" data-in=".29 .41 out" data-out=".6 .71 in">
            <div className="log">
              <div className="log-head">
                <p className="doc-tag">Example order</p>
                <p className="log-items">Sacuwin 100 × 2</p>
              </div>
              <ol className="log-list">
                <li className="done">
                  <Icon name="check" />
                  <b>Order placed</b>
                  <span>{onlinePayments ? "Paid online" : "Cash on delivery"}</span>
                </li>
                <li className="done">
                  <Icon name="check" />
                  <b>Prescription uploaded</b>
                  <span>1 photo</span>
                </li>
                <li className="done">
                  <Icon name="check" />
                  <b>Rx under review</b>
                  <span>A pharmacist is checking it</span>
                </li>
                <li className="now">
                  <Icon name="check" />
                  <b>Rx approved</b>
                  <span>Matches your prescription</span>
                </li>
                <li>
                  <i></i>
                  <b>Confirmed</b>
                </li>
                <li>
                  <i></i>
                  <b>Packed</b>
                </li>
                <li>
                  <i></i>
                  <b>Shipped</b>
                </li>
                <li>
                  <i></i>
                  <b>Delivered</b>
                </li>
              </ol>
            </div>
          </figure>
          <figure className="vis vis-label" data-in=".62 .74 out">
            <div className="label">
              <p className="doc-tag">Example shipping label</p>
              <dl>
                <div className="label-to">
                  <dt>Deliver to</dt>
                  <dd>Your delivery address</dd>
                </div>
                <div>
                  <dt>From</dt>
                  <dd>{`${SITE_CONFIG.legalName}, Patparganj, New Delhi 110092`}</dd>
                </div>
                <div>
                  <dt>Contents</dt>
                  <dd>Sacuwin 100 × 2 · prescription checked</dd>
                </div>
                <div className="label-fee">
                  <dt>Delivery charge</dt>
                  <dd>₹0</dd>
                </div>
              </dl>
              <svg
                className="barcode"
                viewBox="0 0 220 40"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d={BARCODE} />
              </svg>
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
