import { absoluteMediaUrl, type CreateCookResponse, type DishResponse } from '@tma80/shared';
import { useEffect, useId, useRef, useState } from 'react';

import { errorStatus } from '../../api/cooks.ts';
import { usePrepareShareStampMutation, useUploadShareCardMutation } from '../../api/share.ts';
import { Button } from '../../components/Button.tsx';
import { ru } from '../../i18n/ru.ts';
import { inviteLink, shareToChat } from '../../telegram/invite.ts';
import {
  canShareMessage,
  canShareStory,
  sendPreparedMessage,
  shareCardToStory,
} from '../../telegram/share.ts';
import { shareFallbackText, storyCaption } from './share.ts';
import { drawShareCard } from './shareCard.ts';

const t = ru.cooked.share;

type Channel = 'story' | 'chat';

/**
 * The share sheet of the stamp (decision 0022): «В историю» (`shareToStory`, hidden where the client
 * cannot post stories), «Отправить в чат» (a prepared message by `shareMessage`; without it or when
 * the server cannot prepare one — the invite link by `t.me/share/url`) and «Отмена». The card is
 * drawn and uploaded once per cook; a failed drawing or upload offers «Повторить».
 */
export function ShareSheet({
  open,
  onClose,
  dish,
  result,
  photoUrl,
  stampDate,
  inviteCode,
}: {
  open: boolean;
  onClose: () => void;
  dish: DishResponse;
  result: CreateCookResponse;
  /** The user's compressed photo (object URL); without it the content photo of the dish. */
  photoUrl: string | undefined;
  stampDate: string;
  inviteCode: string;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState<Channel | null>(null);
  const [failed, setFailed] = useState<Channel | null>(null);
  const [storyAvailable] = useState(canShareStory);
  const card = useRef<string>(undefined);
  const [uploadCard] = useUploadShareCardMutation();
  const [prepareMessage] = usePrepareShareStampMutation();
  const subject = { dish, result };
  const link = inviteLink(inviteCode);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setFailed(null);
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  /** The public URL of the card: drawn and uploaded on the first use. */
  const ensureCard = async (): Promise<string> => {
    if (card.current !== undefined) return card.current;
    const blob = await drawShareCard({
      ...subject,
      photoUrl: photoUrl ?? dish.imageUrl,
      stampDate,
    });
    const { url } = await uploadCard({ cookId: result.cookId, card: blob }).unwrap();
    card.current = url;
    return url;
  };

  const fallback = () => {
    shareToChat(link, shareFallbackText(subject));
  };

  const share = async (channel: Channel) => {
    if (busy) return;
    setFailed(null);
    if (channel === 'chat' && !canShareMessage()) {
      onClose();
      fallback();
      return;
    }
    setBusy(channel);
    try {
      const url = await ensureCard();
      if (channel === 'story') {
        const opened = shareCardToStory({
          mediaUrl: absoluteMediaUrl(url, window.location.origin),
          text: storyCaption(subject, link),
          link: { url: link, name: t.storyLink },
        });
        if (!opened) throw new Error('The story editor did not open');
        onClose();
        return;
      }
      let id: string;
      try {
        id = (await prepareMessage(result.cookId).unwrap()).preparedMessageId;
      } catch (error) {
        // The server cannot prepare the message (no bot settings, Bot API refused): the link.
        if (errorStatus(error) !== 503) throw error;
        onClose();
        fallback();
        return;
      }
      onClose();
      await sendPreparedMessage(id);
    } catch {
      setFailed(channel);
    } finally {
      setBusy(null);
    }
  };

  const channelButton = (channel: Channel, label: string, variant: 'accent' | 'secondary') => (
    <Button
      variant={variant}
      size="lg"
      fullWidth
      loading={busy === channel}
      disabled={busy !== null && busy !== channel}
      onClick={() => void share(channel)}
    >
      {busy === channel ? t.preparing : failed === channel ? t.retry : label}
    </Button>
  );

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      data-testid="share-sheet"
      onClose={onClose}
      onCancel={(event) => {
        // Escape while the card is prepared would leave the result of the click unseen.
        if (busy) event.preventDefault();
      }}
      className="mx-0 mt-auto mb-0 w-full max-w-none rounded-t-sheet bg-surface px-5 pt-6 pb-safe-8 text-ink backdrop:bg-ink/60"
    >
      <div className="flex flex-col gap-3">
        <h2 id={titleId} className="font-display text-4xl font-bold">
          {t.title}
        </h2>
        <div role="status" className="empty:hidden">
          {failed && <p className="text-lg font-bold text-accent-strong">{t.error}</p>}
        </div>
        {storyAvailable && channelButton('story', t.story, 'accent')}
        {channelButton('chat', t.chat, storyAvailable ? 'secondary' : 'accent')}
        <Button variant="ghost" size="lg" fullWidth disabled={busy !== null} onClick={onClose}>
          {t.cancel}
        </Button>
      </div>
    </dialog>
  );
}
