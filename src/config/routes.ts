/**
 * The storefront route map. Link through these so a rename is one edit. Pages that do not
 * exist yet are listed in PENDING_ROUTES: e2e/links.spec.ts expects them to 404 until the
 * task that builds them removes the entry.
 */
export const ROUTES = {
  home: "/",
  medicines: "/#medicines",
  login: "/login",
  cart: "/cart",
  account: "/account",
  uploadRx: "/account/prescriptions",
  contact: "/contact",
  /** Sections of the home page. */
  how: "/#how",
  questions: "/#questions",
  faqWin2age: "/#faq-win2age",
  category: (slug: string) => `/category/${slug}`,
  product: (slug: string) => `/product/${slug}`,
  legal: {
    privacy: "/legal/privacy",
    terms: "/legal/terms",
    returns: "/legal/returns-cancellation",
    shipping: "/legal/shipping",
    prescription: "/legal/prescription-policy",
    grievance: "/legal/grievance",
  },
} as const;

/** Linked from the chrome but not built yet; each owning task deletes its entry. */
export const PENDING_ROUTES = [
  "/cart",
  "/account",
  "/account/prescriptions",
] as const;

/**
 * Ids of home-page sections that links already point at (`ROUTES.questions`, `ROUTES.faqWin2age`)
 * but no task has built yet (none today: the FAQ added `questions` and `faq-win2age`). e2e/anchors.spec.ts expects each to be missing; the task that adds
 * the element deletes its entry.
 */
export const PENDING_ANCHORS: readonly string[] = [];
