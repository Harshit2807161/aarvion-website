import type { Category } from "./schema.ts";

export const CATEGORY_LIST: readonly Category[] = [
  { slug: "cardiology", name: "Cardiology", status: "live", sortOrder: 1 },
  { slug: "diabetology", name: "Diabetology", status: "live", sortOrder: 2 },
  { slug: "ophthalmology", name: "Eye care", status: "live", sortOrder: 3 },
  { slug: "respiratory", name: "Respiratory", status: "live", sortOrder: 4 },
  { slug: "gastroenterology", name: "Gastroenterology", status: "coming_soon", sortOrder: 5 },
  { slug: "orthopaedics", name: "Orthopaedics", status: "coming_soon", sortOrder: 6 },
  { slug: "urology", name: "Urology", status: "coming_soon", sortOrder: 7 },
  { slug: "pain-management", name: "Pain Management", status: "hidden", sortOrder: 8 },
];
