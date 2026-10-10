import { ru } from '../i18n/ru.ts';
import { useTelegramBackButton } from '../telegram/hooks.ts';
import { IconButton } from './Button.tsx';
import { cx } from './cx.ts';
import { IconBack } from './icons.tsx';

export interface BackNavigationProps {
  /** Go back; `undefined` hides the back control (e.g. on the first step). Keep it stable. */
  onBack: (() => void) | undefined;
  className?: string;
}

/**
 * «Back» of a nested screen: the Telegram BackButton (ТЗ), or — if the client cannot show it —
 * an in-page 44 × 44 button with the same action. Render it where the fallback should appear.
 */
export function BackNavigation({ onBack, className }: BackNavigationProps) {
  const system = useTelegramBackButton(onBack);
  if (system || !onBack) return null;
  return (
    <IconButton
      label={ru.common.back}
      icon={<IconBack />}
      variant="muted"
      onClick={onBack}
      className={cx('self-start', className)}
    />
  );
}
