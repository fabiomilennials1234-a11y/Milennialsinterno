import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  name: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error boundary de coluna — isola cada seção do kanban.
 * Se uma seção crasha, o restante da página continua funcional.
 */
export class CrmSectionBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[CrmSection:${this.props.name}]`, error, errorInfo);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <div className="p-4 bg-red-500/5 border border-red-500/30 rounded-lg text-xs text-red-700">
          <p className="font-semibold mb-1">Erro em: {this.props.name}</p>
          <p className="font-mono text-[10px] break-all opacity-80">
            {this.state.error.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default CrmSectionBoundary;
