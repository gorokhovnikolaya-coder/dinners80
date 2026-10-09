import { emitEvent } from '@tma.js/sdk-react';

import { ruDevUi } from '../../i18n/ru.ts';

const BUTTON_ID = 'tg-mock-back-button';

/**
 * Stand-in for the Telegram BackButton in a regular browser: Telegram draws it in its own header,
 * outside the page, so the mock shows a small fixed button that sends `back_button_pressed`.
 * Dev-only (part of the mock Telegram environment).
 */
export function setMockBackButtonVisible(visible: boolean): void {
  let button = document.getElementById(BUTTON_ID);
  if (!visible) {
    button?.remove();
    return;
  }
  if (button) return;
  const created = document.createElement('button');
  button = created;
  button.id = BUTTON_ID;
  created.type = 'button';
  button.setAttribute('aria-label', ruDevUi.tgMock.back);
  button.textContent = '←';
  Object.assign(button.style, {
    position: 'fixed',
    top: '4px',
    left: '4px',
    zIndex: '2147483647',
    width: '44px',
    height: '44px',
    border: '0',
    borderRadius: '22px',
    background: 'rgb(255 255 255 / 0.9)',
    color: '#14213d',
    font: '700 22px/1 system-ui, sans-serif',
    boxShadow: '0 1px 4px rgb(0 0 0 / 0.25)',
    cursor: 'pointer',
  });
  button.addEventListener('click', () => {
    emitEvent('back_button_pressed');
  });
  document.body.append(button);
}
