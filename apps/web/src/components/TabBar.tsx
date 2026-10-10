import type { MouseEvent, ReactNode } from 'react';

import { cx } from './cx.ts';

export interface TabBarItem {
  id: string;
  label: string;
  href: string;
  /** Decorative icon above the label. */
  icon: ReactNode;
}

export interface TabBarProps {
  items: readonly TabBarItem[];
  /** Id of the current tab: marked with `aria-current="page"`. */
  activeId: string;
  /** Accessible name of the navigation landmark. */
  label: string;
  /**
   * Client-side navigation (e.g. the router's `navigate`). When set, a plain click does not
   * reload the page; modified clicks keep the browser behaviour.
   */
  onNavigate?: (item: TabBarItem) => void;
  className?: string;
}

const isPlainClick = (event: MouseEvent) =>
  event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;

/**
 * Bottom navigation with links. Positioning is up to the screen layout (`className`); the bottom
 * padding includes the Telegram safe area.
 */
export function TabBar({ items, activeId, label, onNavigate, className }: TabBarProps) {
  return (
    <nav
      aria-label={label}
      className={cx('border-t border-track bg-surface pt-2.5', 'pb-safe-2', className)}
    >
      <ul className="flex justify-around">
        {items.map((item) => {
          const active = item.id === activeId;
          return (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={(event) => {
                  if (onNavigate && isPlainClick(event)) {
                    event.preventDefault();
                    onNavigate(item);
                  }
                }}
                className={cx(
                  'flex min-h-11 min-w-18 flex-col items-center gap-1 rounded-tile px-2 py-0.5 text-xs no-underline',
                  active ? 'font-extrabold text-primary' : 'font-semibold text-muted',
                )}
              >
                {item.icon}
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
