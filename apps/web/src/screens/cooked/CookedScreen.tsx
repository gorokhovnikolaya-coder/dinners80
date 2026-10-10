import { COOKS_PER_DAY_LIMIT, type CreateCookResponse, type DishResponse } from '@tma80/shared';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { useAuthQuery } from '../../api/auth.ts';
import { errorStatus, useCreateCookMutation, useUploadCookPhotoMutation } from '../../api/cooks.ts';
import { paywallPreview, selectLoadedDishArgs, useDishQuery } from '../../api/dishes.ts';
import { dishPath, paywallPath, ROUTES } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconCamera } from '../../components/icons.tsx';
import { ProgressBar } from '../../components/ProgressBar.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { useAppDispatch, useAppSelector } from '../../store/hooks.ts';
import { vibrateStamp } from '../../telegram/haptics.ts';
import { useDarkTelegramChrome } from '../../telegram/hooks.ts';
import { selectAwaitingStamp, stampScreenClosed } from '../cooking/cookingSlice.ts';
import { compressCookPhoto } from './compress.ts';
import { stampCountryClass, stampDate } from './stamp.ts';

const t = ru.cooked;

/** Where the screen is: choosing a photo, uploading it, recording the cook, the stamp. */
type Phase =
  | { kind: 'choose' }
  | { kind: 'uploading' }
  | { kind: 'uploadError' }
  | { kind: 'saving' }
  | { kind: 'saveError' }
  | { kind: 'rateLimited' }
  | { kind: 'done'; result: CreateCookResponse };

/**
 * Object URL of the compressed photo for `<img>`: `show(blob)` replaces it (revoking the previous
 * one), the last one is revoked when the screen closes.
 */
function usePhotoUrl(): [string | undefined, (blob: Blob | undefined) => void] {
  const [url, setUrl] = useState<string>();
  const current = useRef<string>(undefined);
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );
  const show = useCallback((blob: Blob | undefined) => {
    if (current.current) URL.revokeObjectURL(current.current);
    current.current = blob ? URL.createObjectURL(blob) : undefined;
    setUrl(current.current);
  }, []);
  return [url, show];
}

/** The navy result: the photo with the stamp of a new country, counters, the overtaken friend. */
function StampResult({
  dish,
  result,
  photoUrl,
  timezone,
}: {
  dish: DishResponse;
  result: CreateCookResponse;
  photoUrl: string | undefined;
  timezone: string;
}) {
  const navigate = useNavigate();
  const toHome = useCallback(() => {
    void navigate(ROUTES.home, { replace: true });
  }, [navigate]);
  const [date] = useState(() => stampDate(new Date(), timezone));
  const heading = useRef<HTMLHeadingElement>(null);
  const { newCountry } = result;

  useEffect(() => {
    heading.current?.focus();
    if (newCountry) vibrateStamp();
  }, [newCountry]);

  return (
    <main className="flex min-h-dvh flex-col items-center gap-5 bg-ink px-5 pt-16 pb-safe-8 text-white surface-dark">
      <BackNavigation onBack={toHome} className="absolute top-3 left-5" />
      <p className="text-md font-extrabold tracking-caps-xl text-amber uppercase">
        {newCountry ? t.newCountry : t.repeat}
      </p>

      <div className="relative aspect-square w-full max-w-75">
        <img
          src={photoUrl ?? dish.imageUrl}
          alt={photoUrl ? t.yourPhoto(dish.title) : t.dishPhoto(dish.title)}
          className="size-full rounded-sheet bg-navy-2 object-cover"
        />
        {newCountry && (
          <div
            role="img"
            aria-label={t.stamp.label(dish.countryName, date)}
            data-testid="stamp"
            className="absolute -right-3.5 -bottom-4.5 flex size-33 -rotate-12 flex-col items-center justify-center gap-0.5 rounded-full border-4 border-accent bg-white px-2 text-center text-accent shadow-raised motion-safe:animate-stamp"
          >
            <span className="text-3xs font-extrabold tracking-caps-lg uppercase">
              {t.stamp.caption}
            </span>
            <span
              className={`font-display leading-none font-bold uppercase ${stampCountryClass(dish.countryName)}`}
            >
              {dish.countryName}
            </span>
            <span className="text-2xs font-extrabold">{date}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-1.5 pt-3 text-center">
        <h1 ref={heading} tabIndex={-1} className="font-display text-6xl font-bold outline-none">
          {newCountry ? t.inPassport(dish.countryName) : dish.title}
        </h1>
        <p className="text-lg text-border">
          {t.dishLine(newCountry ? dish.title : dish.countryName, result.dishesCount)}
        </p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <div className="flex justify-between text-md font-bold">
          <span>{t.countries(result.countriesCount, result.countriesTotal)}</span>
          {newCountry && <span className="text-amber">{t.plusToday}</span>}
        </div>
        <ProgressBar
          value={result.countriesCount}
          max={result.countriesTotal}
          label={t.countriesLabel}
          valueText={t.countries(result.countriesCount, result.countriesTotal)}
          tone="dark"
          size="md"
        />
        {result.overtook !== null && (
          <p className="text-sm text-on-dark-muted">{t.overtook(result.overtook)}</p>
        )}
      </div>

      {/* «Поделиться карточкой» comes with the share card (task 20). */}
      <div className="mt-auto flex w-full flex-col gap-2.5">
        <Button
          variant="outlineDark"
          size="lg"
          fullWidth
          onClick={() => {
            void navigate(ROUTES.map);
          }}
        >
          {t.openMap}
        </Button>
      </div>
    </main>
  );
}

/**
 * The light first step: take a photo (camera or gallery, a plain `input type=file`) or go on
 * without; the photo is compressed and uploaded, then the cook is recorded.
 */
function Cooked({ dish, timezone }: { dish: DishResponse; timezone: string }) {
  const navigate = useNavigate();
  const onBack = useGoBack(dishPath(dish.id));
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' });
  const [photoUrl, showPhoto] = usePhotoUrl();
  const picked = useRef<File>(undefined);
  const compressed = useRef<Blob>(undefined);
  const photoPath = useRef<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const [uploadPhoto] = useUploadCookPhotoMutation();
  const [createCook] = useCreateCookMutation();
  useDarkTelegramChrome(phase.kind === 'done');

  const save = async (path: string | null) => {
    setPhase({ kind: 'saving' });
    try {
      const result = await createCook({ dishId: dish.id, photoPath: path }).unwrap();
      window.scrollTo({ top: 0 });
      setPhase({ kind: 'done', result });
    } catch (error) {
      const status = errorStatus(error);
      if (status === 403) void navigate(paywallPath(dish.id), { replace: true });
      else setPhase({ kind: status === 429 ? 'rateLimited' : 'saveError' });
    }
  };

  const upload = async () => {
    const file = picked.current;
    if (!file) return;
    setPhase({ kind: 'uploading' });
    try {
      // A retry after a failed upload sends the same compressed photo again.
      compressed.current ??= await compressCookPhoto(file);
      showPhoto(compressed.current);
      photoPath.current = (await uploadPhoto(compressed.current).unwrap()).photoPath;
    } catch {
      setPhase({ kind: 'uploadError' });
      return;
    }
    await save(photoPath.current);
  };

  const onPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be picked again later.
    event.target.value = '';
    if (!file) return;
    picked.current = file;
    compressed.current = undefined;
    photoPath.current = null;
    showPhoto(undefined);
    void upload();
  };

  const withoutPhoto = () => {
    showPhoto(undefined);
    compressed.current = undefined;
    photoPath.current = null;
    void save(null);
  };

  if (phase.kind === 'done') {
    return (
      <StampResult dish={dish} result={phase.result} photoUrl={photoUrl} timezone={timezone} />
    );
  }

  const busy = phase.kind === 'uploading' || phase.kind === 'saving';
  let actions;
  switch (phase.kind) {
    case 'choose':
      actions = (
        <>
          <Button
            variant="accent"
            size="lg"
            fullWidth
            icon={<IconCamera size={22} />}
            onClick={() => input.current?.click()}
          >
            {t.photo.take}
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={withoutPhoto}>
            {t.photo.skip}
          </Button>
        </>
      );
      break;
    case 'uploading':
    case 'saving':
      actions = (
        <Button variant="accent" size="lg" fullWidth loading>
          {phase.kind === 'uploading' ? t.photo.uploading : t.saving}
        </Button>
      );
      break;
    case 'uploadError':
      actions = (
        <>
          <Button variant="accent" size="lg" fullWidth onClick={() => void upload()}>
            {t.photo.retry}
          </Button>
          <Button variant="secondary" size="lg" fullWidth onClick={withoutPhoto}>
            {t.photo.continueWithout}
          </Button>
        </>
      );
      break;
    case 'saveError':
      actions = (
        <Button variant="accent" size="lg" fullWidth onClick={() => void save(photoPath.current)}>
          {t.photo.retry}
        </Button>
      );
      break;
    case 'rateLimited':
      actions = (
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          onClick={() => {
            void navigate(ROUTES.home, { replace: true });
          }}
        >
          {t.toHome}
        </Button>
      );
      break;
  }

  const problem =
    phase.kind === 'uploadError'
      ? t.photo.uploadError
      : phase.kind === 'saveError'
        ? t.saveError
        : phase.kind === 'rateLimited'
          ? t.rateLimited(COOKS_PER_DAY_LIMIT)
          : undefined;

  return (
    <main className="flex min-h-dvh flex-col gap-5 bg-bg px-5 pt-13 pb-safe-8">
      {/* No «Назад» while the photo uploads or the cook is saved: leaving then would record it unseen. */}
      <BackNavigation onBack={busy ? undefined : onBack} />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-6xl font-bold">{t.photo.title}</h1>
        <p className="text-lg text-ink-2">{t.photo.description}</p>
      </div>

      <div className="relative flex aspect-square w-full max-w-90 items-center justify-center self-center overflow-hidden rounded-sheet bg-surface shadow-card">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt={t.yourPhoto(dish.title)}
            className="absolute inset-0 size-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-3 px-6 text-center text-muted">
            <IconCamera size={56} />
            <p className="text-xl font-bold text-ink">{dish.title}</p>
          </div>
        )}
      </div>

      <div role="status" className="empty:hidden">
        {problem && <p className="text-lg font-bold text-accent-strong">{problem}</p>}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        hidden
        tabIndex={-1}
        aria-hidden="true"
        data-testid="photo-input"
        disabled={busy}
        onChange={onPick}
      />
      <div className="mt-auto flex flex-col gap-2.5">{actions}</div>
    </main>
  );
}

function CookedSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-5">
      <Skeleton shape="text" width="70%" className="text-6xl" />
      <Skeleton shape="text" width="50%" className="text-lg" />
      <Skeleton height={300} />
    </SkeletonGroup>
  );
}

/**
 * «Фото и штамп» after «Готово!»: offers a photo of the dish (optional), records the cook
 * (`POST /cooks`) and shows the stamp of a new country (animation, vibration) or the count of a
 * repeated dish. Opens only right after «Готово!» — a reload or a link leads to the dish card, so
 * a cook is never recorded twice.
 */
export default function CookedScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const awaiting = useAppSelector((state) => selectAwaitingStamp(state, id));
  const [allowed] = useState(awaiting);
  const loadedArgs = useAppSelector((state) => selectLoadedDishArgs(state, id));
  const [args] = useState(() => loadedArgs ?? { id });
  const { data, error, isError, refetch } = useDishQuery(args, { skip: !allowed });
  const { data: auth } = useAuthQuery(undefined);
  const onBack = useGoBack(dishPath(id));
  const dispatch = useAppDispatch();

  // Leaving the screen, with a cook recorded or without a choice, closes it for this «Готово!»:
  // history «forward» or a link cannot open it again.
  useEffect(
    () => () => {
      dispatch(stampScreenClosed({ dishId: id }));
    },
    [dispatch, id],
  );
  const closedDishId = paywallPreview(error)?.dishId;

  useEffect(() => {
    if (closedDishId !== undefined) void navigate(paywallPath(closedDishId), { replace: true });
  }, [closedDishId, navigate]);

  if (!allowed) return <Navigate to={dishPath(id)} replace />;
  if (data && auth) return <Cooked dish={data} timezone={auth.user.timezone} />;

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-bg px-5 pt-13">
      <BackNavigation onBack={onBack} />
      {isError && closedDishId === undefined ? (
        <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />
      ) : (
        <CookedSkeleton />
      )}
    </main>
  );
}
