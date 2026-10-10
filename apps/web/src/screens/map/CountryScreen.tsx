import type { MapCountry, MapDish } from '@tma80/shared';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuthQuery } from '../../api/auth.ts';
import { useMapQuery } from '../../api/map.ts';
import { dishPath, paywallPath, ROUTES } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { Chip } from '../../components/Chip.tsx';
import { DishPhoto } from '../../components/DishPhoto.tsx';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconCheck, IconLock } from '../../components/icons.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { findCountry, formatStampDate } from './passport.ts';

const t = ru.country;

/** «В паспорте с 12 октября» / «Ещё не пройдена» / «Откроется с подпиской». */
function CountryStatus({ country }: { country: MapCountry }) {
  const { data: auth } = useAuthQuery(undefined);
  const [now] = useState(() => new Date());
  if (country.passed && country.firstStampAt !== null) {
    return (
      <p className="flex items-center gap-1.5 text-md font-bold text-primary-strong">
        <IconCheck size={18} />
        {t.since(formatStampDate(country.firstStampAt, auth?.user.timezone, now))}
      </p>
    );
  }
  if (country.locked) {
    return (
      <p className="flex items-center gap-1.5 text-md font-bold text-accent-strong">
        <IconLock size={18} />
        {t.locked}
      </p>
    );
  }
  return <p className="text-md font-semibold text-muted">{t.notPassed}</p>;
}

/** A dish of the country: opens the dish card, or the paywall if the country is closed. */
function DishRow({ dish, locked }: { dish: MapDish; locked: boolean }) {
  return (
    <li>
      <Link
        to={locked ? paywallPath(dish.dishId) : dishPath(dish.dishId)}
        className="flex min-h-22 items-center gap-3 rounded-card bg-surface p-3 text-ink no-underline shadow-card transition-transform active:scale-[0.99]"
      >
        <DishPhoto url={dish.imageUrl} className="size-16 overflow-hidden rounded-tile">
          {locked && (
            <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
              <span className="flex size-8 items-center justify-center rounded-full bg-ink text-white">
                <IconLock size={16} />
              </span>
            </span>
          )}
        </DishPhoto>
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="text-lg font-extrabold">{dish.title}</span>
          <span className="text-sm font-semibold text-muted">
            {ru.home.minutes(dish.minutes)} · {ru.home.levels[dish.level]}
          </span>
          {locked ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-accent-strong">
              <IconLock size={14} />
              {t.locked}
            </span>
          ) : (
            dish.cooked && (
              <Chip tone="primary" icon={<IconCheck size={14} />} className="font-bold">
                {t.cooked}
              </Chip>
            )
          )}
        </span>
      </Link>
    </li>
  );
}

function CountrySkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-3">
      <Skeleton shape="text" width="30%" className="text-sm" />
      <Skeleton shape="text" width="60%" className="text-6xl" />
      <Skeleton shape="text" width="50%" className="text-md" />
      {[0, 1, 2].map((row) => (
        <Skeleton key={row} height={88} className="mt-1" />
      ))}
    </SkeletonGroup>
  );
}

/**
 * A country of the passport: its continent, name, status (the date of the first stamp, not passed
 * or closed) and its 3 dishes with «Приготовлено». Dishes of a closed country carry a lock and
 * open the paywall. The data is the `GET /map` response (shared with the map screen).
 */
export default function CountryScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const onBack = useGoBack(ROUTES.map);
  const { data, isError, refetch } = useMapQuery(undefined);
  const found = data ? findCountry(data, id) : undefined;

  let content;
  if (found) {
    const { country, continent } = found;
    content = (
      <>
        <header className="flex flex-col gap-1.5">
          <p className="text-sm font-bold tracking-caps text-muted uppercase">
            {ru.map.continents[continent]}
          </p>
          <h1 className="font-display text-6xl font-bold">{country.name}</h1>
          <CountryStatus country={country} />
        </header>
        <section aria-label={t.dishes}>
          <ul className="flex flex-col gap-3">
            {country.dishes.map((dish) => (
              <DishRow key={dish.dishId} dish={dish} locked={country.locked} />
            ))}
          </ul>
        </section>
      </>
    );
  } else if (data) {
    content = (
      <div className="flex flex-col items-center gap-4 rounded-card bg-surface px-5 py-8 text-center shadow-card">
        <p role="status" className="text-xl font-extrabold">
          {t.notFound.title}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void navigate(ROUTES.map, { replace: true });
          }}
        >
          {t.notFound.action}
        </Button>
      </div>
    );
  } else if (isError) {
    content = <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />;
  } else {
    content = <CountrySkeleton />;
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-bg px-5 pt-14 pb-8">
      <BackNavigation onBack={onBack} />
      {content}
    </main>
  );
}
