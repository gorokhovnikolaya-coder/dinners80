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
  className?: string;
}

/** The error state of a screen or a block, with an optional retry. */
export function ErrorState({
  title = ru.common.error,
  description,
  onRetry,
  retryLabel = ru.common.retry,
  retrying = false,
  className,
}: ErrorStateProps) {
  return (
    <div className={cx('flex flex-col items-center gap-3 px-4 py-8 text-center', className)}>
      <span className="flex size-14 items-center justify-center rounded-full bg-accent-soft text-accent-strong">
        <IconAlert size={28} />
      </span>
      <p role="alert" className="text-xl font-extrabold text-ink">
        {title}
      </p>
      {description !== undefined && <p className="text-md text-muted">{description}</p>}
      {onRetry && (
        <Button
          variant="secondary"
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
