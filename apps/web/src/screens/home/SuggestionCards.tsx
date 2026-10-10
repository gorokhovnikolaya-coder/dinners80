import type { SuggestionCard } from '@tma80/shared';
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router';

import { dishPath, paywallPath } from '../../app/routes.ts';
import { Chip } from '../../components/Chip.tsx';
import { cx } from '../../components/cx.ts';
import { IconLock } from '../../components/icons.tsx';
import { ru } from '../../i18n/ru.ts';

const t = ru.home;

/** The dish photo; a failed image leaves the neutral background instead of a broken icon. */
function Photo({
  url,
  className,
  children,
}: {
  url: string;
  className?: string;
  /** Overlays (badge, lock), positioned over the photo. */
  children?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  return (
    <span className={cx('relative block shrink-0 bg-track', className)}>
      {!failed && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      )}
      {children}
    </span>
  );
}

const linkClass =
  'flex flex-col overflow-hidden bg-surface text-ink no-underline shadow-card transition-transform active:scale-[0.99]';

/** Badge over the photo of the big card. */
function Badge({ label }: { label: SuggestionCard['label'] }) {
  switch (label.kind) {
    case 'newCountry':
      return <Chip tone="badge">{t.labels.newCountry}</Chip>;
    case 'nthDish':
      return (
        <Chip tone="primary" className="font-extrabold">
          {t.labels.nthDish(label.n)}
        </Chip>
      );
    case 'cookedBefore':
      return <Chip className="bg-surface font-extrabold">{t.labels.cookedBefore}</Chip>;
  }
}

/** The caption «ЯПОНИЯ · НОВАЯ» / «ИЗРАИЛЬ · 2-Е БЛЮДО» of a small card. */
function smallLabel(label: SuggestionCard['label']): { text: string; tone: string } {
  switch (label.kind) {
    case 'newCountry':
      return { text: t.labels.newCountryShort, tone: 'text-accent' };
    case 'nthDish':
      return { text: t.labels.nthDish(label.n), tone: 'text-primary' };
    case 'cookedBefore':
      return { text: t.labels.cookedBefore, tone: 'text-muted' };
  }
}

/** The first suggestion: big photo, country, title, time and level. */
export function BigSuggestionCard({ card }: { card: SuggestionCard }) {
  return (
    <Link to={dishPath(card.dishId)} className={cx(linkClass, 'rounded-card-lg')}>
      <Photo url={card.imageUrl} className="h-37.5">
        <span className="absolute top-3 left-3">
          <Badge label={card.label} />
        </span>
      </Photo>
      <span className="flex flex-col gap-2 px-4 pt-3.5 pb-4">
        <span className="text-sm font-bold tracking-caps text-muted uppercase">
          {card.countryName}
        </span>
        <span className="font-display text-3xl font-bold">{card.title}</span>
        <span className="flex flex-wrap gap-2">
          <Chip>{t.minutes(card.minutes)}</Chip>
          <Chip tone="primary">{t.levels[card.level]}</Chip>
        </span>
      </span>
    </Link>
  );
}

/** One of the two small suggestions. */
export function SmallSuggestionCard({ card }: { card: SuggestionCard }) {
  const label = smallLabel(card.label);
  return (
    <Link to={dishPath(card.dishId)} className={cx(linkClass, 'rounded-card')}>
      <Photo url={card.imageUrl} className="h-23" />
      <span className="flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-3">
        <span className={cx('text-2xs font-bold tracking-caps uppercase', label.tone)}>
          {card.countryName} · {label.text}
        </span>
        <span className="text-base font-extrabold">{card.title}</span>
        <span className="text-xs font-semibold text-muted">
          {t.minutes(card.minutes)} · {t.levels[card.level]}
        </span>
      </span>
    </Link>
  );
}

/**
 * A dish of a new country that needs a subscription (free user with 10 countries): a dimmed
 * photo with a lock; the tap opens the paywall, not the dish.
 */
export function LockedSuggestionCard({ card }: { card: SuggestionCard }) {
  return (
    <Link to={paywallPath(card.dishId)} className={cx(linkClass, 'rounded-card')}>
      <Photo url={card.imageUrl} className="h-23">
        <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
          <span className="flex size-10 items-center justify-center rounded-full bg-ink text-white">
            <IconLock size={20} />
          </span>
        </span>
      </Photo>
      <span className="flex flex-1 flex-col gap-1 px-3 pt-2.5 pb-3">
        <span className="text-2xs font-bold tracking-caps text-muted uppercase">
          {card.countryName}
        </span>
        <span className="text-base font-extrabold">{card.title}</span>
        <span className="flex items-center gap-1 text-xs font-semibold text-accent-strong">
          <IconLock size={14} />
          {t.locked}
        </span>
      </span>
    </Link>
  );
}
