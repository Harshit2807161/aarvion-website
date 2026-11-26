import { BrandMark } from "@/components/base/brand-mark";
import { ButtonLink, buttonClass } from "@/components/base/button";
import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import { SearchCardLink } from "./search-card-link";

/**
 * The closing act (spec C3), static: the logo on forest with the last call to action. The owner
 * asked to keep the "logo pan in at the end"; the motion is the film's (Task 28), not this file's.
 * The hooks the engine in src/components/film/engine.ts reads are `data-act="pin"` and `data-lead`
 * on the section, `.stage` inside it, and the `data-in` ranges on `.close-swoosh` ("0 .62 io", the
 * logo's pan-in) and `.close-copy` (".56 .84 out"). The engine sets `measuring` on its own root,
 * never on `html`. Do not rename them. The logo is the vector asset in public/brand through
 * `BrandMark` (reversed, for forest ground); it is decoration here (`alt=""`, hidden), the heading
 * carries the section. "Search medicines" goes to the header search field (`#q`) like the quick
 * actions' search card. Styles are in src/styles/faq-close.css.
 */
export function Close() {
  return (
    <section className="act act-close" id="close" data-act="pin" data-lead aria-labelledby="close-title">
      <div className="stage">
        <div className="field" aria-hidden="true"></div>
        <div className="close-swoosh" aria-hidden="true" data-in="0 .62 io">
          <BrandMark variant="reversed" height={64} alt="" loading="lazy" />
        </div>
        <div className="close-copy" data-in=".56 .84 out">
          <h2 className="h-display" id="close-title">
            Ready when your prescription is.
          </h2>
          <p className="lead">
            Find your medicine, add it to your cart and upload a photo or PDF of your prescription.
          </p>
          <div className="close-actions">
            <ButtonLink variant="sand" size="lg" icon="upload" href={ROUTES.uploadRx}>
              <span>Upload prescription</span>
            </ButtonLink>
            <SearchCardLink href="#q" className={buttonClass({ variant: "ghost", size: "lg" })}>
              <Icon name="search" size={18} />
              <span>Search medicines</span>
            </SearchCardLink>
          </div>
        </div>
      </div>
    </section>
  );
}
