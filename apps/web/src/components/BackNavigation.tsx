import { ru } from '../i18n/ru.ts';
import { useTelegramBackButton } from '../telegram/hooks.ts';
import { IconButton } from './Button.tsx';
import { cx } from './cx.ts';
import { IconBack } from './icons.tsx';

export interface BackNavigationProps {
  /** Go back; `undefined` hides the back control (e.g. on the first step). Keep it stable. */
  onBack: (() => void) | undefined;
  /** `dark` — navy screens, `light` — light screens. Affects only the fallback button. */
  tone?: 'dark' | 'light';
  className?: string;
}

/**
 * «Back» of a nested screen: the Telegram BackButton (ТЗ), or — if the client cannot show it —
 * an in-page 44 × 44 button with the same action. Render it where the fallback should appear.
 */
export function BackNavigation({ onBack, tone = 'light', className }: BackNavigationProps) {
  const system = useTelegramBackButton(onBack);
  if (system || !onBack) return null;
  return (
    <IconButton
      label={ru.common.back}
      icon={<IconBack />}
      variant={tone === 'dark' ? 'dark' : 'muted'}
      onClick={onBack}
      className={cx('self-start', className)}
    />
  );
}
