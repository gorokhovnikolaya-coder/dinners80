import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { cx } from './cx.ts';

export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'inverse';
export type ButtonSize = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * `primary` — teal action; `accent` — the main orange CTA of a screen; `secondary` — outline;
   * `ghost` — text-only; `inverse` — amber CTA on dark (navy) screens; put it inside a `surface-dark` container
   * (e.g. `Card tone="inverse"`) so the focus ring turns amber.
   */
  variant?: ButtonVariant;
  /** `md` — 48 px high, `lg` — 56 px (bottom-bar actions). */
  size?: ButtonSize;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Leading icon (decorative; the text is the accessible name). */
  icon?: ReactNode;
}

const base =
  'inline-flex min-w-11 select-none items-center justify-center gap-2.5 rounded-button ' +
  'font-sans transition-colors disabled:cursor-not-allowed';

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-primary font-extrabold text-white enabled:hover:bg-primary-strong enabled:active:bg-primary-strong',
  accent:
    'bg-accent font-extrabold text-white enabled:hover:bg-accent-strong enabled:active:bg-accent-strong',
  secondary:
    'border-[1.5px] border-border bg-transparent font-bold text-ink enabled:hover:bg-track/60 enabled:active:bg-track',
  ghost: 'bg-transparent font-bold text-primary enabled:hover:bg-primary-soft',
  inverse:
    'bg-amber font-extrabold text-ink enabled:hover:brightness-105 enabled:active:brightness-95',
};

// Disabled controls are exempt from WCAG contrast, but the pair still passes 4.5:1 (muted on track).
const disabled = 'disabled:border-transparent disabled:bg-track disabled:text-muted';

const sizes: Record<ButtonSize, string> = {
  md: 'min-h-12 px-5 text-lg',
  lg: 'min-h-14 px-6 text-xl',
};

/** A text button. The touch target is at least 44 × 44 px in every size. */
export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx(
        base,
        variants[variant],
        disabled,
        sizes[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export type IconButtonVariant = 'surface' | 'outline' | 'muted' | 'dark';

export interface IconButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'children' | 'aria-label'
> {
  /** Accessible name — required, the button has no visible text. */
  label: string;
  icon: ReactNode;
  /**
   * `surface` — round white (back over a photo); `outline` — bordered square (cart in the bottom
   * bar); `muted` — round on white screens; `dark` — round on navy screens.
   */
  variant?: IconButtonVariant;
  /** `md` — 44 × 44 px, `lg` — 56 × 56 px. */
  size?: ButtonSize;
}

const iconVariants: Record<IconButtonVariant, string> = {
  surface: 'rounded-full bg-surface text-ink enabled:hover:bg-bg',
  outline:
    'rounded-button border-[1.5px] border-border bg-transparent text-ink enabled:hover:bg-track/60',
  muted: 'rounded-full bg-bg text-ink enabled:hover:bg-track',
  dark: 'rounded-full bg-navy-2 text-border enabled:hover:bg-navy-3',
};

const iconSizes: Record<ButtonSize, string> = {
  md: 'size-11',
  lg: 'size-14',
};

/** An icon-only button with a required `aria-label`. */
export function IconButton({
  label,
  icon,
  variant = 'surface',
  size = 'md',
  type = 'button',
  className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={cx(
        'inline-flex shrink-0 items-center justify-center transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        iconVariants[variant],
        iconSizes[size],
        className,
      )}
      {...rest}
    >
      {icon}
    </button>
  );
}
