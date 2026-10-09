import type { ReactNode } from 'react';

import { cx } from './cx.ts';
import { IconCheck } from './icons.tsx';

export type ChipTone = 'neutral' | 'primary' | 'accent' | 'badge';

interface StaticChipProps {
  children: ReactNode;
  /**
   * `neutral` — grey tag («30 мин»); `primary` — teal tag («Будний вечер»); `accent` — orange tag
   * («Новая страна» in text); `badge` — solid orange pill over a photo.
   */
  tone?: ChipTone;
  icon?: ReactNode;
  className?: string;
  selected?: never;
  onToggle?: never;
  disabled?: never;
}

interface ToggleChipProps {
  children: ReactNode;
  /** Current state: rendered as `aria-pressed` and a check mark, not by colour alone. */
  selected: boolean;
  onToggle: (selected: boolean) => void;
  disabled?: boolean;
  icon?: ReactNode;
  className?: string;
  tone?: never;
}

export type ChipProps = StaticChipProps | ToggleChipProps;

const tones: Record<ChipTone, string> = {
  neutral: 'rounded-chip bg-bg px-2.5 py-1.5 text-sm font-semibold text-ink-2',
  primary: 'rounded-chip bg-primary-soft px-2.5 py-1.5 text-sm font-semibold text-primary-strong',
  accent: 'rounded-full bg-accent-soft px-2 py-1 text-2xs font-extrabold text-accent-strong',
  badge: 'rounded-full bg-accent px-2.5 py-1.5 text-xs font-extrabold text-white',
};

/**
 * A tag (static, without `onToggle`) or a toggle chip (`selected` + `onToggle`) — a real
 * `button` with `aria-pressed` and a 44 px touch target.
 */
export function Chip(props: ChipProps) {
  if (props.onToggle === undefined) {
    const { children, tone = 'neutral', icon, className } = props;
    return (
      <span className={cx('inline-flex items-center gap-1', tones[tone], className)}>
        {icon}
        {children}
      </span>
    );
  }

  const { children, selected, onToggle, disabled, icon, className } = props;
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => {
        onToggle(!selected);
      }}
      className={cx(
        'inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-tile border-[1.5px] px-4',
        'text-base transition-colors disabled:cursor-not-allowed disabled:border-transparent disabled:bg-track disabled:text-muted',
        selected
          ? 'border-primary bg-primary-soft font-bold text-primary-strong'
          : 'border-border bg-surface font-semibold text-ink enabled:hover:bg-bg',
        className,
      )}
    >
      {selected ? <IconCheck size={18} /> : icon}
      {children}
    </button>
  );
}
