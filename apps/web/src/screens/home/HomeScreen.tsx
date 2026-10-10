import {
  defaultSuggestionMode,
  SUGGESTION_MODES,
  type HomeResponse,
  type SuggestionMode,
  type UserProfile,
} from '@tma80/shared';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { useHomeQuery } from '../../api/home.ts';
import { MainTabBar } from '../../app/MainTabBar.tsx';
import { ROUTES } from '../../app/routes.ts';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconRefresh } from '../../components/icons.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { modeChosen, pageShown, selectChosenMode, selectPages } from './homeSlice.ts';
import {
  BigSuggestionCard,
  LockedSuggestionCard,
  SmallSuggestionCard,
} from './SuggestionCards.tsx';
import { formatToday, initials } from './today.ts';

const t = ru.home;

function Avatar({ user }: { user: UserProfile }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link
      to={ROUTES.profile}
      aria-label={t.profile(user.firstName)}
      className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-lg font-extrabold text-primary-strong no-underline"
    >
      {user.photoUrl && !failed ? (
        <img
          src={user.photoUrl}
          alt=""
          className="size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      ) : (
        <span aria-hidden="true">{initials(user.firstName)}</span>
      )}
    </Link>
  );
}

/** «7/30 стран»: the passport counter, opens the map. */
/** Without data (loading or error) a skeleton keeps the tile's place, so the header does not jump. */
function CountriesTile({ data }: { data: HomeResponse | undefined }) {
  if (!data) return <Skeleton width={76} height={76} className="rounded-card" />;
  return (
    <Link
      to={ROUTES.map}
      aria-label={t.countries.link(data.countriesCount, data.countriesTotal)}
      className="surface-dark flex size-19 shrink-0 flex-col items-center justify-center rounded-card bg-ink text-white no-underline"
    >
      <span aria-hidden="true" className="font-display text-4xl font-bold">
        {data.countriesCount}
        <span className="text-sm text-on-dark-muted">/{data.countriesTotal}</span>
      </span>
      <span aria-hidden="true" className="text-2xs font-semibold text-on-dark-muted">
        {t.countries.label}
      </span>
    </Link>
  );
}

function ModeSwitch({
  mode,
  weekdayMinutes,
  onChange,
}: {
  mode: SuggestionMode;
  weekdayMinutes: number | null;
  onChange: (mode: SuggestionMode) => void;
}) {
  const label = (item: SuggestionMode) =>
    item === 'weekend'
      ? t.modes.weekend
      : weekdayMinutes === null
        ? t.modes.weekday
        : t.modes.weekdayWithMinutes(weekdayMinutes);
  return (
    <div role="group" aria-label={t.modes.label} className="flex gap-2 rounded-tile bg-track p-1">
      {SUGGESTION_MODES.map((item) => {
        const active = item === mode;
        return (
          <button
            key={item}
            type="button"
            aria-pressed={active}
            onClick={() => {
              onChange(item);
            }}
            className={cx(
              'min-h-11 flex-1 rounded-segment text-base transition-colors',
              active ? 'bg-surface font-bold text-ink shadow-card' : 'font-semibold text-muted',
            )}
          >
            {label(item)}
          </button>
        );
      })}
    </div>
  );
}

function CardsSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-3">
      <Skeleton height={262} className="rounded-card-lg" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton height={176} />
        <Skeleton height={176} />
      </div>
    </SkeletonGroup>
  );
}

function Suggestions({ data }: { data: HomeResponse }) {
  const open = data.suggestions.filter((card) => !card.locked);
  const locked = data.suggestions.filter((card) => card.locked);
  const [big, ...small] = open;
  return (
    <section aria-label={t.suggestions} className="flex flex-col gap-3">
      {big && <BigSuggestionCard card={big} />}
      {small.length + locked.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {small.map((card) => (
            <SmallSuggestionCard key={card.dishId} card={card} />
          ))}
          {locked.map((card) => (
            <LockedSuggestionCard key={card.dishId} card={card} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptySuggestions() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center gap-4 rounded-card bg-surface px-5 py-8 text-center shadow-card">
      <p role="status" className="text-xl font-extrabold text-ink">
        {t.empty.title}
      </p>
      <Button
        variant="secondary"
        onClick={() => {
          void navigate(ROUTES.profile);
        }}
      >
        {t.empty.action}
      </Button>
    </div>
  );
}

/**
 * «Ужин сегодня» — the main screen: date, countries counter, avatar, the weekday/weekend switch,
 * three suggestions (one big, two small; a locked one for a free user with 10 countries) and
 * «Показать другие». The suggestions come from `GET /home` (the shared algorithm on the server).
 */
export function HomeScreen({ user }: { user: UserProfile }) {
  const dispatch = useAppDispatch();
  const chosenMode = useAppSelector(selectChosenMode);
  const pages = useAppSelector(selectPages);
  const [now] = useState(() => new Date());
  const mode = chosenMode ?? defaultSuggestionMode(now, user.timezone);
  const page = pages[mode];

  const { data, currentData, isFetching, isError, refetch } = useHomeQuery({ mode, page });
  // While the next page of the same mode loads, the current cards stay with a busy button.
  const shown = currentData ?? (data?.mode === mode ? data : undefined);
  const loadingMore = isFetching && !currentData && shown !== undefined;

  let content;
  if (isError) {
    content = <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />;
  } else if (!shown) {
    content = <CardsSkeleton />;
  } else if (shown.suggestions.length === 0) {
    content = <EmptySuggestions />;
  } else {
    content = (
      <>
        <Suggestions data={shown} />
        {shown.pageCount > 1 && (
          <Button
            variant="secondary"
            fullWidth
            icon={<IconRefresh size={18} />}
            loading={loadingMore}
            onClick={() => {
              dispatch(pageShown({ mode, page: (shown.page + 1) % shown.pageCount }));
            }}
          >
            {t.showMore}
          </Button>
        )}
      </>
    );
  }

  return (
    <>
      <main className="flex min-h-dvh flex-col gap-5 bg-bg px-5 pt-14 pb-28">
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <p className="text-md font-semibold text-muted">{formatToday(now, user.timezone)}</p>
            <h1 className="font-display text-6xl font-bold text-balance">{t.title}</h1>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <Avatar user={user} />
            <CountriesTile data={data} />
          </div>
        </header>
        <ModeSwitch
          mode={mode}
          weekdayMinutes={user.weekdayMinutes}
          onChange={(next) => {
            dispatch(modeChosen(next));
          }}
        />
        {content}
      </main>
      <MainTabBar active="dinner" />
    </>
  );
}
