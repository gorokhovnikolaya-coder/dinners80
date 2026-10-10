import type { MapContinent, MapCountry, MapResponse } from '@tma80/shared';
import { Link } from 'react-router';

import { useMapQuery } from '../../api/map.ts';
import { MainTabBar } from '../../app/MainTabBar.tsx';
import { countryPath } from '../../app/routes.ts';
import { Card } from '../../components/Card.tsx';
import { cx } from '../../components/cx.ts';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconLock } from '../../components/icons.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { continentProgress } from './passport.ts';

const t = ru.map;

/** The navy passport card: «8/30», «стран пройдено» and the progress bar. */
function PassportCard({ data }: { data: MapResponse }) {
  return (
    <Card tone="inverse" radius="lg" className="flex items-center gap-4">
      <p aria-hidden="true" className="font-display text-9xl font-bold">
        {data.countriesCount}
        <span className="text-2xl text-on-dark-muted">/{data.countriesTotal}</span>
      </p>
      <div className="flex flex-1 flex-col gap-2">
        <p aria-hidden="true" className="text-md font-bold">
          {t.countriesCaption}
        </p>
        <ProgressBar
          value={data.countriesCount}
          max={data.countriesTotal}
          label={t.progressLabel}
          valueText={t.progressValue(data.countriesCount, data.countriesTotal)}
          tone="dark"
          size="sm"
        />
      </div>
    </Card>
  );
}

/** A country tile: filled if passed, dashed if not, dashed with a lock if closed. */
function CountryTile({ country }: { country: MapCountry }) {
  const label = country.passed
    ? t.tile.passed(country.name)
    : country.locked
      ? t.tile.locked(country.name)
      : t.tile.open(country.name);
  return (
    <li>
      <Link
        to={countryPath(country.id)}
        aria-label={label}
        className={cx(
          'flex h-11 flex-col items-center justify-center gap-0.5 rounded-chip px-0.5 text-center text-3xs no-underline transition-transform active:scale-95',
          country.passed
            ? 'bg-primary font-extrabold text-white'
            : 'border-[1.5px] border-dashed border-border font-bold text-muted',
        )}
      >
        {country.locked && <IconLock size={12} />}
        <span aria-hidden="true" className="max-w-full break-words hyphens-auto">
          {country.name}
        </span>
      </Link>
    </li>
  );
}

function ContinentGroup({ group }: { group: MapContinent }) {
  const { passed, total } = continentProgress(group);
  const headingId = `continent-${group.id}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3 text-md font-extrabold">
        <h2 id={headingId}>{t.continents[group.id]}</h2>
        <p className="text-muted">
          <span className="sr-only">{t.continentProgressPrefix} </span>
          {t.continentProgress(passed, total)}
        </p>
      </div>
      <ul className="grid grid-cols-5 gap-1.5">
        {group.countries.map((country) => (
          <CountryTile key={country.id} country={country} />
        ))}
      </ul>
    </section>
  );
}

function MapSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-4">
      <Skeleton height={76} className="rounded-card-lg" />
      {[0, 1, 2].map((group) => (
        <div key={group} className="flex flex-col gap-2">
          <Skeleton shape="text" width="40%" className="text-md" />
          <div className="grid grid-cols-5 gap-1.5">
            {[0, 1, 2, 3, 4].map((tile) => (
              <Skeleton key={tile} height={44} className="rounded-chip" />
            ))}
          </div>
        </div>
      ))}
    </SkeletonGroup>
  );
}

/**
 * «Карта и паспорт»: the counter «8/30» with a progress bar, the countries grouped by continent
 * with «3 из 8» (passed — filled, not passed — dashed, closed — with a lock). A tile opens the
 * country's dishes.
 */
export default function MapScreen() {
  const { data, isError, refetch } = useMapQuery(undefined);

  // Stale data stays on screen if a refetch (after a new stamp) fails.
  let content;
  if (data) {
    content = (
      <>
        <PassportCard data={data} />
        {data.continents.map((group) => (
          <ContinentGroup key={group.id} group={group} />
        ))}
      </>
    );
  } else if (isError) {
    content = <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />;
  } else {
    content = <MapSkeleton />;
  }

  return (
    <>
      <main className="flex min-h-dvh flex-col gap-4.5 bg-bg px-5 pt-14 pb-28">
        <header className="flex items-end justify-between gap-3">
          <h1 className="font-display text-6xl font-bold">{t.title}</h1>
          {data && <p className="text-md font-bold text-muted">{t.dishes(data.dishesCount)}</p>}
        </header>
        {content}
      </main>
      <MainTabBar active="map" />
    </>
  );
}
