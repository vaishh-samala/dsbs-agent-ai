import React from 'react';
import { RefreshCw, ShieldCheck, UserCheck, ChevronDown, Lock } from 'lucide-react';
import { ActiveNavTab, AdminNavTab, UserRole } from '../types/sandbox';

interface HeaderProps {
  role: UserRole;
  activeTab: ActiveNavTab | AdminNavTab;
  backendHealth?: {
    status: 'healthy' | 'offline' | 'checking';
    version?: string;
  };
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onOpenRoleModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  role,
  activeTab,
  backendHealth = { status: 'healthy', version: '1.0.0' },
  isRefreshing = false,
  onRefresh,
  onOpenRoleModal,
}) => {
  const getBreadcrumbTitle = () => {
    switch (activeTab) {
      case 'overview':
        return 'Overview';
      case 'new-sandbox':
        return 'New Sandbox';
      case 'history':
        return 'Sandbox History';
      case 'runtimes':
        return 'Supported Runtimes';
      case 'settings':
        return 'Settings';
      case 'admin-overview':
        return 'Cluster Overview';
      case 'admin-sandboxes':
        return 'Sandbox Management';
      case 'admin-requests':
        return 'Access Requests';
      case 'admin-developers':
        return 'Developer Directory';
      case 'admin-monitoring':
        return 'Environment Health';
      case 'admin-audit':
        return 'Audit Activity';
      case 'admin-settings':
        return 'Admin Settings';
      default:
        return 'Overview';
    }
  };

  const isHealthy = backendHealth.status === 'healthy';

  return (
    <header className="h-14 border-b border-neutral-800/80 bg-[#0e1117]/95 backdrop-blur-md px-5 flex items-center justify-between gap-4 sticky top-0 z-20 select-none">
      {/* Zone 1: Breadcrumb and Title */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-xs font-mono font-medium text-neutral-400 capitalize">
          {role === 'developer' ? 'developer' : 'admin'}
        </span>
        <span className="text-neutral-600 font-mono text-xs">/</span>
        <h1 className="text-sm font-bold text-neutral-100 tracking-tight truncate">
          {getBreadcrumbTitle()}
        </h1>
      </div>

      {/* Zone 2: System Health Status & Role Switcher */}
      <div className="flex items-center gap-3 text-xs">
        {/* Cluster Status Pill */}
        <div className="hidden sm:flex items-center gap-2 px-2.5 py-1 rounded-full bg-[#121622] border border-neutral-800 text-neutral-300">
          <span
            className={`w-2 h-2 rounded-full ${
              isHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
            }`}
          />
          <span className="text-[11px] font-medium text-neutral-200">
            {isHealthy ? 'Engine Nominal' : 'Connecting Engine'}
          </span>
          <span className="text-neutral-600">·</span>
          <span className="font-mono text-[10px] text-neutral-400">
            {backendHealth.version ? `API v${backendHealth.version}` : '16 vCPUs'}
          </span>
        </div>

        {/* Refresh Button */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            title="Refresh sandbox state & cluster health"
            className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800 transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
        )}

        {/* Demo Role Switcher Button */}
        <button
          onClick={onOpenRoleModal}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#141824] hover:bg-[#1b2132] border border-neutral-800 hover:border-neutral-700 text-neutral-200 transition-colors cursor-pointer group"
          title="Open Demo Role Switcher"
        >
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              role === 'developer' ? 'bg-violet-400' : 'bg-amber-400'
            }`}
          />
          <span className="font-semibold text-xs capitalize text-neutral-100">
            {role}
          </span>
          <span className="text-[10px] font-mono text-neutral-500 uppercase px-1 rounded bg-neutral-900 border border-neutral-800">
            Demo
          </span>
          <ChevronDown className="w-3 h-3 text-neutral-400 group-hover:text-neutral-200" />
        </button>
      </div>
    </header>
  );
};
