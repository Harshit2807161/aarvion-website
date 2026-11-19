import { cn } from "@/lib/cn";

/**
 * The storefront icon set: the prototype's sprite symbols (index.src.html plus the login
 * page's additions), one inline SVG each, so no sprite sheet has to be mounted in the page.
 * `hold` follows the index page; the login page draws it slightly differently.
 * Strokes use currentColor; colour and default size come from the `.i` rule in base.css.
 */
const GLYPHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4.5M7.5 9 12 4.5 16.5 9" />
      <path d="M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </>
  ),
  cart: (
    <>
      <path d="M3.5 4.5h2l2.1 10.2a1.5 1.5 0 0 0 1.5 1.2h7.6a1.5 1.5 0 0 0 1.5-1.1L19.8 8H6.4" />
      <circle cx="10" cy="19.6" r="1.1" />
      <circle cx="17" cy="19.6" r="1.1" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M5 19.5c1.2-3.3 3.9-5 7-5s5.8 1.7 7 5" />
    </>
  ),
  arrow: (
    <>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </>
  ),
  back: (
    <>
      <path d="M19 12H5M11 6l-6 6 6 6" />
    </>
  ),
  go: (
    <>
      <path d="m9.5 6 6 6-6 6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5.5v13M5.5 12h13" />
    </>
  ),
  minus: (
    <>
      <path d="M5.5 12h13" />
    </>
  ),
  check: (
    <>
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </>
  ),
  chev: (
    <>
      <path d="m6 9.5 6 6 6-6" />
    </>
  ),
  hold: (
    <>
      <path d="M9.5 7v10M14.5 7v10" />
    </>
  ),
  play: (
    <>
      <path d="M8.5 6.6v10.8c0 .5.5.8.9.5l8-5.4c.4-.3.4-.8 0-1.1l-8-5.3c-.4-.3-.9 0-.9.5z" />
    </>
  ),
  file: (
    <>
      <path d="M14 3.5H7.5c-1.1 0-2 .9-2 2v13c0 1.1.9 2 2 2h9c1.1 0 2-.9 2-2V8z" />
      <path d="M14 3.5V8h4.5M9 13h6M9 16.5h4" />
    </>
  ),
  box: (
    <>
      <path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4z" />
      <path d="m4 7.5 8 4 8-4M12 11.5v9" />
    </>
  ),
  chat: (
    <>
      <path d="M5 6.5c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2h-5.5L8 18.8v-3.3H7c-1.1 0-2-.9-2-2z" />
      <path d="M9 9.5h6M9 12h3.5" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3.5l6.5 2.5v5.5c0 4-2.8 7.4-6.5 9-3.7-1.6-6.5-5-6.5-9V6z" />
      <path d="m9.2 12 2 2 3.8-3.8" />
    </>
  ),
  pharm: (
    <>
      <path d="M9 4.5h6v2.5H9z" />
      <path d="M15 5.5h2c.8 0 1.5.7 1.5 1.5v12c0 .8-.7 1.5-1.5 1.5H7c-.8 0-1.5-.7-1.5-1.5V7c0-.8.7-1.5 1.5-1.5h2" />
      <path d="m9 13.5 2 2 4-4" />
    </>
  ),
  truck: (
    <>
      <path d="M3.5 16.5V7c0-.6.4-1 1-1h8.5c.6 0 1 .4 1 1v9.5M14 9.5h3.4l3.1 3.6v3.4h-1.7M8.6 16.5h6.8" />
      <circle cx="6.8" cy="16.8" r="1.8" />
      <circle cx="17" cy="16.8" r="1.8" />
    </>
  ),
  cash: (
    <>
      <rect x="3" y="6.5" width="18" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.4" />
      <path d="M6.5 9.5v.2M17.5 14.3v.2" />
    </>
  ),
  menu: (
    <>
      <path d="M4 8.5h16M4 15.5h16" />
    </>
  ),
  close: (
    <>
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5v5.5M12 16.3v.2" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.7v.2" />
    </>
  ),
  phone: (
    <>
      <rect x="7" y="3.5" width="10" height="17" rx="2.2" />
      <path d="M11 17.5h2" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" />
      <path d="m4.5 7 7.5 6 7.5-6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
} as const;

export type IconName = keyof typeof GLYPHS;

/** Every icon name, for tests and galleries. */
export const ICON_NAMES = Object.keys(GLYPHS) as IconName[];

export type IconSize = 18 | 20 | 22 | 28;

export function Icon({
  name,
  className,
  size = 20,
}: {
  name: IconName;
  className?: string;
  size?: IconSize;
}) {
  return (
    <svg
      className={cn("i", className)}
      width={size}
      height={size}
      style={{ "--i-size": `${size}px` } as React.CSSProperties}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {GLYPHS[name]}
    </svg>
  );
}
