import React, { Component } from 'react';
import { AlertTriangle, LayoutDashboard, RefreshCw } from 'lucide-react';

export class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('NovaLink page error', error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  handleReturnToDashboard = () => {
    this.setState({ error: null });
    this.props.onReturnToDashboard?.();
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <section className="mx-auto flex min-h-[calc(100vh-53px)] w-full max-w-2xl flex-col justify-center px-6 py-12" role="alert" aria-live="assertive">
        <div className="border-l-4 border-amber-400 bg-slate-900 px-6 py-7 shadow-xl shadow-slate-950/30 sm:px-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-950 text-amber-400">
            <AlertTriangle className="h-6 w-6" />
          </span>
          <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-slate-100">This page could not be displayed</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            NovaLink encountered a problem while opening this section. Your session is still active, and you can retry the page or return to the dashboard.
          </p>
          <details className="mt-5 text-sm text-slate-500">
            <summary className="cursor-pointer font-semibold text-slate-400 hover:text-slate-300">Technical details</summary>
            <p className="mt-2 break-words border-l border-slate-700 pl-3 font-mono text-xs leading-5">
              {this.state.error?.message || 'Unknown interface error'}
            </p>
          </details>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row">
            <button type="button" onClick={this.handleRetry} className="ui-button bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-400">
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <button type="button" onClick={this.handleReturnToDashboard} className="ui-button border border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-600 hover:bg-slate-700 focus-visible:ring-slate-500">
              <LayoutDashboard className="h-4 w-4" /> Return to dashboard
            </button>
          </div>
        </div>
      </section>
    );
  }
}
