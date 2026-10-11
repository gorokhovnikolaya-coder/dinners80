import { buildShoppingList, type ShoppingAisle, type ShoppingList } from '@tma80/shared';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuthQuery } from '../../api/auth.ts';
import {
  useCheckShoppingMutation,
  useClearCheckedShoppingMutation,
  useShoppingQuery,
} from '../../api/shopping.ts';
import { ROUTES } from '../../app/routes.ts';
import { useGoBack } from '../../app/useGoBack.ts';
import { BackNavigation } from '../../components/BackNavigation.tsx';
import { Button } from '../../components/Button.tsx';
import { Card } from '../../components/Card.tsx';
import { Checkbox } from '../../components/Checkbox.tsx';
import { cx } from '../../components/cx.ts';
import { ErrorState } from '../../components/ErrorState.tsx';
import { IconShare } from '../../components/icons.tsx';
import { Skeleton, SkeletonGroup } from '../../components/Skeleton.tsx';
import { ru } from '../../i18n/ru.ts';
import { inviteLink, shareToChat } from '../../telegram/invite.ts';
import { formatRowAmount, rowDishes, shoppingText } from './shopping.ts';

const t = ru.shopping;

type Failure = 'check' | 'clear' | null;

function AisleCard({
  aisle,
  onCheck,
}: {
  aisle: ShoppingAisle;
  onCheck: (ids: readonly string[], checked: boolean) => void;
}) {
  const headingId = `shopping-aisle-${aisle.aisle}`;
  return (
    <Card as="section" aria-labelledby={headingId} padding="none" className="px-4 py-1.5">
      <h2
        id={headingId}
        className="pt-2.5 pb-1 text-sm font-extrabold tracking-caps text-muted uppercase"
      >
        {t.aisles[aisle.aisle]}
      </h2>
      {aisle.rows.map((row) => (
        <Checkbox
          key={row.key}
          divider
          strikeWhenChecked
          checked={row.checked}
          onChange={(checked) => {
            onCheck(row.itemIds, checked);
          }}
          label={row.name}
          description={rowDishes(row)}
          trailing={formatRowAmount(row)}
          className="min-h-13"
        />
      ))}
    </Card>
  );
}

function ShoppingSkeleton() {
  return (
    <SkeletonGroup label={ru.common.loading} className="flex flex-col gap-3.5">
      <Skeleton shape="text" width="45%" className="text-md" />
      <Skeleton height={160} />
      <Skeleton height={210} />
    </SkeletonGroup>
  );
}

function EmptyList() {
  const navigate = useNavigate();
  return (
    <Card className="flex flex-col items-center gap-3 px-5 py-8 text-center">
      <p role="status" className="text-xl font-extrabold text-balance">
        {t.empty.title}
      </p>
      <p className="text-md text-ink-2 text-balance">{t.empty.description}</p>
      <Button
        variant="secondary"
        className="mt-1"
        onClick={() => {
          void navigate(ROUTES.home);
        }}
      >
        {t.empty.action}
      </Button>
    </Card>
  );
}

function ListContent({ list }: { list: ShoppingList }) {
  const { data: auth } = useAuthQuery(undefined);
  const [check] = useCheckShoppingMutation();
  const [clear, { isLoading: clearing }] = useClearCheckedShoppingMutation();
  const [failure, setFailure] = useState<Failure>(null);
  const text = shoppingText(list);
  const inviteCode = auth?.user.inviteCode;

  const onCheck = (ids: readonly string[], checked: boolean) => {
    setFailure(null);
    check({ ids, checked })
      .unwrap()
      .catch(() => {
        setFailure('check');
      });
  };

  const onClear = () => {
    setFailure(null);
    clear(undefined)
      .unwrap()
      .catch(() => {
        setFailure('clear');
      });
  };

  return (
    <>
      <div className="-mt-2 flex min-h-11 items-center justify-between gap-3">
        <p className="text-md font-semibold text-muted">
          {t.summary(list.dishesCount, list.checkedCount, list.rowsCount)}
        </p>
        {list.checkedCount > 0 && (
          <button
            type="button"
            onClick={clearing ? undefined : onClear}
            aria-busy={clearing}
            aria-disabled={clearing}
            className="-mr-2 flex min-h-11 shrink-0 items-center rounded-tile px-2 text-md font-bold text-primary aria-disabled:text-muted"
          >
            {clearing ? t.clearing : t.clear}
          </button>
        )}
      </div>
      <div className="flex flex-col gap-3.5">
        {list.aisles.map((aisle) => (
          <AisleCard key={aisle.aisle} aisle={aisle} onCheck={onCheck} />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 flex flex-col gap-2.5 border-t border-track bg-surface px-5 pt-3 pb-safe-7">
        <div role="status" className="empty:hidden">
          {failure && (
            <p className="text-md font-semibold text-accent-strong">
              {failure === 'check' ? t.checkError : t.clearError}
            </p>
          )}
        </div>
        <Button
          variant="secondary"
          size="lg"
          fullWidth
          icon={<IconShare size={20} />}
          disabled={text === undefined || inviteCode === undefined}
          onClick={() => {
            if (text !== undefined && inviteCode !== undefined)
              shareToChat(inviteLink(inviteCode), text);
          }}
        >
          {t.send}
        </Button>
      </div>
    </>
  );
}

/**
 * «Список покупок»: the user's items grouped by aisle, the same product with the same unit summed
 * across dishes (`buildShoppingList`), «куплено» marks, «Очистить купленное» and «Отправить
 * список в чат» (the unbought rows as text through Telegram's share link).
 */
export default function ShoppingScreen() {
  const onBack = useGoBack();
  const { data, isError, refetch } = useShoppingQuery(undefined);
  const list = useMemo(() => (data ? buildShoppingList(data.items) : undefined), [data]);

  let content;
  if (list?.rowsCount === 0) content = <EmptyList />;
  else if (list) content = <ListContent list={list} />;
  else if (isError)
    content = <ErrorState description={ru.common.errorHint} onRetry={() => void refetch()} />;
  else content = <ShoppingSkeleton />;

  return (
    <main
      className={cx(
        'flex min-h-dvh flex-col gap-4 bg-bg px-5 pt-14',
        (list?.rowsCount ?? 0) > 0 ? 'pb-36' : 'pb-8',
      )}
    >
      <BackNavigation onBack={onBack} />
      <h1 className="font-display text-4xl font-bold">{t.title}</h1>
      {content}
    </main>
  );
}
