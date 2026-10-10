// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { lazyScreen } from './lazyScreen.tsx';

function Loaded() {
  return <p>Экран загружен</p>;
}

type Load = () => Promise<{ default: typeof Loaded }>;
const chunkError = () => new TypeError('Failed to fetch dynamically imported module');

describe('lazyScreen', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('shows the error state when the chunk fails and imports it again on «Повторить»', async () => {
    const reloadPage = vi.fn();
    const load = vi
      .fn<Load>()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValue({ default: Loaded });
    const Screen = lazyScreen(load, <p>Загрузка экрана</p>, { reloadPage });

    render(<Screen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось открыть экран.');

    await userEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(await screen.findByText('Экран загружен')).toBeInTheDocument();
    expect(load).toHaveBeenCalledTimes(2);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('reloads the page if the retried import fails again (engine cached the failure)', async () => {
    const reloadPage = vi.fn();
    const load = vi.fn<Load>().mockRejectedValue(chunkError());
    const Screen = lazyScreen(load, <p>Загрузка экрана</p>, { reloadPage });

    render(<Screen />);
    await userEvent.click(await screen.findByRole('button', { name: 'Повторить' }));

    await vi.waitFor(() => {
      expect(reloadPage).toHaveBeenCalledTimes(1);
    });
    expect(load).toHaveBeenCalledTimes(2);
    // While the page reloads, the loading fallback stays instead of the error state.
    expect(screen.getByText('Загрузка экрана')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not reload the page on the first failure, only after «Повторить»', async () => {
    const reloadPage = vi.fn();
    const Screen = lazyScreen(vi.fn<Load>().mockRejectedValue(chunkError()), null, {
      reloadPage,
    });
    render(<Screen />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('shows the fallback while loading', async () => {
    const Screen = lazyScreen(() => Promise.resolve({ default: Loaded }), <p>Загрузка экрана</p>);
    render(<Screen />);
    expect(screen.getByText('Загрузка экрана')).toBeInTheDocument();
    expect(await screen.findByText('Экран загружен')).toBeInTheDocument();
  });
});
