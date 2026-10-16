import { ru } from '../i18n/ru.ts';
import { Button } from './Button.tsx';
import { cx } from './cx.ts';
import { IconAlert, IconRefresh } from './icons.tsx';

export interface ErrorStateProps {
  /** Announced via `role="alert"`. Defaults to «Не удалось загрузить данные.». */
  title?: string;
  description?: string;
  /** Shows the «Повторить» button. */
  onRetry?: () => void;
  /** Defaults to «Повторить». */
  retryLabel?: string;
  /** Disables the button while a retry is in flight. */
  retrying?: boolean;
  /**
   * `light` — on light screens; `dark` — on navy screens (the paywall): put it inside a
   * `surface-dark` container so the focus ring turns amber.
   */
  tone?: 'light' | 'dark';
  className?: string;
}

/** The error state of a screen or a block, with an optional retry. */
export function ErrorState({
  title = ru.common.error,
  description,
  onRetry,
  retryLabel = ru.common.retry,
  retrying = false,
  tone = 'light',
  className,
}: ErrorStateProps) {
  const dark = tone === 'dark';
  return (
    <div className={cx('flex flex-col items-center gap-3 px-4 py-8 text-center', className)}>
      <span
        className={cx(
          'flex size-14 items-center justify-center rounded-full',
          dark ? 'bg-navy-2 text-amber' : 'bg-accent-soft text-accent-strong',
        )}
      >
        <IconAlert size={28} />
      </span>
      <p role="alert" className={cx('text-xl font-extrabold', dark ? 'text-white' : 'text-ink')}>
        {title}
      </p>
      {description !== undefined && (
        <p className={cx('text-md', dark ? 'text-on-dark-muted' : 'text-muted')}>{description}</p>
      )}
      {onRetry && (
        <Button
          variant={dark ? 'outlineDark' : 'secondary'}
          icon={<IconRefresh size={18} />}
          disabled={retrying}
          onClick={onRetry}
          className="mt-2"
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
