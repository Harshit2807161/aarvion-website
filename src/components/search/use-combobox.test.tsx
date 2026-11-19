import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCombobox } from "./use-combobox";

function Harness({
  items,
  open = true,
  onChoose = () => {},
  onClose = () => {},
  onClear = () => {},
}: {
  items: string[];
  open?: boolean;
  onChoose?: (item: string) => void;
  onClose?: () => void;
  onClear?: () => void;
}) {
  const { active, inputProps, optionId, listId } = useCombobox({
    items,
    open,
    idPrefix: "s",
    onChoose,
    onClose,
    onClear,
  });
  return (
    <div>
      <input aria-label="search" {...inputProps} />
      <ul id={listId} role="listbox">
        {items.map((it, i) => (
          <li key={it} id={optionId(i)} role="option" aria-selected={i === active}>
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}

const box = () => screen.getByRole("combobox");
const key = (k: string) => fireEvent.keyDown(box(), { key: k });

describe("useCombobox", () => {
  it("wires the WAI-ARIA 1.2 attributes", () => {
    render(<Harness items={["a", "b"]} />);
    expect(box()).toHaveAttribute("aria-expanded", "true");
    expect(box()).toHaveAttribute("aria-controls", "s-list");
    expect(box()).toHaveAttribute("aria-autocomplete", "list");
    expect(box()).not.toHaveAttribute("aria-activedescendant");
  });

  it("is collapsed with no activedescendant when closed", () => {
    render(<Harness items={["a"]} open={false} />);
    expect(box()).toHaveAttribute("aria-expanded", "false");
    key("ArrowDown");
    expect(box()).not.toHaveAttribute("aria-activedescendant");
  });

  it("moves with the arrows, wraps both ways, and aria-activedescendant follows", () => {
    render(<Harness items={["a", "b", "c"]} />);
    key("ArrowDown");
    expect(box()).toHaveAttribute("aria-activedescendant", "s-opt-0");
    key("ArrowDown");
    key("ArrowDown");
    expect(box()).toHaveAttribute("aria-activedescendant", "s-opt-2");
    key("ArrowDown");
    expect(box()).toHaveAttribute("aria-activedescendant", "s-opt-0");
    key("ArrowUp");
    expect(box()).toHaveAttribute("aria-activedescendant", "s-opt-2");
    expect(screen.getByRole("option", { name: "c" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("option", { name: "a" })).toHaveAttribute("aria-selected", "false");
  });

  it("ArrowUp from nothing active lands on the last item", () => {
    render(<Harness items={["a", "b"]} />);
    key("ArrowUp");
    expect(box()).toHaveAttribute("aria-activedescendant", "s-opt-1");
  });

  it("Enter chooses the active item, or the first when none is active", () => {
    const onChoose = vi.fn();
    render(<Harness items={["a", "b"]} onChoose={onChoose} />);
    key("Enter");
    expect(onChoose).toHaveBeenLastCalledWith("a");
    key("ArrowDown");
    key("ArrowDown");
    key("Enter");
    expect(onChoose).toHaveBeenLastCalledWith("b");
  });

  it("Enter does nothing, and is not prevented, with no items or when closed", () => {
    const onChoose = vi.fn();
    const { rerender } = render(<Harness items={[]} onChoose={onChoose} />);
    expect(fireEvent.keyDown(box(), { key: "Enter" })).toBe(true);
    rerender(<Harness items={["a"]} open={false} onChoose={onChoose} />);
    expect(fireEvent.keyDown(box(), { key: "Enter" })).toBe(true);
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("Escape closes first, then clears", () => {
    const onClose = vi.fn();
    const onClear = vi.fn();
    const { rerender } = render(<Harness items={["a"]} onClose={onClose} onClear={onClear} />);
    key("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClear).not.toHaveBeenCalled();
    rerender(<Harness items={["a"]} open={false} onClose={onClose} onClear={onClear} />);
    key("Escape");
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("resets the active option when the items change or the list closes", () => {
    const { rerender } = render(<Harness items={["a", "b"]} />);
    key("ArrowDown");
    expect(box()).toHaveAttribute("aria-activedescendant", "s-opt-0");
    rerender(<Harness items={["c", "d"]} />);
    expect(box()).not.toHaveAttribute("aria-activedescendant");
  });
});
