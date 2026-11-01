import { Component, type ErrorInfo, type ReactNode } from 'react';
import { createLogger } from '@extension/shared/lib/logger';

const logger = createLogger('MCPPopoverErrorBoundary');

interface MCPPopoverErrorBoundaryProps {
  adapterName?: string;
  children: ReactNode;
}

interface MCPPopoverErrorBoundaryState {
  hasError: boolean;
  isExtensionContextInvalidated: boolean;
}

function isExtensionContextInvalidated(error: Error): boolean {
  return /extension context invalidated|extension context is invalid/i.test(error.message);
}

/**
 * Isolate failures in the injected popover from the host AI website and the
 * extension sidebar. Expected extension reloads get a recovery hint; other
 * render failures retain their stack and component trace for diagnosis.
 */
export class MCPPopoverErrorBoundary extends Component<MCPPopoverErrorBoundaryProps, MCPPopoverErrorBoundaryState> {
  state: MCPPopoverErrorBoundaryState = {
    hasError: false,
    isExtensionContextInvalidated: false,
  };

  static getDerivedStateFromError(error: Error): MCPPopoverErrorBoundaryState {
    return {
      hasError: true,
      isExtensionContextInvalidated: isExtensionContextInvalidated(error),
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (isExtensionContextInvalidated(error)) {
      logger.warn(
        `Popover stopped because the extension context was invalidated on ${this.props.adapterName || 'the current site'}. Refresh the page to restore it.`,
        error.message,
      );
      return;
    }

    logger.error(
      `Popover render failed on ${this.props.adapterName || 'the current site'}:`,
      error,
      info.componentStack,
    );
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const message = this.state.isExtensionContextInvalidated
      ? 'The extension was reloaded. Refresh this page to restore MCP controls.'
      : 'MCP controls could not be displayed. Refresh the page to try again.';

    return (
      <div
        className="mcp-popover-error"
        role="alert"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 10px',
          border: '1px solid #f0c36d',
          borderRadius: '8px',
          background: '#fff8e1',
          color: '#5f4500',
          fontSize: '12px',
          lineHeight: 1.4,
        }}>
        <span>{message}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            border: '1px solid currentColor',
            borderRadius: '5px',
            padding: '3px 7px',
            background: 'transparent',
            color: 'inherit',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}>
          Refresh page
        </button>
      </div>
    );
  }
}

export default MCPPopoverErrorBoundary;
