import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';

import { paywallPreview, useDishQuery } from '../../api/dishes.ts';
import { dishPath } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { IconLock } from '../../components/icons.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';

const t = ru.paywallStub;

function PreviewPhoto({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="relative block h-45 overflow-hidden rounded-card bg-track">
      {!failed && (
        <img
          src={url}
          alt=""
          className="absolute inset-0 size-full object-cover"
          onError={() => {
            setFailed(true);
          }}
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-ink/40">
        <span className="flex size-12 items-center justify-center rounded-full bg-ink text-white">
          <IconLock size={24} />
        </span>
      </span>
    </span>
  );
}

/**
 * Temporary paywall (until task 12): the preview of the closed dish from `403 paywall`
 * (`?dish=<id>`), «Откроется с подпиской» and «Не сейчас» (back). If the dish turns out to be
 * open, the dish card is shown instead.
 */
export default function PaywallStubScreen() {
  const [params] = useSearchParams();
  const dishId = params.get('dish');
  const { data, error, isLoading } = useDishQuery({ id: dishId ?? '' }, { skip: dishId === null });
  const preview = paywallPreview(error);

  const onBack = useGoBack();

  if (data && dishId !== null) return <Navigate to={dishPath(dishId)} replace />;

  return (
    <main className="flex min-h-dvh flex-col gap-4 bg-bg px-5 pt-14 pb-safe-8">
      <BackNavigation onBack={onBack} />
      {isLoading ? (
        <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-3">
          <Skeleton height={180} />
          <Skeleton shape="text" width="60%" className="text-6xl" />
        </SkeletonGroup>
      ) : (
        <>
          {preview && (
            <div className="flex flex-col gap-3">
              <PreviewPhoto url={preview.imageUrl} />
              <span className="text-sm font-extrabold tracking-caps-md text-muted uppercase">
                {preview.countryName}
              </span>
              <p className="font-display text-6xl font-bold">{preview.title}</p>
            </div>
          )}
          <h1 className="flex items-center gap-2 text-2xl font-extrabold text-accent-strong">
            <IconLock size={20} />
            {t.title}
          </h1>
          <p className="text-md text-ink-2">{t.description}</p>
          <Button variant="secondary" fullWidth onClick={onBack} className="mt-auto">
            {t.notNow}
          </Button>
        </>
      )}
    </main>
  );
}
