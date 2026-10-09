import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import { App } from './app/App.tsx';
import { store } from './store/store.ts';
import { initTelegram } from './telegram/sdk.ts';

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

  createRoot(container).render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>,
  );
}

void bootstrap();
