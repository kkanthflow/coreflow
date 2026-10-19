import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2, Sparkles } from 'lucide-react';
import AuvrynLogo from './AuvrynLogo';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkLoadError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkLoadError: false,
    };
  }

  static isChunkError(error?: Error | null): boolean {
    if (!error) return false;
    const msg = error.message || '';
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Importing a module script failed') ||
      error.name === 'ChunkLoadError'
    );
  }

  static getDerivedStateFromError(error: Error): State {
    const isChunk = ErrorBoundary.isChunkError(error);

    // Auto-reload immediately on chunk failure caused by new deployments
    if (isChunk && typeof window !== 'undefined') {
      const key = 'auvryn_eb_chunk_reload';
      const lastReload = sessionStorage.getItem(key);
      const now = Date.now();
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        sessionStorage.setItem(key, String(now));
        window.location.reload();
      }
    }

    return {
      hasError: true,
      error,
      errorInfo: null,
      isChunkLoadError: isChunk,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[AUVRYN ErrorBoundary] Caught error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    try {
      sessionStorage.removeItem('auvryn_eb_chunk_reload');
      sessionStorage.removeItem('auvryn_last_chunk_reload');
      sessionStorage.removeItem('auvryn_vite_preload_reload');
    } catch (_) {}
    window.location.href = window.location.pathname + '?v=' + Date.now();
  };

  handleResetHome = () => {
    window.location.href = '/';
  };

  handleClearCacheAndReload = () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) {}
    window.location.href = '/?v=' + Date.now();
  };

  render() {
    if (this.state.hasError) {
      const isChunk = this.state.isChunkLoadError || ErrorBoundary.isChunkError(this.state.error);

      return (
        <div className="min-h-screen bg-[#07070B] text-white flex flex-col items-center justify-center p-6 font-sans select-none">
          <div className="w-full max-w-md bg-[#0C0D12] border border-[#1e1e2e] rounded-2xl p-8 shadow-2xl text-center relative overflow-hidden">
            {/* Ambient accent glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#FF6B4A]/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex items-center justify-center mb-6">
              <div className="w-14 h-14 rounded-2xl bg-[#FF6B4A]/10 border border-[#FF6B4A]/30 flex items-center justify-center text-[#FF6B4A]">
                <AuvrynLogo size={28} />
              </div>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#181824] border border-[#2a2a3e] text-[11px] font-mono text-[#FF6B4A] mb-3">
              {isChunk ? <Sparkles size={12} /> : <AlertTriangle size={12} />}
              <span>{isChunk ? 'New Version Available' : 'Application Recovery Mode'}</span>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-white mb-2">
              {isChunk ? 'Update Ready' : (this.props.fallbackTitle || 'Workspace Encountered an Error')}
            </h1>
            
            <p className="text-sm text-gray-400 mb-6 leading-relaxed">
              {isChunk
                ? 'A new version of AUVRYN has been deployed. Please refresh to load the latest workspace components.'
                : 'AUVRYN caught an unexpected runtime exception. You can reload the page or return to the landing overview.'}
            </p>

            {this.state.error && !isChunk && (
              <div className="mb-6 text-left">
                <details className="text-xs text-gray-500 bg-[#07070B] p-3 rounded-lg border border-[#181824] cursor-pointer">
                  <summary className="font-mono text-gray-400 hover:text-gray-300">
                    Diagnostics: {this.state.error.message || 'Unknown error'}
                  </summary>
                  <pre className="mt-2 text-[10px] text-red-400/80 overflow-x-auto whitespace-pre-wrap font-mono">
                    {this.state.error.stack || String(this.state.error)}
                  </pre>
                </details>
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                onClick={this.handleReload}
                className="w-full py-2.5 px-4 rounded-xl bg-[#FF6B4A] hover:bg-[#FF552B] text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 shadow-[0_0_16px_rgba(255,107,74,0.3)] cursor-pointer"
              >
                <RefreshCw size={14} />
                <span>{isChunk ? 'Refresh Application Now' : 'Reload Page'}</span>
              </button>

              <button
                onClick={this.handleResetHome}
                className="w-full py-2.5 px-4 rounded-xl bg-[#14141E] hover:bg-[#1c1c2a] border border-[#26263a] text-gray-300 hover:text-white font-medium text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <Home size={14} />
                <span>Return to Home</span>
              </button>

              <button
                onClick={this.handleClearCacheAndReload}
                className="w-full py-2 px-4 rounded-xl hover:bg-red-500/10 text-gray-500 hover:text-red-400 font-mono text-[11px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 size={12} />
                <span>Clear session cache & restart</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
