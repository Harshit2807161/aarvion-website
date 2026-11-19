import type { Metadata } from "next";
import { connection } from "next/server";
import { RxBadge, StatusTag, type StatusTone } from "@/components/base/badge";
import { Button, ButtonLink, type ButtonSize, type ButtonVariant } from "@/components/base/button";
import { ICON_NAMES, Icon } from "@/components/base/icon";
import { PriceInline, StampPrice } from "@/components/base/stamp-price";
import { requireDevRoute } from "@/server/dev-only";

export const metadata: Metadata = { title: "Styleguide (dev)", robots: { index: false } };

// `instant = false` is the documented Next 16 opt-out for Cache Components' instant-navigation
// check: connection() must run before the guard, so this page blocks instead of prerendering.
// The real 404 status for production comes from src/proxy.ts; requireDevRoute() is the backstop.
export const instant = false;

const VARIANTS: ButtonVariant[] = [
  "sand",
  "forest",
  "quiet",
  "ghost",
  "danger",
  "danger-quiet",
  "link",
];
const SIZES: ButtonSize[] = ["sm", "md", "lg"];
const TONES: StatusTone[] = ["ok", "wait", "hold", "bad", "off", "done"];
const MRPS = [40700, 20900, 117900];

function ButtonGrid() {
  return (
    <div className="flex flex-col gap-3">
      {VARIANTS.map((variant) => (
        <div className="flex flex-wrap items-center gap-3" key={variant}>
          <code>{variant}</code>
          {SIZES.map((size) => (
            <Button key={size} variant={variant} size={size} icon="plus">
              {size}
            </Button>
          ))}
          <Button variant={variant} disabled>
            Disabled
          </Button>
          <Button variant={variant} busy="Sending code…">
            Send
          </Button>
          <ButtonLink variant={variant} href="/dev/styleguide">
            Link
          </ButtonLink>
        </div>
      ))}
    </div>
  );
}

/** Dev-only page: every base component on one screen, for visual review. 404s when mocks are forbidden. */
export default async function StyleguidePage() {
  await connection();
  requireDevRoute();
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-6">
      <h1 className="h-section">Styleguide</h1>

      <section aria-labelledby="sg-buttons">
        <h2 className="mb-4 text-lg font-semibold" id="sg-buttons">
          Buttons on white
        </h2>
        <ButtonGrid />
      </section>

      <section
        aria-labelledby="sg-buttons-forest"
        data-ground="forest"
        className="rounded-[16px] bg-forest-800 p-6 text-white"
      >
        <h2 className="mb-4 text-lg font-semibold" id="sg-buttons-forest">
          Buttons on forest
        </h2>
        <ButtonGrid />
      </section>

      <section aria-labelledby="sg-rx">
        <h2 className="mb-4 text-lg font-semibold" id="sg-rx">
          Rx badge
        </h2>
        <p>
          Crocin <RxBadge /> <RxBadge size="lg" />
        </p>
      </section>

      <section aria-labelledby="sg-tags">
        <h2 className="mb-4 text-lg font-semibold" id="sg-tags">
          Status tags
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {TONES.map((tone) => (
            <StatusTag key={tone} tone={tone}>
              {tone}
            </StatusTag>
          ))}
        </div>
      </section>

      <section aria-labelledby="sg-stamp">
        <h2 className="mb-4 text-lg font-semibold" id="sg-stamp">
          Stamp price
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {MRPS.map((mrp) => (
            <StampPrice key={mrp} mrpPaise={mrp} />
          ))}
        </div>
        <h3 className="mt-6 mb-3 font-semibold">Inline price</h3>
        <div className="flex flex-wrap items-center gap-3">
          {MRPS.map((mrp) => (
            <PriceInline key={mrp} mrpPaise={mrp} />
          ))}
        </div>
      </section>

      <section aria-labelledby="sg-icons">
        <h2 className="mb-4 text-lg font-semibold" id="sg-icons">
          Icons
        </h2>
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(110px,1fr))] gap-4">
          {ICON_NAMES.map((name) => (
            <li key={name} className="flex flex-col items-center gap-1 text-xs">
              <Icon name={name} size={28} />
              <code>{name}</code>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
