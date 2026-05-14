import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary scoped to the recording overlay.
 * Catches crashes without taking down the whole app — renders a
 * non-intrusive toast-style notification via portal on document.body.
 */
export class RecordingErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Recording] Crash caught by boundary:', error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return createPortal(
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 99999,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 16px',
            background: '#1c1c1e',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontSize: 13,
            color: '#f5f5f7',
            maxWidth: 360,
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'rgba(255,59,48,0.15)',
              color: '#ff3b30',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            !
          </span>
          <span style={{ flex: 1 }}>Gravação encontrou um erro</span>
          <button
            type="button"
            onClick={this.handleRetry}
            style={{
              padding: '4px 12px',
              background: 'rgba(255,255,255,0.1)',
              color: '#f5f5f7',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.18)';
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.1)';
            }}
          >
            Tentar novamente
          </button>
        </div>,
        document.body,
      );
    }

    return this.props.children;
  }
}
