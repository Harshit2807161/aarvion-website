import { ROUTES } from "../../src/config/routes";

/** The pages the site-wide e2e checks (links, copy) start from. Add a page here when its task lands. */
export const START_PAGES: string[] = [
  "/",
  ROUTES.category("cardiology"),
  ROUTES.category("urology"),
  ROUTES.contact,
  ROUTES.login,
  ...Object.values(ROUTES.legal),
  ROUTES.product("sacuwin-100"),
];
