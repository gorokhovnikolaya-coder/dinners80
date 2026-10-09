import './styles/index.css';

import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './app/App.tsx';
import { store } from './store/store.ts';
import { initTelegram } from './telegram/sdk.ts';

/**
 * Root element: the app, or the component gallery `/dev/ui` in dev. `import.meta.env.DEV` is
 * false in `vite build`, so the branch and the gallery chunk are dropped from production.
 */
async function resolveRoot(): Promise<ReactNode> {
  if (import.meta.env.DEV && window.location.pathname === '/dev/ui') {
    const { DevUiPage } = await import('./dev/DevUiPage.tsx');
    return <DevUiPage />;
  }
  return (
    <Provider store={store}>
      <App />
    </Provider>
  );
}

async function bootstrap() {
  // Dev-only mocks are loaded dynamically under build-time flags, so a production build
  // (where the flags are never set, see vite.config.ts) drops them together with MSW.
  if (import.meta.env.VITE_TG_MOCK === '1') {
    const { mockTelegram } = await import('./telegram/mock/index.ts');
    mockTelegram();
  }
  await initTelegram();
  if (import.meta.env.VITE_API === 'mock') {
    const { startMockApi } = await import('./mocks/browser.ts');
    await startMockApi();
  }

  const container = document.getElementById('root');
  if (!container) {
    throw new Error('Root element #root not found');
  }

  createRoot(container).render(<StrictMode>{await resolveRoot()}</StrictMode>);
}

void bootstrap();
