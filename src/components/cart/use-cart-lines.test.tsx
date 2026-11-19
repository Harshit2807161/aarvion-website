import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { cartStore } from "@/lib/cart/store";
import { useCartLines } from "@/lib/cart/use-cart-lines";

let renders = 0;
function Probe() {
  renders++;
  return <p>{JSON.stringify(useCartLines())}</p>;
}

describe("useCartLines", () => {
  beforeEach(() => {
    sessionStorage.clear();
    cartStore.reset();
    renders = 0;
  });

  it("renders the stored cart, re-renders on dispatch and does not loop", () => {
    sessionStorage.setItem("aarv-cart-ui-v0", JSON.stringify({ a: 1 }));
    const { container } = render(<Probe />);
    expect(container.textContent).toBe('{"a":1}');
    const first = renders;
    expect(first).toBeLessThan(5);
    act(() => void cartStore.dispatch({ type: "inc", slug: "a" }));
    expect(container.textContent).toBe('{"a":2}');
    expect(renders).toBe(first + 1);
  });
});
