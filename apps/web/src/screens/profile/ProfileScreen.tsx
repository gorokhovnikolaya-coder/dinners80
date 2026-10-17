import {
  applyProfilePatch,
  FREE_COUNTRIES_LIMIT,
  REMINDER_TIMES,
  type SubscriptionStatus,
  type UpdateMeRequest,
  type UserProfile,
} from '@tma80/shared';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router';

import { useAuthQuery } from '../../api/auth.ts';
import { track } from '../../api/events.ts';
import { meApi } from '../../api/me.ts';
import { useMapQuery } from '../../api/map.ts';
import { PROFILE_EXCLUSIONS_ID, ROUTES } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { cx } from '../../components/cx.ts';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconAlert, IconCheck, IconExternal } from '../../components/icons.tsx';
import {
  ExclusionsField,
  HouseholdField,
  WeekdayMinutesField,
} from '../../components/preferences/PreferenceFields.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { Switch } from '../../components/Switch.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { openExternalLink } from '../../telegram/links.ts';
import { askWriteAccess, canRequestWriteAccess } from '../../telegram/writeAccess.ts';
import { initials } from '../home/today.ts';
import { formatStampDate } from '../map/passport.ts';
import { detectTimeZone } from '../onboarding/onboarding.ts';
import { createAutosave } from './autosave.ts';
import {
  documentLinks,
  reminderToggledEvent,
  exclusionsPatch,
  reminderView,
  subscriptionView,
  withTimeZone,
} from './profile.ts';
import { selectWriteAccessAllowed, writeAccessAllowed } from './profileSlice.ts';

const t = ru.profile;

/** Documents of the build: `VITE_TERMS_URL` / `VITE_PRIVACY_URL`, dev placeholders in dev. */
const DOCUMENTS = documentLinks({
  terms: import.meta.env.VITE_TERMS_URL,
  privacy: import.meta.env.VITE_PRIVACY_URL,
  dev: import.meta.env.DEV,
});

const sectionTitle = 'text-2xl font-extrabold text-ink';

function ProfileAvatar({ user }: { user: UserProfile }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft font-display text-5xl font-bold text-primary-strong">
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
    </span>
  );
}

/** «8 из 30 стран» and «13 блюд» from the passport (`GET /map`). */
function Counters() {
  const { data, isError, isFetching, refetch } = useMapQuery(undefined);
  if (isError) {
    return (
      <ErrorState
        description={ru.common.errorHint}
        retrying={isFetching}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data) {
    return (
      <SkeletonGroup label={ru.common.loading} className="flex gap-2">
        <Skeleton width={128} height={36} className="rounded-chip" />
        <Skeleton width={88} height={36} className="rounded-chip" />
      </SkeletonGroup>
    );
  }
  const counter = 'rounded-chip bg-bg px-3 py-2 text-md font-bold text-ink-2';
  return (
    <ul className="flex flex-wrap gap-2">
      <li className={counter}>{t.countries(data.countriesCount, data.countriesTotal)}</li>
      <li className={counter}>{t.dishes(data.dishesCount)}</li>
    </ul>
  );
}

function SubscriptionBlock({
  subscription,
  timezone,
  now,
}: {
  subscription: SubscriptionStatus;
  timezone: string;
  now: Date;
}) {
  const navigate = useNavigate();
  const headingId = useId();
  const view = subscriptionView(subscription, now);
  const date = (iso: string) => formatStampDate(iso, timezone, now);
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className={sectionTitle}>
        {t.subscription.title}
      </h2>
      <Card className="flex flex-col gap-3">
        {view.kind === 'active' ? (
          <p className="flex items-center gap-2.5 text-xl font-extrabold">
            <IconCheck size={22} className="shrink-0 text-primary" />
            {view.expiresAt === null
              ? t.subscription.activeNoDate
              : t.subscription.active(date(view.expiresAt))}
          </p>
        ) : (
          <>
            <p className="text-xl font-extrabold">
              {view.kind === 'expired'
                ? t.subscription.expired(date(view.expiresAt))
                : t.subscription.free(FREE_COUNTRIES_LIMIT)}
            </p>
            <Button
              variant="primary"
              fullWidth
              onClick={() => {
                void navigate(ROUTES.paywall);
              }}
            >
              {t.subscription.open}
            </Button>
          </>
        )}
      </Card>
    </section>
  );
}

function Documents() {
  const headingId = useId();
  if (DOCUMENTS.length === 0) return null;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h2 id={headingId} className={sectionTitle}>
        {t.documents.title}
      </h2>
      <Card as="div" padding="none">
        <ul>
          {DOCUMENTS.map((document) => (
            <li key={document.kind} className="border-divider not-first:border-t">
              <a
                href={document.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  // Inside Telegram the page opens over the mini app (Instant View if possible);
                  // elsewhere the browser follows the link to a new tab.
                  if (openExternalLink(document.url)) event.preventDefault();
                }}
                className="flex min-h-13 items-center justify-between gap-3 px-4 text-lg font-bold text-ink no-underline"
              >
                {t.documents[document.kind]}
                <IconExternal size={20} className="shrink-0 text-muted" />
              </a>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  );
}

/**
 * «Профиль и настройки» (ТЗ, экран 9): avatar, name and counters; the dinner reminder (asks
 * Telegram to let the bot write when needed) and its time; the subscription or «Открыть все
 * страны» → paywall; the onboarding answers with the onboarding controls; the documents.
 * Every change is saved at once (`PATCH /me`, see `createAutosave`): shown immediately, rolled
 * back with «Не удалось сохранить…» and «Повторить» if the server did not save it.
 */
export default function ProfileScreen() {
  const { data: auth } = useAuthQuery(undefined);
  const dispatch = useAppDispatch();
  const onBack = useGoBack();
  const { hash } = useLocation();
  const [now] = useState(() => new Date());
  const [canRequest] = useState(canRequestWriteAccess);
  const allowedInSession = useAppSelector(selectWriteAccessAllowed);
  const [asking, setAsking] = useState(false);
  const alive = useRef(true);
  const exclusionsHeading = useRef<HTMLHeadingElement>(null);
  const timeId = useId();
  const householdId = useId();
  const minutesId = useId();
  const exclusionsId = useId();

  const [autosave] = useState(() =>
    createAutosave(async (patch: UpdateMeRequest) => {
      const request = dispatch(meApi.endpoints.updateMe.initiate(patch));
      try {
        const { user: saved } = await request.unwrap();
        const event = reminderToggledEvent(patch, saved);
        if (event) track(event);
      } finally {
        // The result is in the auth cache now; drop the mutation entry from the store.
        request.reset();
      }
    }),
  );
  const { pending, failed } = useSyncExternalStore(autosave.subscribe, autosave.getSnapshot);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  // «Изменить исключения» on the main screen opens the profile at «Что не едите».
  useEffect(() => {
    if (hash !== `#${PROFILE_EXCLUSIONS_ID}`) return;
    const heading = exclusionsHeading.current;
    heading?.scrollIntoView({ block: 'start' });
    heading?.focus({ preventScroll: true });
  }, [hash]);

  // The app routes here only after `POST /auth`, so the profile is in the cache.
  if (!auth) return null;
  const server = auth.user;
  // Changes being saved are shown over the server profile.
  const user = pending ? applyProfilePatch(server, pending) : server;
  const reminder = reminderView(user, allowedInSession, canRequest);

  const toggleReminder = async (on: boolean) => {
    if (!on) {
      autosave.save({ reminderEnabled: false });
      return;
    }
    if (reminder.needsWriteAccess) {
      setAsking(true);
      const allowed = await askWriteAccess();
      if (alive.current) setAsking(false);
      // Declined: the switch stays off, nothing to say (ТЗ).
      if (!allowed) return;
      dispatch(writeAccessAllowed());
    }
    autosave.save(withTimeZone({ reminderEnabled: true }, user.timezone, detectTimeZone()));
  };

  return (
    <main
      className={cx(
        'flex min-h-dvh flex-col gap-6 bg-bg px-5 pt-14 text-ink',
        failed ? 'pb-40' : 'pb-safe-8',
      )}
    >
      <BackNavigation onBack={onBack} />
      <h1 className="font-display text-4xl font-bold">{t.title}</h1>

      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <ProfileAvatar user={user} />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="font-display text-3xl font-bold break-words">{user.firstName}</p>
            {user.username !== null && (
              <p className="text-md text-muted">{t.username(user.username)}</p>
            )}
          </div>
        </div>
        <Counters />
      </Card>

      <Card className="flex flex-col gap-3">
        <Switch
          checked={reminder.checked}
          onChange={(on) => void toggleReminder(on)}
          label={t.reminder.title}
          description={t.reminder.description}
          disabled={reminder.unavailable}
          busy={asking}
        />
        {reminder.unavailable && (
          <p className="flex items-center gap-2 text-md font-semibold text-ink-2">
            <IconAlert size={20} className="shrink-0 text-accent-strong" />
            {t.reminder.updateTelegram}
          </p>
        )}
        {reminder.checked && (
          <div className="flex items-center justify-between gap-3 border-t border-divider pt-3">
            <label htmlFor={timeId} className="text-lg font-bold">
              {t.reminder.time}
            </label>
            <select
              id={timeId}
              value={user.reminderTime}
              onChange={(event) => {
                autosave.save(
                  withTimeZone(
                    { reminderTime: event.target.value },
                    user.timezone,
                    detectTimeZone(),
                  ),
                );
              }}
              className="min-h-11 rounded-button border-[1.5px] border-muted bg-surface px-3 text-lg font-bold text-ink"
            >
              {REMINDER_TIMES.map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
            </select>
          </div>
        )}
      </Card>

      <SubscriptionBlock subscription={auth.subscription} timezone={user.timezone} now={now} />

      <section aria-labelledby={householdId} className="flex flex-col gap-3">
        <h2 id={householdId} className={sectionTitle}>
          {t.preferences.household}
        </h2>
        <HouseholdField
          value={user.household}
          onChange={(household) => {
            autosave.save({ household });
          }}
          labelledBy={householdId}
        />
      </section>

      <section aria-labelledby={minutesId} className="flex flex-col gap-3">
        <h2 id={minutesId} className={sectionTitle}>
          {t.preferences.weekdayMinutes}
        </h2>
        <WeekdayMinutesField
          value={user.weekdayMinutes}
          onChange={(weekdayMinutes) => {
            autosave.save({ weekdayMinutes });
          }}
          labelledBy={minutesId}
        />
      </section>

      <section
        id={PROFILE_EXCLUSIONS_ID}
        aria-labelledby={exclusionsId}
        className="flex flex-col gap-3"
      >
        <h2
          id={exclusionsId}
          ref={exclusionsHeading}
          tabIndex={-1}
          className={cx(sectionTitle, 'scroll-mt-16 focus-visible:outline-none')}
        >
          {t.preferences.exclusions}
        </h2>
        <ExclusionsField
          value={{ exclusions: user.exclusions, customExclusions: user.customExclusions }}
          onChange={(next) => {
            const patch = exclusionsPatch(user, next);
            if (patch) autosave.save(patch);
          }}
          labelledBy={exclusionsId}
        />
      </section>

      <Documents />

      {failed && (
        <div className="fixed inset-x-0 bottom-0 flex items-center gap-3 border-t border-track bg-surface px-5 pt-3 pb-safe-7">
          <p role="alert" className="flex-1 text-md font-semibold text-accent-strong">
            {t.saveError}
          </p>
          <Button variant="secondary" onClick={autosave.retry}>
            {t.retry}
          </Button>
        </div>
      )}
    </main>
  );
}
