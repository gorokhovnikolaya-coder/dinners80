import type { ReactNode } from 'react';

import { cx } from './cx.ts';

export interface CheckboxProps {
  /** Controlled state: the component never changes it by itself. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Main text of the row (ingredient, product). */
  label: ReactNode;
  /** Second line under the label (e.g. the dish of a shopping item). */
  description?: ReactNode;
  /** Right-aligned value (quantity). */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Strike the label through when checked (shopping list); otherwise it is only dimmed. */
  strikeWhenChecked?: boolean;
  /** Draw a divider above the row, as in lists inside a card. */
  divider?: boolean;
  name?: string;
  className?: string;
}

/**
 * A native `input type="checkbox"` inside a `label`: the whole row (≥ 44 px high) is the touch
 * target, keyboard and screen readers work out of the box.
 */
export function Checkbox({
  checked,
  onChange,
  label,
  description,
  trailing,
  disabled = false,
  strikeWhenChecked = false,
  divider = false,
  name,
  className,
}: CheckboxProps) {
  return (
    <label
      className={cx(
        // The whole row is the touch target, so it also carries the focus ring.
        'flex min-h-11 items-center gap-3 py-1.5 text-base outline-offset-2 has-[input:focus-visible]:rounded-tile',
        'has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-(--focus-ring)',
        disabled ? 'cursor-not-allowed text-muted' : 'cursor-pointer',
        divider && 'border-t border-divider',
        className,
      )}
    >
      <input
        type="checkbox"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="size-5.5 shrink-0 cursor-[inherit] accent-primary focus-visible:outline-none"
      />
      <span className="flex min-w-0 flex-1 flex-col">
        <span
          className={cx(
            checked || disabled ? 'text-muted' : 'text-ink',
            checked && strikeWhenChecked && 'line-through',
            description !== undefined && 'font-bold',
          )}
        >
          {label}
        </span>
        {description !== undefined && (
          <span className="text-xs font-semibold text-muted">{description}</span>
        )}
      </span>
      {trailing !== undefined && (
        <span className="shrink-0 text-md font-semibold text-muted">{trailing}</span>
      )}
    </label>
  );
}
