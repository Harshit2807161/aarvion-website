import type { CSSProperties } from "react";
import { buttonClass, ButtonLink } from "@/components/base/button";
import { Pocket } from "@/components/catalogue/pocket";
import { ROUTES } from "@/config/routes";
import { plural } from "@/lib/catalogue/display";
import { railPlan, type HomeModel } from "@/lib/catalogue/home-model";
import { RailControls } from "./rail-controls";
import { SearchCardLink } from "./search-card-link";

/**
 * The home's product rails (spec C3, v2 prototype index.html "Product rails"): one strip of foil
 * pockets per category, each as long as its pockets, with the single-product categories sharing
 * a last strip beside a "looking for another medicine?" card. Styles: src/styles/rails.css.
 *
 * `#medicines` is the home's anchor for the skip link, the banner and the footer; each rail's
 * `id` is `categoryAnchor(name)`, and a category folded into the shared rail keeps an empty
 * `span.anchor` with its own id so its links still land. `data-act="pass"` and `data-in` are the
 * scroll film's hooks (Task 28); `[data-rail-controls]` holds `RailControls` (the arrows and
 * "View all"). Every pocket image is lazy: the banner's first slide is the LCP.
 * No live region here: cart changes are spoken by the page's one `#live` region.
 */
export function Rails({ model }: { model: HomeModel }) {
  const rails = railPlan(model);
  return (
    <div className="meds wrap" id="medicines">
      {rails.map((rail) => (
        <section
          key={rail.id}
          className="rail"
          id={rail.id}
          aria-labelledby={`rail-${rail.id}`}
          data-act="pass"
          data-in="0 .4 out"
          style={{ "--rise": `${rail.rise}px` } as CSSProperties}
        >
          {rail.extraIds.map((id) => (
            <span key={id} className="anchor" id={id} />
          ))}
          <div className="rail-head">
            <h2 className="h-section" id={`rail-${rail.id}`}>
              {rail.title}
            </h2>
            <p className="rail-count">{plural(rail.products.length, "medicine")}</p>
            <div data-rail-controls="">
              <RailControls railId={rail.id} title={rail.title} count={rail.products.length} />
            </div>
          </div>
          <div className="rail-body">
            <div className="rail-strip">
              <ul
                className="rail-row"
                id={`row-${rail.id}`}
                style={{ "--n": rail.products.length } as CSSProperties}
              >
                {rail.products.map((p) => (
                  <Pocket key={p.slug} product={p} heading="h3" />
                ))}
              </ul>
            </div>
            {rail.aside && (
              <aside className="rail-aside">
                <h3>Looking for another Aarvion medicine?</h3>
                <p>
                  More of Aarvion’s medicines are being added to the store. Search by brand or salt,
                  or get in touch.
                </p>
                <div className="rail-aside-act">
                  <SearchCardLink href="#q" className={buttonClass({ variant: "forest" })}>
                    Search medicines
                  </SearchCardLink>
                  <ButtonLink href={ROUTES.contact} variant="quiet">
                    Contact us
                  </ButtonLink>
                </div>
              </aside>
            )}
          </div>
        </section>
      ))}
      {model.allRx && (
        <p className="meds-note">
          All {model.total} medicines need a valid prescription. Each price is the MRP printed on
          the pack, less ₹20.
        </p>
      )}
    </div>
  );
}
