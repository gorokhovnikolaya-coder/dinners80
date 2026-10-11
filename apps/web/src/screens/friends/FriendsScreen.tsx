import {
  LEADERBOARD_PERIODS,
  type FeedItem,
  type LeaderboardEntry,
  type LeaderboardPeriod,
} from '@tma80/shared';
import { useState } from 'react';

import { useAuthQuery } from '../../api/auth.ts';
import { useFriendsFeedQuery, useFriendsLeaderboardQuery } from '../../api/friends.ts';
import { MainTabBar } from '../../app/MainTabBar.tsx';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { cx } from '../../components/cx.ts';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconPlus, IconStamp } from '../../components/icons.tsx';
import { SegmentedControl } from '../../components/SegmentedControl.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { shareInvite } from '../../telegram/invite.ts';
import { initials } from '../home/today.ts';
import { formatFeedTime, hasFriends } from './friends.ts';
import { periodChosen, selectPeriod } from './friendsSlice.ts';

const t = ru.friends;

const PERIOD_OPTIONS = LEADERBOARD_PERIODS.map((period) => ({
  value: period,
  label: t.periods[period],
}));

/** Avatar tints of friends without a Telegram photo, picked by the user id. */
const FRIEND_TINTS = [
  'bg-accent-soft text-accent-strong',
  'bg-primary-soft text-primary-strong',
  'bg-track text-ink-2',
] as const;

const tintOf = (userId: string) => {
  let sum = 0;
  for (let i = 0; i < userId.length; i += 1) sum = (sum + userId.charCodeAt(i)) % 997;
  return FRIEND_TINTS[sum % FRIEND_TINTS.length] ?? FRIEND_TINTS[0];
};

function Avatar({ entry }: { entry: LeaderboardEntry }) {
  const [failed, setFailed] = useState(false);
  const photo = entry.isMe ? null : entry.photoUrl;
  return (
    <span
      aria-hidden="true"
      className={cx(
        'flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-extrabold',
        entry.isMe ? 'bg-ink text-white' : tintOf(entry.userId),
      )}
    >
      {photo && !failed ? (
        <img
          src={photo}
          alt=""
          className="size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      ) : entry.isMe ? (
        t.meInitial
      ) : (
        initials(entry.firstName)
      )}
    </span>
  );
}

function LeaderboardRow({ entry }: { entry: LeaderboardEntry }) {
  return (
    <li
      className="flex min-h-15 items-center gap-3 border-b border-divider py-2 last:border-b-0"
      aria-current={entry.isMe ? 'true' : undefined}
    >
      <span className="w-5 shrink-0 font-display text-base font-bold text-muted">
        <span className="sr-only">{t.place(entry.place)}</span>
        <span aria-hidden="true">{entry.place}</span>
      </span>
      <Avatar entry={entry} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-lg font-extrabold">
          {entry.isMe ? t.me : entry.firstName}
        </span>
        <span className="text-xs font-semibold text-muted">{t.dishes(entry.dishes)}</span>
      </span>
      <span className="font-display text-2xl font-bold">
        <span className="sr-only">{t.countries(entry.countries)}</span>
        <span aria-hidden="true">{entry.countries}</span>
      </span>
    </li>
  );
}

function FeedPhoto({ item }: { item: FeedItem }) {
  const [failed, setFailed] = useState(false);
  if (item.photoUrl && !failed) {
    return (
      <img
        src={item.photoUrl}
        alt={t.feed.photo(item.dishTitle)}
        loading="lazy"
        className="size-13 shrink-0 rounded-tile object-cover"
        onError={() => {
          setFailed(true);
        }}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex size-13 shrink-0 items-center justify-center rounded-tile bg-track text-muted"
    >
      <IconStamp size={26} />
    </span>
  );
}

function FeedRow({ item, now, timezone }: { item: FeedItem; now: Date; timezone: string }) {
  return (
    <li>
      <Card padding="sm" className="flex items-center gap-3">
        <FeedPhoto item={item} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-md">
            <b className="font-extrabold">{item.firstName}</b>
            {' — '}
            {t.feed.inPassport(item.countryName)}
          </p>
          <p className="text-xs text-muted">
            {item.dishTitle} ·{' '}
            <time dateTime={item.createdAt}>{formatFeedTime(item.createdAt, now, timezone)}</time>
          </p>
        </div>
      </Card>
    </li>
  );
}

function FeedSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-2">
      <Skeleton height={76} className="rounded-card" />
      <Skeleton height={76} className="rounded-card" />
    </SkeletonGroup>
  );
}

function Feed({ timezone }: { timezone: string }) {
  const { data, isError, refetch } = useFriendsFeedQuery(undefined);
  const [now] = useState(() => new Date());
  let content;
  if (data) {
    content =
      data.items.length === 0 ? (
        <p role="status" className="text-md text-muted">
          {t.feed.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.items.map((item) => (
            <FeedRow key={item.cookId} item={item} now={now} timezone={timezone} />
          ))}
        </ul>
      );
  } else if (isError) {
    content = <ErrorState description={t.feed.error} onRetry={() => void refetch()} />;
  } else {
    content = <FeedSkeleton />;
  }
  return (
    <section aria-labelledby="friends-feed" className="flex flex-col gap-2">
      <h2 id="friends-feed" className="pt-1 text-md font-extrabold">
        {t.feed.title}
      </h2>
      {content}
    </section>
  );
}

function InviteButton({ inviteCode }: { inviteCode: string | undefined }) {
  return (
    <Button
      fullWidth
      icon={<IconPlus size={20} />}
      disabled={inviteCode === undefined}
      onClick={() => {
        if (inviteCode !== undefined) shareInvite(inviteCode, t.inviteText);
      }}
    >
      {t.invite}
    </Button>
  );
}

function LeaderboardSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-4">
      <Skeleton height={48} className="rounded-tile" />
      <Skeleton height={248} className="rounded-card" />
    </SkeletonGroup>
  );
}

/**
 * «Друзья»: the ranking of the user and the friends by countries (then dishes) for this week or
 * all time, the latest stamps of friends and the invite to Telegram. Without friends — only the
 * invite.
 */
export default function FriendsScreen() {
  const dispatch = useAppDispatch();
  const period = useAppSelector(selectPeriod);
  const { data: auth } = useAuthQuery(undefined);
  const { data, currentData, isError, refetch } = useFriendsLeaderboardQuery(period);
  // While another period loads, the previous ranking stays (the switch already shows the new one).
  const shown = currentData ?? data;
  const inviteCode = auth?.user.inviteCode;
  const timezone = auth?.user.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  let content;
  if (shown && !hasFriends(shown.entries)) {
    content = (
      <Card className="flex flex-col items-center gap-4 px-5 py-8 text-center">
        <p role="status" className="text-xl font-extrabold text-balance">
          {t.empty}
        </p>
        <InviteButton inviteCode={inviteCode} />
      </Card>
    );
  } else if (shown) {
    content = (
      <>
        <SegmentedControl
          label={t.periods.label}
          options={PERIOD_OPTIONS}
          value={period}
          onChange={(next: LeaderboardPeriod) => {
            dispatch(periodChosen(next));
          }}
        />
        {isError && !currentData ? (
          <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />
        ) : (
          <Card as="section" aria-label={t.leaderboard} padding="none" className="px-4 py-1">
            <ol aria-busy={currentData === undefined}>
              {shown.entries.map((entry) => (
                <LeaderboardRow key={entry.userId} entry={entry} />
              ))}
            </ol>
          </Card>
        )}
        <Feed timezone={timezone} />
        <InviteButton inviteCode={inviteCode} />
      </>
    );
  } else if (isError) {
    content = <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />;
  } else {
    content = <LeaderboardSkeleton />;
  }

  return (
    <>
      <main className="flex min-h-dvh flex-col gap-4 bg-bg px-5 pt-14 pb-28">
        <h1 className="font-display text-6xl font-bold">{t.title}</h1>
        {content}
      </main>
      <MainTabBar active="friends" />
    </>
  );
}
