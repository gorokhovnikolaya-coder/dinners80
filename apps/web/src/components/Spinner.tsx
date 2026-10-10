import { cx } from './cx.ts';

export type SpinnerSize = 'sm' | 'md';

export interface SpinnerProps {
  /** `sm` — 16 px, `md` — 20 px (the icon size of `Button`). */
  size?: SpinnerSize;
  className?: string;
}

const sizes: Record<SpinnerSize, string> = {
  sm: 'size-4',
  md: 'size-5',
};

/**
 * A decorative progress ring (`aria-hidden`) in the current text colour, with a transparent gap
 * (no `color-mix`, so it also spins visibly in old WebViews). The busy state itself is
 * announced by the owner (`aria-busy`, a status text), e.g. `Button loading`. The rotation is
 * dropped with `prefers-reduced-motion`.
 */
export function Spinner({ size = 'md', className }: SpinnerProps) {
  return (
    <span
      aria-hidden="true"
      data-spinner=""
      className={cx(
        'inline-block shrink-0 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin',
        sizes[size],
        className,
      )}
    />
  );
}
