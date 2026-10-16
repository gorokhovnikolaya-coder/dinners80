import { useId, type ReactNode } from 'react';

import { cx } from './cx.ts';

export interface SwitchProps {
  /** Controlled state: the component never changes it by itself. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label — the accessible name of the switch. */
  label: ReactNode;
  /** Second line under the label, announced as the description. */
  description?: ReactNode;
  disabled?: boolean | undefined;
  /**
   * An action in progress (e.g. a Telegram permission popup is open): the switch announces
   * `aria-busy` and ignores presses, but stays focusable.
   */
  busy?: boolean | undefined;
  className?: string;
}

/**
 * An on/off setting on a light screen: a native `input type="checkbox" role="switch"` inside a
 * `label`, so the whole row (≥ 44 px high) is the touch target and keyboard and screen readers
 * work natively. The state is shown by the knob position and the track colour, not by colour alone.
 */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
  busy = false,
  className,
}: SwitchProps) {
  const labelId = useId();
  const descriptionId = useId();
  return (
    <label
      className={cx(
        'flex min-h-11 items-center gap-4',
        disabled ? 'cursor-not-allowed' : busy ? 'cursor-progress' : 'cursor-pointer',
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span id={labelId} className="text-xl font-extrabold text-ink">
          {label}
        </span>
        {description !== undefined && (
          <span id={descriptionId} className="text-sm text-muted">
            {description}
          </span>
        )}
      </span>
      {/* The native input lies, invisible, over the drawn track (60 × 44): a tap on it hits the input. */}
      <span className="relative flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          checked={checked}
          disabled={disabled}
          aria-busy={busy || undefined}
          // The label alone names the switch; the second line is its description.
          aria-labelledby={labelId}
          aria-describedby={description === undefined ? undefined : descriptionId}
          onChange={(event) => {
            if (!busy) onChange(event.target.checked);
          }}
          className="peer absolute -top-1.5 -left-1 z-10 m-0 h-11 w-15 cursor-[inherit] opacity-0"
        />
        <span
          aria-hidden="true"
          className={cx(
            'flex h-8 w-13 items-center rounded-full p-1 transition-colors',
            'outline-offset-2 peer-focus-visible:outline-2 peer-focus-visible:outline-(--focus-ring)',
            // The off track is the state indicator too: muted is ≥ 3:1 on white (WCAG 1.4.11).
            checked ? 'bg-primary' : 'bg-muted',
            'peer-disabled:bg-border',
            busy && 'opacity-70',
          )}
        >
          <span
            className={cx(
              'size-6 rounded-full bg-white shadow-card transition-transform motion-reduce:transition-none',
              checked && 'translate-x-5',
            )}
          />
        </span>
      </span>
    </label>
  );
}
