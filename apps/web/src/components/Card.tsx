import type { HTMLAttributes } from 'react';

import { cx } from './cx.ts';

export type CardTone = 'surface' | 'inverse';
export type CardPadding = 'none' | 'sm' | 'md';
export type CardRadius = 'md' | 'lg';

export interface CardProps extends HTMLAttributes<HTMLElement> {
  /** Element to render: a plain block or a semantic container. */
  as?: 'div' | 'section' | 'article' | 'li';
  /** `surface` — white card on the light screen; `inverse` — navy card (passport, timer). */
  tone?: CardTone;
  /** `none` — media and lists that pad themselves; `sm` — 12 px; `md` — 16 px. */
  padding?: CardPadding;
  /** `md` — 18 px (lists, small cards), `lg` — 22 px (hero card). */
  radius?: CardRadius;
}

const tones: Record<CardTone, string> = {
  surface: 'bg-surface text-ink shadow-card',
  // `surface-dark` switches the focus ring of every focusable descendant to amber.
  inverse: 'surface-dark bg-ink text-white',
};

const paddings: Record<CardPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
};

const radii: Record<CardRadius, string> = {
  md: 'rounded-card',
  lg: 'rounded-card-lg',
};

/** A content container. Clips its children, so a photo at the top keeps the rounded corners. */
export function Card({
  as: Tag = 'div',
  tone = 'surface',
  padding = 'md',
  radius = 'md',
  className,
  ...rest
}: CardProps) {
  return (
    <Tag
      className={cx('overflow-hidden', tones[tone], paddings[padding], radii[radius], className)}
      {...rest}
    />
  );
}
