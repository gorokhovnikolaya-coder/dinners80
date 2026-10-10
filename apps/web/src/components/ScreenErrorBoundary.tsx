import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ru } from '../i18n/ru.ts';
import { ErrorState } from './ErrorState.tsx';

export interface ScreenErrorBoundaryProps {
  children: ReactNode;
  /** Called by «Повторить» before the boundary renders the children again. */
  onRetry: () => void;
}

interface State {
  failed: boolean;
}

/**
 * Catches a failed screen (e.g. a lazy chunk that did not load on a bad network) and shows
 * the error state with «Повторить» instead of a blank page.
 */
export class ScreenErrorBoundary extends Component<ScreenErrorBoundaryProps, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('Screen failed to render', error, info.componentStack);
  }

  private readonly retry = () => {
    this.props.onRetry();
    this.setState({ failed: false });
  };

  override render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-dvh bg-bg px-5 pt-14 pb-8">
        <ErrorState
          title={ru.common.screenLoadError}
          description={ru.common.errorHint}
          onRetry={this.retry}
        />
      </main>
    );
  }
}
