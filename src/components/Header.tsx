import React from 'react';
import { RefreshCw } from 'lucide-react';
import { ActiveNavTab } from '../types/sandbox';

interface HeaderProps {
  activeTab: ActiveNavTab;
  onCreateSandboxClick?: () => void;
  systemStatus?: 'nominal' | 'degraded' | 'busy';
  backendHealth?: {
    status: 'healthy' | 'offline' | 'checking';
    version?: string;
  };
  isRefreshing?: boolean;
  onRefresh?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  systemStatus = 'nominal',
  backendHealth = { status: 'healthy', version: '1.0.0' },
  isRefreshing = false,
  onRefresh,
}) => {
  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Overview';
      case 'new-sandbox':
        return 'New Sandbox';
      case 'history':
        return 'Sandbox History';
      case 'settings':
        return 'Settings';
      default:
        return 'Overview';
    }
  };

  const isHealthy = backendHealth.status === 'healthy';

  return (
    <header className="h-14 border-b border-neutral-800 bg-[#0e1117]/90 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-20">
      {/* Zone 1: Breadcrumb and Title */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-mono text-neutral-400">bootstrapper</span>
        <span className="text-neutral-600">/</span>
        <h1 className="text-sm font-semibold text-neutral-100 tracking-tight">
          {getBreadcrumbTitle()}
        </h1>
      </div>

      {/* Zone 2: System Status Indicator & Refresh */}
      <div className="flex items-center gap-4 text-xs">
        <div className="flex items-center gap-2 text-neutral-300">
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
          ></span>
          <span className="font-medium text-neutral-200">Cluster Status:</span>
          <span className={isHealthy ? 'text-emerald-400' : 'text-amber-400'}>
            {isHealthy ? 'Nominal' : 'Connecting'}
          </span>
          <span className="text-neutral-600">·</span>
          <span className="font-mono text-neutral-400">
            {backendHealth.version ? `API v${backendHealth.version}` : '16 vCPUs Ready'}
          </span>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh sandbox status & backend health"
            className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}
      </div>
    </header>
  );
};
