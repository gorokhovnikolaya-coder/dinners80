import { expect, test } from '@playwright/test';

const COMPONENTS = [
  'Button',
  'Card',
  'Chip',
  'TabBar',
  'ProgressBar',
  'Checkbox',
  'Skeleton',
  'ErrorState',
];

test.describe('/dev/ui component gallery', () => {
  test('shows all 8 base components', async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { level: 1, name: 'Компоненты' })).toBeVisible();

    for (const name of COMPONENTS) {
      await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    }

    await expect(page.getByRole('button', { name: 'Начать готовить' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Недоступно' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Без мяса' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('navigation', { name: 'Разделы' })).toBeVisible();
    await expect(page.getByRole('progressbar').first()).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Картофель/ })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: /Говядина/ })).not.toBeChecked();
    await expect(page.getByRole('status').first()).toContainText('Загрузка карточки блюда');
    await expect(page.getByRole('alert')).toHaveText('Не удалось загрузить данные.');
  });

  test('components react to input', async ({ page }) => {
    await page.goto('/dev/ui');

    const chip = page.getByRole('button', { name: 'Без свинины' });
    await expect(chip).toHaveAttribute('aria-pressed', 'false');
    await chip.click();
    await expect(chip).toHaveAttribute('aria-pressed', 'true');

    const beef = page.getByRole('checkbox', { name: /Говядина/ });
    await beef.check();
    await expect(beef).toBeChecked();

    const tabs = page.getByRole('navigation', { name: 'Разделы' });
    await tabs.getByRole('link', { name: 'Карта' }).click();
    await expect(tabs.getByRole('link', { name: 'Карта' })).toHaveAttribute('aria-current', 'page');
    await expect(tabs.getByRole('link', { name: 'Ужин' })).not.toHaveAttribute('aria-current');

    await page.getByRole('button', { name: 'Повторить' }).click();
    await expect(page.getByText('Нажато «Повторить»: 1')).toBeVisible();
  });

  test('interactive elements have touch targets of at least 44 × 44 px', async ({ page }) => {
    await page.goto('/dev/ui');
    await expect(page.getByRole('heading', { level: 2, name: 'ErrorState' })).toBeVisible();

    const small = await page.evaluate(() =>
      [...document.querySelectorAll('main button, main a, main label')]
        .map((el) => {
          const { width, height } = el.getBoundingClientRect();
          return { text: el.textContent || el.getAttribute('aria-label'), width, height };
        })
        .filter((box) => box.width < 44 || box.height < 44),
    );
    expect(small).toEqual([]);
  });
});
