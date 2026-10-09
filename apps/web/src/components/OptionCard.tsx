import type { ReactNode } from 'react';

import { cx } from './cx.ts';
import { IconCheck } from './icons.tsx';

export type OptionCardTone = 'dark' | 'light';

export interface OptionCardProps {
  /** `radio` — one answer of a group (same `name`); `checkbox` — any number of answers. */
  type: 'radio' | 'checkbox';
  name: string;
  value: string;
  /** Controlled state: the component never changes it by itself. */
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: ReactNode;
  /** Second line under the title («2 порции»). */
  description?: ReactNode;
  /** Leading decorative icon. */
  icon?: ReactNode;
  disabled?: boolean | undefined;
  /** `dark` — navy screens (onboarding), put inside `surface-dark`; `light` — white screens (profile). */
  tone?: OptionCardTone | undefined;
}

const tones: Record<
  OptionCardTone,
  { idle: string; selected: string; icon: string; iconSelected: string; description: string }
> = {
  dark: {
    idle: 'border-[1.5px] border-navy-3 bg-navy-2 text-white',
    selected: 'border-2 border-amber bg-navy-selected text-white',
    icon: 'text-on-dark',
    iconSelected: 'text-amber',
    description: 'text-on-dark-muted',
  },
  light: {
    idle: 'border-[1.5px] border-border bg-surface text-ink',
    selected: 'border-2 border-primary bg-primary-soft text-ink',
    icon: 'text-muted',
    iconSelected: 'text-primary',
    description: 'text-muted',
  },
};

/**
 * A large answer card: a native radio or checkbox inside a `label`, so the whole card (≥ 72 px
 * high) is the touch target and keyboard, focus and screen readers work natively. The state is
 * shown by the border, the check mark and (for checkboxes) the box — not by colour alone.
 */
export function OptionCard({
  type,
  name,
  value,
  checked,
  onChange,
  title,
  description,
  icon,
  disabled = false,
  tone = 'dark',
}: OptionCardProps) {
  const t = tones[tone];
  return (
    <label
      className={cx(
        'flex min-h-18 items-center gap-3.5 rounded-card px-4.5 py-3 text-left transition-colors',
        'outline-offset-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-(--focus-ring)',
        checked ? t.selected : t.idle,
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <input
        type={type}
        name={name}
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="sr-only"
      />
      {icon !== undefined && (
        <span className={cx('flex shrink-0', checked ? t.iconSelected : t.icon)}>{icon}</span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xl font-extrabold">{title}</span>
        {description !== undefined && (
          <span className={cx('text-sm', t.description)}>{description}</span>
        )}
      </span>
      {type === 'checkbox' ? (
        <span
          aria-hidden="true"
          className={cx(
            'flex size-6 shrink-0 items-center justify-center rounded-chip border-2',
            checked
              ? tone === 'dark'
                ? 'border-amber bg-amber text-ink'
                : 'border-primary bg-primary text-white'
              : // The empty box is the state indicator: ≥ 3:1 against the card (WCAG 1.4.11).
                tone === 'dark'
                ? 'border-on-dark-muted'
                : 'border-muted',
          )}
        >
          {checked && <IconCheck size={16} />}
        </span>
      ) : (
        checked && (
          <IconCheck
            size={24}
            className={cx('shrink-0', tone === 'dark' ? 'text-amber' : 'text-primary')}
          />
        )
      )}
    </label>
  );
}
