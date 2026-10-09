import { cx } from './cx.ts';
import { MAX_STEP_SEGMENTS, normalizeProgress } from './progress.ts';

export type ProgressTone = 'light' | 'dark';
export type ProgressSize = 'xs' | 'sm' | 'md';

export interface ProgressBarProps {
  value: number;
  /** Upper bound, 100 by default (e.g. 30 countries). */
  max?: number;
  /** Accessible name, e.g. «Пройдено стран». */
  label: string;
  /** Human-readable value for screen readers, e.g. «8 из 30 стран». */
  valueText?: string;
  /** `bar` — a continuous bar; `steps` — `max` segments (cooking steps, onboarding questions). */
  variant?: 'bar' | 'steps';
  /** `light` — teal on a grey track; `dark` — amber on navy. */
  tone?: ProgressTone;
  /** Track height: `xs` — 4 px (onboarding segments), `sm` — 6 px, `md` — 10 px. */
  size?: ProgressSize;
  className?: string;
}

const trackTones: Record<ProgressTone, string> = {
  light: 'bg-track',
  dark: 'bg-navy-3',
};

const fillTones: Record<ProgressTone, string> = {
  light: 'bg-primary',
  dark: 'bg-amber',
};

const heights: Record<ProgressSize, string> = {
  xs: 'h-1',
  sm: 'h-1.5',
  md: 'h-2.5',
};

/** A progress indicator with `role="progressbar"` and `aria-valuenow/min/max/text`. */
export function ProgressBar({
  value,
  max = 100,
  label,
  valueText,
  variant = 'bar',
  tone = 'light',
  size = 'sm',
  className,
}: ProgressBarProps) {
  const progress = normalizeProgress(value, max);
  const segments = Math.round(progress.max);
  const asSteps = variant === 'steps' && segments > 0 && segments <= MAX_STEP_SEGMENTS;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={progress.max}
      aria-valuenow={progress.value}
      aria-valuetext={valueText}
      className={cx(
        asSteps ? 'flex gap-1.5' : 'overflow-hidden rounded-full',
        !asSteps && trackTones[tone],
        heights[size],
        className,
      )}
    >
      {asSteps ? (
        Array.from({ length: segments }, (_, index) => (
          <div
            key={index}
            data-filled={index < Math.floor(progress.value) ? '' : undefined}
            className={cx(
              'flex-1 rounded-full',
              index < Math.floor(progress.value) ? fillTones[tone] : trackTones[tone],
            )}
          />
        ))
      ) : (
        <div
          className={cx('h-full rounded-full transition-[width]', fillTones[tone])}
          style={{ width: `${String(progress.ratio * 100)}%` }}
        />
      )}
    </div>
  );
}
