import { type CSSProperties, type KeyboardEvent, useRef } from "react";
import { Icon, type IconName } from "@/components/base/icon";

export type SegmentedOption<T extends string> = { value: T; label: string; icon?: IconName };

/**
 * A segmented control built from native radios, so arrow keys and form posts work for free.
 * The thumb is placed by `--i` (selected index) and `--n` (count), so any number of options works.
 * Left-to-right only: the arrows and the thumb are not mirrored for RTL.
 * `name` also prefixes each radio id. Keyboard: arrows move and select (wrapping), Home and End
 * jump to the first and last option, and only the selected radio is in the tab order.
 */
export function Segmented<T extends string>({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  /** Names the group for assistive tech; visually hidden. */
  legend: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const ref = useRef<HTMLFieldSetElement>(null);
  const current = options.findIndex((o) => o.value === value);

  function onKeyDown(e: KeyboardEvent<HTMLFieldSetElement>) {
    // Leave Alt/Cmd/Ctrl/Shift combinations (browser back/forward, shortcuts) to the browser.
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    const last = options.length - 1;
    const target =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? (current + 1) % options.length
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? (current - 1 + options.length) % options.length
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : -1;
    if (target < 0) return;
    e.preventDefault();
    const next = options[target];
    if (!next) return;
    onChange(next.value);
    ref.current?.querySelectorAll<HTMLInputElement>("input.seg-input")[target]?.focus();
  }

  return (
    <fieldset
      ref={ref}
      className="seg"
      style={{ "--n": options.length, "--i": Math.max(current, 0) } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      <legend className="sr-only">{legend}</legend>
      {options.map((o, i) => (
        <SegItem
          key={o.value}
          name={name}
          option={o}
          checked={o.value === value}
          tabbable={current < 0 ? i === 0 : o.value === value}
          onChange={onChange}
        />
      ))}
      <span className="seg-thumb" aria-hidden="true" />
    </fieldset>
  );
}

function SegItem<T extends string>({
  name,
  option,
  checked,
  tabbable,
  onChange,
}: {
  name: string;
  option: SegmentedOption<T>;
  checked: boolean;
  /** Roving tabindex: the selected radio, or the first when `value` matches no option. */
  tabbable: boolean;
  onChange: (value: T) => void;
}) {
  const id = `${name}-${option.value}`;
  return (
    <>
      <input
        className="seg-input"
        type="radio"
        name={name}
        id={id}
        tabIndex={tabbable ? 0 : -1}
        value={option.value}
        checked={checked}
        onChange={() => onChange(option.value)}
      />
      <label className="seg-opt" htmlFor={id}>
        {option.icon ? <Icon name={option.icon} size={18} /> : null}
        {option.label}
      </label>
    </>
  );
}
