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
  "/category/cardiology",
  "/category/diabetology",
  "/category/ophthalmology",
  "/category/respiratory",
] as const;
