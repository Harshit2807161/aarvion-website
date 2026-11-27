import type { Metadata } from "next";
import { NotFoundBody } from "@/components/shell/not-found-body";

export const metadata: Metadata = { title: "Page not found" };

/** A `notFound()` inside `(store)`: the `(store)` layout already renders the chrome around this. */
export default function StoreNotFound() {
  return <NotFoundBody />;
}
