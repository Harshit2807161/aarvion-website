import { Icon } from "@/components/base/icon";
import { ROUTES } from "@/config/routes";
import { pocketImage, plural } from "@/lib/catalogue/display";
import { bentoTiles, type HomeModel } from "@/lib/catalogue/home-model";

/**
 * "Shop by category": the static composition of the home page's category act (spec C3), the
 * markup of design/prototype/src/index.src.html (`#areas`). A bento of tiles, each a link to a
 * category page over the products' own cutouts, then a dashed "Coming soon" tile. The names come
 * from the catalogue (Heart care, Eye care ...), the counts and lists from the data; nothing is
 * claimed beyond them. Styles are in src/styles/bento.css.
 *
 * The scroll film (Task 28) animates this markup without changing it: the engine in
 * src/components/film/engine.ts reads `data-act="pass"` on the section and the `data-in` ranges
 * ("start end in|out") on the tiles, which set `--ti` for the rise from depth. Do not rename them.
 */
const TILE_IN = [".02 .25 out", ".06 .29 out", ".1 .32 out", ".13 .35 out"] as const;
/**
 * Ranges for tiles beyond the four the prototype staggers: they keep the last stagger, so a
 * fifth live category rises with the fourth (and `.tile-soon`, fixed at .16 .37, may start first).
 * Extend TILE_IN together with `.tile-soon` when the layout gains a tile.
 */
const tileIn = (i: number) => TILE_IN[Math.min(i, TILE_IN.length - 1)];

export function CategoryBento({ model }: { model: HomeModel }) {
  const tiles = bentoTiles(model);
  return (
    <section className="act areas" id="areas" data-act="pass" aria-labelledby="areas-title">
      <div className="wrap">
        <div className="sec-head">
          <h2 className="h-section" id="areas-title">
            Shop by category
          </h2>
        </div>
        <div className="bento">
          {tiles.map((t, i) => (
            <a
              key={t.category.slug}
              className={`tile ${t.tile}`}
              href={ROUTES.category(t.category.slug)}
              data-in={tileIn(i)}
            >
              <span className="tile-in">
                <span className="tile-text">
                  <span className="tile-name">{t.category.name}</span>
                  <span className="tile-count">{plural(t.count, "medicine")}</span>
                  <span className="tile-list">{t.list}</span>
                </span>
                <span className="tile-art" aria-hidden="true">
                  {t.art.map((p, n) => {
                    const img = pocketImage(p);
                    return (
                      // eslint-disable-next-line @next/next/no-img-element -- pre-optimised, content-hashed webp
                      <img
                        key={p.slug}
                        className={`ta ta-${n + 1}`}
                        src={img.src}
                        width={img.width}
                        height={img.height}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                    );
                  })}
                </span>
                <span className="tile-go">
                  <Icon name="arrow" />
                </span>
              </span>
            </a>
          ))}
          {model.comingSoon.length > 0 && (
            <div className="tile tile-soon" data-in=".16 .37 out">
              <p className="tile-count">Coming soon</p>
              <ul>
                {model.comingSoon.map((c) => (
                  <li key={c.slug}>{c.name}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
