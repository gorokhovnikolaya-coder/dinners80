import { splitStepText, type DishResponse, type DishStep } from '@tma80/shared';
import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import {
  isNotFound,
  paywallPreview,
  selectLoadedDishArgs,
  useDishQuery,
} from '../../api/dishes.ts';
import { cookedPath, dishPath, paywallPath, ROUTES } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button, IconButton } from '../../components/Button.tsx';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconClock, IconClose, IconRefresh } from '../../components/icons.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { hapticStepDone, vibrateAlarm } from '../../telegram/haptics.ts';
import { useVerticalSwipesDisabled } from '../../telegram/hooks.ts';
import { amountFor, formatAmount } from '../dish/dish.ts';
import { selectServings } from '../dish/dishSlice.ts';
import {
  cookingFinished,
  selectDishCooking,
  stepChanged,
  timerPaused,
  timerReset,
  timersElapsed,
  timerStarted,
  type DishCooking,
} from './cookingSlice.ts';
import { playAlarm, primeSound } from './sound.ts';
import { formatTimer, isOverdue, remainingMs, type StepTimer } from './timers.ts';
import { useWakeLock } from './useWakeLock.ts';

const t = ru.cooking;

const NO_COOKING: DishCooking = { step: 0, timers: {} };

/** How often the timers redraw while one is running. */
const TICK_MS = 250;

/** Current time, updated every `TICK_MS` while `ticking` is true. */
function useNow(ticking: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!ticking) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
    }, TICK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [ticking]);
  return now;
}

/** Step text with the ingredient amounts for the servings in place of `{key}`. */
function StepText({
  text,
  dish,
  servings,
}: {
  text: string;
  dish: DishResponse;
  servings: number;
}) {
  const ingredients = new Map(dish.ingredients.map((item) => [item.key, item]));
  return (
    <p className="font-display text-7xl font-medium">
      {splitStepText(text).map((part, index) => {
        const key = `${String(index)}-${part.kind}`;
        if (part.kind === 'text') return <span key={key}>{part.text}</span>;
        const ingredient = ingredients.get(part.key);
        if (!ingredient) return <span key={key}>{`{${part.key}}`}</span>;
        return (
          <mark
            key={key}
            className="rounded-chip bg-accent-soft box-decoration-clone px-1.5 font-bold text-accent-strong"
          >
            {formatAmount(amountFor(ingredient, dish, servings), ingredient.unit)}
          </mark>
        );
      })}
    </p>
  );
}

const timerLabels: Record<StepTimer['status'] | 'idle', string> = {
  idle: t.timer.start,
  running: t.timer.pause,
  paused: t.timer.resume,
  done: t.timer.done,
};

/** The timer of the step on screen: tap — start / pause / continue; «Сбросить» when started. */
function StepTimerPanel({
  step,
  timer,
  now,
  onToggle,
  onReset,
}: {
  step: DishStep & { timerSeconds: number };
  timer: StepTimer | undefined;
  now: number;
  onToggle: () => void;
  onReset: () => void;
}) {
  const durationMs = step.timerSeconds * 1000;
  // `now` may lag a tick behind a timer just started: never show more than its duration.
  const left = Math.min(durationMs, remainingMs(timer, durationMs, now));
  return (
    <div className="flex items-center gap-2 rounded-card bg-ink p-2 text-white surface-dark">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={timer?.status === 'running'}
        className="flex min-h-16 flex-1 items-center justify-between gap-3 rounded-button px-3 text-left"
      >
        <span className="flex items-center gap-3">
          <IconClock size={26} className="shrink-0 text-amber" aria-hidden="true" />
          <span className="text-lg font-bold">{timerLabels[timer?.status ?? 'idle']}</span>
        </span>
        <span
          role="timer"
          className={
            timer?.status === 'done'
              ? 'font-display text-6xl font-bold text-amber'
              : 'font-display text-6xl font-bold'
          }
        >
          {formatTimer(left)}
        </span>
      </button>
      {timer && (
        <IconButton label={t.timer.reset} icon={<IconRefresh />} variant="dark" onClick={onReset} />
      )}
    </div>
  );
}

/** Timers of the other steps (running, paused or finished); a tap opens that step. */
function OtherTimers({
  dish,
  cooking,
  currentN,
  now,
  onOpen,
}: {
  dish: DishResponse;
  cooking: DishCooking;
  currentN: number;
  now: number;
  onOpen: (index: number) => void;
}) {
  const items = dish.steps.flatMap((step, index) => {
    const timer = cooking.timers[step.n];
    if (step.n === currentN || !timer || step.timerSeconds === null) return [];
    return [{ step, index, timer, left: remainingMs(timer, step.timerSeconds * 1000, now) }];
  });
  if (items.length === 0) return null;
  return (
    <ul aria-label={t.otherTimers} className="flex flex-wrap gap-2">
      {items.map(({ step, index, timer, left }) => (
        <li key={step.n}>
          <button
            type="button"
            onClick={() => {
              onOpen(index);
            }}
            className={
              timer.status === 'done'
                ? 'min-h-11 rounded-tile bg-accent-soft px-3 text-md font-bold text-accent-strong'
                : 'min-h-11 rounded-tile bg-surface px-3 text-md font-bold text-ink shadow-card'
            }
          >
            {timer.status === 'done'
              ? t.otherTimerDone(step.n)
              : t.otherTimer(step.n, formatTimer(left))}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Cooking({ dish }: { dish: DishResponse }) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const onBack = useGoBack(dishPath(dish.id));
  const servings = useAppSelector((state) => selectServings(state, dish.id)) ?? dish.servings;
  const cooking = useAppSelector((state) => selectDishCooking(state, dish.id)) ?? NO_COOKING;
  const wakeLock = useWakeLock();
  useVerticalSwipesDisabled();

  const timers = Object.values(cooking.timers);
  const now = useNow(timers.some((timer) => timer.status === 'running'));

  // A timer that ends while the mode is open signals; one that ended while the user was away
  // (another screen) only shows «Время вышло».
  const openedAt = useRef(Number.POSITIVE_INFINITY);
  useEffect(() => {
    openedAt.current = Date.now();
  }, []);
  const [finished, setFinished] = useState<number[]>([]);
  useEffect(() => {
    const overdue = Object.entries(cooking.timers).filter(([, timer]) => isOverdue(timer, now));
    if (overdue.length === 0) return;
    dispatch(timersElapsed({ dishId: dish.id, now }));
    const loud = overdue.filter(
      ([, timer]) => timer.status === 'running' && timer.endsAt >= openedAt.current,
    );
    if (loud.length > 0) {
      vibrateAlarm();
      playAlarm();
      setFinished(loud.map(([n]) => Number(n)));
    }
  }, [cooking.timers, now, dispatch, dish.id]);

  const total = dish.steps.length;
  const index = Math.min(cooking.step, total - 1);
  const step = dish.steps[index];
  if (!step) return <Navigate to={dishPath(dish.id)} replace />;
  const last = index === total - 1;
  const timer = cooking.timers[step.n];

  const goTo = (next: number) => {
    dispatch(stepChanged({ dishId: dish.id, step: next }));
    window.scrollTo({ top: 0 });
  };

  const toggleTimer = () => {
    if (step.timerSeconds === null) return;
    if (timer?.status === 'running') {
      dispatch(timerPaused({ dishId: dish.id, n: step.n, now: Date.now() }));
      return;
    }
    primeSound();
    setFinished([]);
    dispatch(
      timerStarted({
        dishId: dish.id,
        n: step.n,
        durationMs: step.timerSeconds * 1000,
        now: Date.now(),
      }),
    );
  };

  return (
    <>
      <main className="flex min-h-dvh flex-col gap-6 bg-bg px-5 pt-13 pb-32">
        <div className="flex min-h-11 items-center gap-3">
          <BackNavigation onBack={onBack} icon={<IconClose />} label={t.close} />
          <h1 className="min-w-0 flex-1 truncate text-base font-bold text-muted">{dish.title}</h1>
          <span aria-hidden="true" className="text-base font-extrabold">
            {t.progress(index + 1, total)}
          </span>
        </div>

        <ProgressBar
          variant="steps"
          value={index + 1}
          max={total}
          label={t.progressLabel}
          valueText={t.progressValue(index + 1, total)}
        />

        <section aria-labelledby="cooking-step" className="flex flex-col gap-4 pt-6">
          <h2
            id="cooking-step"
            className="text-md font-extrabold tracking-caps-lg text-accent uppercase"
          >
            {t.step(step.n)}
          </h2>
          <StepText text={step.text} dish={dish} servings={servings} />
        </section>

        {step.timerSeconds !== null && (
          <StepTimerPanel
            step={{ ...step, timerSeconds: step.timerSeconds }}
            timer={timer}
            now={now}
            onToggle={toggleTimer}
            onReset={() => {
              dispatch(timerReset({ dishId: dish.id, n: step.n }));
            }}
          />
        )}

        <OtherTimers dish={dish} cooking={cooking} currentN={step.n} now={now} onOpen={goTo} />

        <div role="status" className="empty:hidden">
          {finished.length > 0 && (
            <p className="text-md font-bold text-accent-strong">
              {finished.map((n) => t.timerDone(n)).join(', ')}
            </p>
          )}
        </div>

        {wakeLock && <p className="text-sm font-semibold text-muted">{t.screenOn}</p>}
      </main>

      <div className="fixed inset-x-0 bottom-0 flex gap-2.5 border-t border-track bg-surface px-5 pt-3 pb-safe-7">
        <Button
          variant="secondary"
          size="lg"
          className="w-28 shrink-0"
          disabled={index === 0}
          onClick={() => {
            goTo(index - 1);
          }}
        >
          {t.back}
        </Button>
        {last ? (
          <Button
            variant="accent"
            size="lg"
            fullWidth
            onClick={() => {
              hapticStepDone();
              dispatch(cookingFinished({ dishId: dish.id }));
              void navigate(cookedPath(dish.id), { replace: true });
            }}
          >
            {t.finish}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              hapticStepDone();
              goTo(index + 1);
            }}
          >
            {t.next}
          </Button>
        )}
      </div>
    </>
  );
}

function CookingSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-6">
      <Skeleton shape="text" width="60%" className="text-base" />
      <Skeleton height={6} />
      <div className="flex flex-col gap-4 pt-6">
        <Skeleton shape="text" width="25%" className="text-md" />
        <Skeleton height={140} />
      </div>
      <Skeleton height={80} />
    </SkeletonGroup>
  );
}

/**
 * «Режим готовки»: one step on screen with the amounts for the chosen servings, a timer for a
 * step with time (keeps counting between steps; vibration and sound at the end), the screen kept
 * on (Screen Wake Lock) and the vertical swipes of Telegram off. «Готово!» on the last step leads
 * to the photo and stamp screen. The dish comes from the card's cached request when there is one.
 */
export default function CookingScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const onBack = useGoBack(dishPath(id));
  const loadedArgs = useAppSelector((state) => selectLoadedDishArgs(state, id));
  const [args] = useState(() => loadedArgs ?? { id });
  const { data, error, isError, refetch } = useDishQuery(args);
  const preview = paywallPreview(error);
  const closedDishId = preview?.dishId;

  useEffect(() => {
    if (closedDishId !== undefined) void navigate(paywallPath(closedDishId), { replace: true });
  }, [closedDishId, navigate]);

  // Loaded steps stay on screen even if a later refetch fails (the connection dropped).
  if (data) return <Cooking dish={data} />;

  let content;
  if (isError && !preview) {
    content = isNotFound(error) ? (
      <div className="flex flex-col items-center gap-4 rounded-card bg-surface px-5 py-8 text-center shadow-card">
        <p role="status" className="text-xl font-extrabold">
          {ru.dish.notFound.title}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            void navigate(ROUTES.home, { replace: true });
          }}
        >
          {ru.dish.notFound.action}
        </Button>
      </div>
    ) : (
      <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />
    );
  }

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-bg px-5 pt-13">
      <BackNavigation onBack={onBack} icon={<IconClose />} label={t.close} />
      {content ?? <CookingSkeleton />}
    </main>
  );
}
