import { defaultServings, SERVINGS_MAX, SERVINGS_MIN, type DishResponse } from '@tma80/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { useAuthQuery } from '../../api/auth.ts';
import {
  isNotFound,
  paywallPreview,
  useAddToShoppingMutation,
  useDishQuery,
} from '../../api/dishes.ts';
import { cookingPath, paywallPath, ROUTES } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button, IconButton } from '../../components/Button.tsx';
import { Checkbox } from '../../components/Checkbox.tsx';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconCart } from '../../components/icons.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { LabelBadge } from '../home/SuggestionCards.tsx';
import { amountFor, formatAmount, keysToBuy } from './dish.ts';
import { atHomeToggled, selectAtHome, selectServings, servingsChosen } from './dishSlice.ts';

const t = ru.dish;

const NO_KEYS: readonly string[] = [];

function DishPhoto({ url, title }: { url: string; title: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className="relative h-62.5 bg-track">
      {!failed && (
        <img
          src={url}
          alt={t.photo(title)}
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      )}
    </div>
  );
}

function DishSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col">
      <Skeleton height={250} className="rounded-none" />
      <div className="flex flex-col gap-4 px-5 pt-5">
        <Skeleton shape="text" width="30%" className="text-sm" />
        <Skeleton shape="text" width="70%" className="text-6xl" />
        <Skeleton height={60} />
        <Skeleton height={64} />
        <Skeleton height={220} />
      </div>
    </SkeletonGroup>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'primary' }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-tile bg-surface p-2.5 shadow-card">
      <span className="text-xs font-semibold text-muted">{label}</span>
      <span
        className={
          tone === 'primary' ? 'text-lg font-extrabold text-primary' : 'text-lg font-extrabold'
        }
      >
        {value}
      </span>
    </div>
  );
}

/** Servings − / + (1–8); the count is announced when it changes. */
function ServingsStepper({
  servings,
  onChange,
}: {
  servings: number;
  onChange: (servings: number) => void;
}) {
  return (
    <div
      role="group"
      aria-label={t.servings.label}
      className="flex items-center justify-between rounded-tile bg-surface shadow-card"
    >
      <button
        type="button"
        aria-label={t.servings.fewer}
        disabled={servings <= SERVINGS_MIN}
        onClick={() => {
          onChange(servings - 1);
        }}
        className="flex size-11 items-center justify-center rounded-tile text-4xl font-bold text-ink disabled:text-border"
      >
        −
      </button>
      <span aria-live="polite" className="flex flex-col items-center">
        <span className="text-lg font-extrabold">{servings}</span>
        <span className="text-2xs font-semibold text-muted">{t.servings.word(servings)}</span>
      </span>
      <button
        type="button"
        aria-label={t.servings.more}
        disabled={servings >= SERVINGS_MAX}
        onClick={() => {
          onChange(servings + 1);
        }}
        className="flex size-11 items-center justify-center rounded-tile text-4xl font-bold text-ink disabled:text-border"
      >
        +
      </button>
    </div>
  );
}

type Notice = { kind: 'added'; count: number } | { kind: 'error' } | null;

function DishCard({ dish, servings }: { dish: DishResponse; servings: number }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const onBack = useGoBack();
  const atHome = useAppSelector((state) => selectAtHome(state, dish.id)) ?? NO_KEYS;
  const [addToShopping, { isLoading: adding }] = useAddToShoppingMutation();
  const [notice, setNotice] = useState<Notice>(null);

  const toBuy = keysToBuy(dish.ingredients, atHome);

  const add = () => {
    addToShopping({ dishId: dish.id, servings, ingredientKeys: toBuy })
      .unwrap()
      .then(({ added }) => {
        setNotice({ kind: 'added', count: added });
      })
      .catch(() => {
        setNotice({ kind: 'error' });
      });
  };

  return (
    <>
      <main className="min-h-dvh bg-bg pb-48">
        <div className="relative">
          <DishPhoto url={dish.imageUrl} title={dish.title} />
          <BackNavigation onBack={onBack} className="absolute top-12 left-4 bg-surface" />
        </div>
        <div className="relative -mt-6 flex flex-col gap-4 rounded-t-sheet bg-bg px-5 pt-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-extrabold tracking-caps-md text-muted uppercase">
                {dish.countryName}
              </span>
              <LabelBadge label={dish.label} />
            </div>
            <h1 className="font-display text-6xl font-bold">{dish.title}</h1>
            <p className="text-md text-ink-2">{dish.description}</p>
          </div>

          {dish.fact && (
            <aside className="flex flex-col gap-1 rounded-card bg-primary-soft px-4 py-3">
              <h2 className="text-xs font-extrabold tracking-caps text-primary-strong uppercase">
                {t.fact}
              </h2>
              <p className="text-md text-ink">{dish.fact}</p>
            </aside>
          )}

          <div className="grid grid-cols-3 gap-2">
            <Stat label={t.time} value={ru.home.minutes(dish.minutes)} />
            <Stat label={t.level} value={ru.home.levels[dish.level]} tone="primary" />
            <ServingsStepper
              servings={servings}
              onChange={(next) => {
                setNotice(null);
                dispatch(servingsChosen({ dishId: dish.id, servings: next }));
              }}
            />
          </div>

          <section
            aria-labelledby="dish-ingredients"
            className="rounded-card bg-surface px-4 pt-1.5 pb-1.5 shadow-card"
          >
            <div className="flex items-center justify-between gap-3 pt-2.5 pb-1.5">
              <h2 id="dish-ingredients" className="text-lg font-extrabold">
                {t.ingredients.title}
              </h2>
              <span className="text-xs font-bold text-muted">{t.ingredients.hint}</span>
            </div>
            {dish.ingredients.map((ingredient) => (
              <Checkbox
                key={ingredient.key}
                divider
                checked={atHome.includes(ingredient.key)}
                onChange={(checked) => {
                  setNotice(null);
                  dispatch(
                    atHomeToggled({ dishId: dish.id, key: ingredient.key, atHome: checked }),
                  );
                }}
                label={ingredient.name}
                trailing={formatAmount(amountFor(ingredient, dish, servings), ingredient.unit)}
              />
            ))}
          </section>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2.5 border-t border-track bg-surface px-5 pt-3 pb-safe-7">
        <div role="status" className="empty:hidden">
          {notice?.kind === 'added' && (
            <p className="flex items-center justify-between gap-3 text-md font-semibold text-ink">
              <span>{t.added(notice.count)}</span>
              <Link
                to={ROUTES.shopping}
                className="flex min-h-11 items-center font-bold text-primary"
              >
                {t.openShopping}
              </Link>
            </p>
          )}
          {notice?.kind === 'error' && (
            <p className="text-md font-semibold text-accent-strong">{t.addError}</p>
          )}
        </div>
        <div className="flex gap-2.5">
          <IconButton
            label={toBuy.length === 0 ? t.cartAllAtHome : t.cart}
            icon={<IconCart />}
            variant="outline"
            size="lg"
            disabled={toBuy.length === 0 || adding}
            aria-busy={adding}
            onClick={add}
          />
          <Button
            variant="accent"
            size="lg"
            fullWidth
            onClick={() => {
              void navigate(cookingPath(dish.id));
            }}
          >
            {t.startCooking}
          </Button>
        </div>
      </div>
    </>
  );
}

/**
 * «Карточка блюда»: photo, country and mark, title, description, fact, time, level, servings
 * (− / +, 1–8, recalculated with the shared `scaleAmount`), ingredients with «есть дома», the cart
 * button (`POST /shopping` with the unmarked ones) and «Начать готовить». A closed country
 * (`403 paywall`) replaces the card with the paywall.
 */
export default function DishScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const onBack = useGoBack();
  const { data: auth } = useAuthQuery(undefined);
  const chosen = useAppSelector((state) => selectServings(state, id));
  const fallback = defaultServings(auth?.user.household ?? null);
  // The request takes the servings the card opens with; − / + recalculate on the client.
  const [requested] = useState(() => chosen ?? fallback);
  const { data, error, isError, refetch } = useDishQuery({ id, servings: requested });
  const preview = paywallPreview(error);
  const closedDishId = preview?.dishId;

  useEffect(() => {
    if (closedDishId !== undefined) void navigate(paywallPath(closedDishId), { replace: true });
  }, [closedDishId, navigate]);

  if (data) return <DishCard dish={data} servings={chosen ?? data.servings} />;

  // A retry shows the skeleton again; `403 paywall` keeps it until the paywall replaces the card.
  let content;
  if (isError && !preview) {
    content = isNotFound(error) ? (
      <div className="flex flex-col items-center gap-4 rounded-card bg-surface px-5 py-8 text-center shadow-card">
        <p role="status" className="text-xl font-extrabold">
          {t.notFound.title}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void navigate(ROUTES.home, { replace: true });
          }}
        >
          {t.notFound.action}
        </Button>
      </div>
    ) : (
      <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />
    );
  }

  return (
    <main className="min-h-dvh bg-bg">
      {content ? (
        <div className="flex flex-col gap-4 px-5 pt-14">
          <BackNavigation onBack={onBack} />
          {content}
        </div>
      ) : (
        <>
          <BackNavigation onBack={onBack} className="absolute top-12 left-4 z-10 bg-surface" />
          <DishSkeleton />
        </>
      )}
    </main>
  );
}
