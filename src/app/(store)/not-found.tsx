import type { Metadata } from "next";
import { NotFoundBody } from "@/components/shell/not-found-body";

export const metadata: Metadata = { title: "Page not found" };

/** A `notFound()` inside the `(store)` group (a category slug that does not exist): the `(store)` layout already supplies the chrome, so the root `not-found`, which adds its own, is not used. */
export default function StoreNotFound() {
  return <NotFoundBody />;
}
