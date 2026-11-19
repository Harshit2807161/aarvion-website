"use client";

import { Button } from "@/components/base/button";
import { toast } from "@/components/feedback/toast";

/** Styleguide demo: the customer toast, plain and with an action. */
export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-3">
      <Button onClick={() => toast("Added to cart")}>Show toast</Button>
      <Button
        variant="quiet"
        onClick={() =>
          toast("Removed from cart", { action: "Undo", onAction: () => toast("Restored") })
        }
      >
        Toast with Undo
      </Button>
    </div>
  );
}
