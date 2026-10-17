import {
  SUBSCRIPTION_PERIOD_DAYS,
  SUBSCRIPTION_PRICES_STARS,
  monthlyPriceStars,
  type MapResponse,
  type SubscriptionPlan,
} from '@tma80/shared';
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';

import { api } from '../../api/api.ts';
import { authApi, useAuthQuery } from '../../api/auth.ts';
import { track } from '../../api/events.ts';
import { isNotFound, paywallPreview, useDishQuery } from '../../api/dishes.ts';
import { useMapQuery } from '../../api/map.ts';
import { useCreateInvoiceMutation } from '../../api/payments.ts';
import { dishPath } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { cx } from '../../components/cx.ts';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconCheck } from '../../components/icons.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch } from '../../store/hooks.ts';
import { useDarkTelegramChrome } from '../../telegram/hooks.ts';
import { openInvoice, type InvoiceOutcome } from '../../telegram/invoice.ts';
import { formatStampDate } from '../map/passport.ts';
import {
  CONFIRM_ATTEMPTS,
  CONFIRM_INTERVAL_MS,
  miniMapTiles,
  publishedDishesCount,
  waitForSubscription,
} from './paywall.ts';

const t = ru.paywall;

/**
 * Where the payment is: nothing yet (or cancelled), the invoice being created and open, `paid`
 * waiting for the server to see the subscription, or one of the outcomes with a message.
 */
type Payment =
  'idle' | 'opening' | 'confirming' | 'failed' | 'pending' | 'unconfirmed' | 'invoiceError';

/** The mini-map: a tile per published country, passed ones filled. */
function MiniMap({ map }: { map: MapResponse }) {
  return (
    <div
      role="img"
      aria-label={t.map(map.countriesCount, map.countriesTotal)}
      className="grid grid-cols-10 gap-1.25"
    >
      {miniMapTiles(map).map((tile) => (
        <span
          key={tile.id}
          className={cx(
            'aspect-square rounded-dot',
            tile.passed ? 'bg-amber' : 'border-[1.5px] border-dashed border-navy-3',
          )}
        />
      ))}
    </div>
  );
}

/** A plan card: a native radio inside a `label`, so the whole card is the touch target. */
function PlanOption({
  plan,
  checked,
  disabled,
  onSelect,
}: {
  plan: SubscriptionPlan;
  checked: boolean;
  disabled: boolean;
  onSelect: (plan: SubscriptionPlan) => void;
}) {
  const year = plan === 'year';
  return (
    <label
      className={cx(
        'relative flex items-center justify-between gap-3 rounded-card bg-navy-2 px-4.5 py-2.5 text-left transition-colors',
        'outline-offset-2 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-(--focus-ring)',
        year ? 'min-h-17' : 'min-h-16',
        // The chosen plan: a thicker amber border (not only another colour).
        checked ? 'border-2 border-amber' : 'border-[1.5px] border-navy-line',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <input
        type="radio"
        name="plan"
        value={plan}
        checked={checked}
        disabled={disabled}
        onChange={() => {
          onSelect(plan);
        }}
        className="sr-only"
      />
      <span className="flex flex-col">
        <span className={cx('text-xl', year ? 'font-extrabold' : 'font-bold')}>
          {year ? t.plans.year.title : t.plans.month.title}
        </span>
        <span className="text-sm text-on-dark-muted">
          {year
            ? t.plans.year.perMonth(t.stars(monthlyPriceStars('year')))
            : t.plans.month.renews(SUBSCRIPTION_PERIOD_DAYS.month)}
        </span>
      </span>
      <span className={cx('shrink-0 text-xl', year ? 'font-extrabold' : 'font-bold')}>
        {t.stars(SUBSCRIPTION_PRICES_STARS[plan])}
      </span>
      {year && (
        <span className="absolute -top-2.75 left-4 rounded-full bg-amber px-2 py-0.75 text-2xs font-extrabold tracking-caps text-ink uppercase">
          {t.plans.year.badge}
        </span>
      )}
    </label>
  );
}

/** The navy skeleton of the paywall while the passport and the closed dish load. */
function PaywallSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-4.5">
      <Skeleton tone="dark" height={66} />
      <Skeleton tone="dark" shape="text" width="80%" className="text-6xl" />
      <Skeleton tone="dark" shape="text" width="60%" className="text-6xl" />
      <Skeleton tone="dark" shape="text" width="90%" className="text-base" />
      <Skeleton tone="dark" height={68} className="mt-6" />
      <Skeleton tone="dark" height={64} />
    </SkeletonGroup>
  );
}

/**
 * True once the screen is closed. A function, not an inline `!alive.current`: TypeScript would
 * keep a narrowed `alive.current` across `await`, though it changes while the promise waits.
 */
const isClosed = (alive: RefObject<boolean>) => !alive.current;

const screenClass =
  'flex min-h-dvh flex-col gap-4.5 bg-ink px-5 pt-14 pb-safe-7 text-white surface-dark';

/**
 * Пейвол (ТЗ, экран 8): opens from a dish of a closed country (`?dish=<id>`: the `403 paywall`
 * preview gives the country) or from the profile (no dish). The navy screen shows the passed
 * countries on a mini-map, the title «N стран позади. Ещё M ждут вас», three benefits and the
 * plans; «Продолжить путешествие» opens the Telegram Stars invoice for the chosen plan. After
 * `paid` the screen waits until the server sees the subscription, then opens the dish (or shows
 * the active subscription). With an active subscription the plans give way to its end date.
 * If the dish turns out to be open, the dish card is shown instead.
 */
export default function PaywallScreen() {
  const [params] = useSearchParams();
  const dishId = params.get('dish');
  const dish = useDishQuery({ id: dishId ?? '' }, { skip: dishId === null });
  const map = useMapQuery(undefined);
  const { data: auth } = useAuthQuery(undefined);
  const [createInvoice] = useCreateInvoiceMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const onBack = useGoBack();
  const [plan, setPlan] = useState<SubscriptionPlan>('year');
  const [payment, setPayment] = useState<Payment>('idle');
  const [now] = useState(() => new Date());
  useDarkTelegramChrome(true);

  // Async steps of the payment stop touching the screen once it is closed.
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const preview = paywallPreview(dish.error);
  const refetchDish = dish.refetch;

  /** The server's subscription status, asked again (`POST /auth` returns it). */
  const checkSubscription = useCallback(async () => {
    const result = await dispatch(
      authApi.endpoints.auth.initiate(undefined, { subscribe: false, forceRefetch: true }),
    );
    return result.data?.subscription.active === true;
  }, [dispatch]);

  /**
   * The subscription is on: locks of the main screen, the map and dishes are refetched. From a
   * dish — the dish card replaces the paywall (`<Navigate>` below, once the dish loads); from the
   * profile — the screen shows the active subscription.
   */
  const finish = useCallback(async () => {
    dispatch(api.util.invalidateTags(['Subscription']));
    if (dishId === null) {
      setPayment('idle');
      return;
    }
    const result = await refetchDish();
    if (isClosed(alive) || result.data) return;
    // Still closed (should not happen): back to the plans. Another error: the card shows it.
    if (paywallPreview(result.error)) setPayment('idle');
    else void navigate(dishPath(dishId), { replace: true });
  }, [dispatch, dishId, refetchDish, navigate]);

  const confirm = useCallback(
    async (attempts: number, otherwise: 'pending' | 'unconfirmed') => {
      setPayment('confirming');
      const active = await waitForSubscription(checkSubscription, {
        attempts,
        intervalMs: CONFIRM_INTERVAL_MS,
        cancelled: () => isClosed(alive),
      });
      if (isClosed(alive)) return;
      if (active) await finish();
      else setPayment(otherwise);
    },
    [checkSubscription, finish],
  );

  const pay = useCallback(async () => {
    setPayment('opening');
    let outcome: InvoiceOutcome;
    try {
      const { invoiceLink } = await createInvoice({ plan }).unwrap();
      if (isClosed(alive)) return;
      outcome = await openInvoice(invoiceLink);
    } catch {
      if (!isClosed(alive)) setPayment('invoiceError');
      return;
    }
    if (isClosed(alive)) return;
    switch (outcome) {
      case 'paid':
        await confirm(CONFIRM_ATTEMPTS, 'unconfirmed');
        return;
      case 'cancelled':
        setPayment('idle');
        return;
      case 'failed':
        setPayment('failed');
        return;
      case 'pending':
      case 'external':
        setPayment('pending');
        return;
    }
  }, [createInvoice, plan, confirm]);

  const dishFailed = dish.isError && !preview && !isNotFound(dish.error);
  // `paywall_shown` once per visit, when the plans are on the screen (not the active subscription).
  const plansShown =
    !(dish.data && dishId !== null) &&
    !map.isError &&
    !dishFailed &&
    map.data !== undefined &&
    auth !== undefined &&
    !auth.subscription.active &&
    !(dishId !== null && dish.isLoading);
  const paywallReported = useRef(false);
  useEffect(() => {
    if (!plansShown || paywallReported.current) return;
    paywallReported.current = true;
    track({ name: 'paywall_shown', props: { reason: dishId === null ? 'profile' : 'country_11' } });
  }, [plansShown, dishId]);

  if (dish.data && dishId !== null) return <Navigate to={dishPath(dishId)} replace />;

  if (map.isError || dishFailed) {
    return (
      <main className={screenClass}>
        <BackNavigation onBack={onBack} />
        <ErrorState
          tone="dark"
          description={ru.common.errorHint}
          retrying={map.isFetching || dish.isFetching}
          onRetry={() => {
            if (map.isError) void map.refetch();
            if (dishFailed) void refetchDish();
          }}
        />
      </main>
    );
  }

  if (!map.data || !auth || (dishId !== null && dish.isLoading)) {
    return (
      <main className={screenClass}>
        <BackNavigation onBack={onBack} />
        <PaywallSkeleton />
      </main>
    );
  }

  const { subscription } = auth;
  // While a payment is being confirmed, the plans stay until the dish opens.
  const active = subscription.active && payment !== 'confirming';
  const total = map.data.countriesTotal;
  const busy = payment === 'opening' || payment === 'confirming';
  const waiting = payment === 'pending' || payment === 'unconfirmed';

  const message =
    payment === 'failed' || payment === 'invoiceError' ? (
      <p className="text-md font-bold text-amber">{t.status[payment]}</p>
    ) : waiting ? (
      <p className="text-md text-border">{t.status[payment]}</p>
    ) : null;

  const action =
    payment === 'opening'
      ? t.opening
      : payment === 'confirming'
        ? t.confirming
        : waiting
          ? t.refresh
          : payment === 'invoiceError'
            ? t.retry
            : t.pay;

  return (
    <main className={screenClass}>
      <BackNavigation onBack={onBack} />
      <MiniMap map={map.data} />

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-6xl leading-tight font-bold">
          {t.title(map.data.countriesCount, total).map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </h1>
        <p className="text-base text-border">
          {active
            ? t.subtitle.active
            : preview
              ? t.subtitle.country(preview.countryName)
              : t.subtitle.all}
        </p>
      </div>

      <ul aria-label={t.benefits.label} className="flex flex-col gap-2.5 text-base">
        {[
          t.benefits.all(total, publishedDishesCount(map.data)),
          t.benefits.suggestions,
          t.benefits.passport(total),
        ].map((benefit) => (
          <li key={benefit} className="flex items-center gap-2.5">
            <IconCheck size={20} className="shrink-0 text-amber" />
            {benefit}
          </li>
        ))}
      </ul>

      {active ? (
        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          <p
            role="status"
            className="flex items-center gap-2.5 rounded-card bg-navy-2 px-4.5 py-4 text-xl font-extrabold"
          >
            <IconCheck size={22} className="shrink-0 text-amber" />
            {subscription.expiresAt === null
              ? t.activeNoDate
              : t.active(formatStampDate(subscription.expiresAt, auth.user.timezone, now))}
          </p>
          <Button variant="inverse" size="lg" fullWidth onClick={onBack} className="mt-1">
            {t.continue}
          </Button>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-2.5 pt-2">
          <fieldset className="flex flex-col gap-2.5 pt-2.75">
            <legend className="sr-only">{t.plans.label}</legend>
            {(['year', 'month'] as const).map((option) => (
              <PlanOption
                key={option}
                plan={option}
                checked={plan === option}
                disabled={busy || waiting}
                onSelect={setPlan}
              />
            ))}
          </fieldset>
          <Button
            variant="inverse"
            size="lg"
            fullWidth
            loading={busy}
            onClick={() => {
              if (waiting) void confirm(1, payment);
              else void pay();
            }}
            className="mt-1"
          >
            {action}
          </Button>
          <div role="status" className="text-center empty:hidden">
            {message}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="min-h-11 self-center rounded-button px-3 text-md font-bold text-on-dark-muted"
          >
            {t.notNow}
          </button>
        </div>
      )}
    </main>
  );
}
