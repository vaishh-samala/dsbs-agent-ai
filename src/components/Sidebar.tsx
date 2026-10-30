import React from 'react';
import {
  Layers,
  PlusCircle,
  History,
  Settings,
  Cpu,
  GitBranch,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  LayoutDashboard,
  Server,
  KeyRound,
  Users,
  Activity,
  ScrollText,
  Sliders,
  ExternalLink,
} from 'lucide-react';
import { ActiveNavTab, AdminNavTab, UserRole } from '../types/sandbox';
import { BrandLogo } from './BrandLogo';

interface SidebarProps {
  role: UserRole;
  activeTab: ActiveNavTab | AdminNavTab;
  onSelectTab: (tab: any) => void;
  activeSandboxesCount: number;
  pendingRequestsCount?: number;
  hasActiveWorkflow?: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onSwitchRole: (newRole: UserRole) => void;
}

interface NavItem {
  id: ActiveNavTab | AdminNavTab;
  label: string;
  icon: React.ElementType;
  description: string;
  badge?: string;
  badgeColor?: 'rose' | 'default';
  pulse?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  role,
  activeTab,
  onSelectTab,
  activeSandboxesCount,
  pendingRequestsCount = 0,
  hasActiveWorkflow = false,
  collapsed,
  onToggleCollapse,
  onSwitchRole,
}) => {
  const isDev = role === 'developer';

  const devNavItems: NavItem[] = [
    {
      id: 'overview',
      label: 'Overview',
      icon: Layers,
      description: 'Environments & telemetry',
    },
    {
      id: 'new-sandbox',
      label: 'New Sandbox',
      icon: PlusCircle,
      description: 'Bootstrap repository',
    },
    {
      id: 'history',
      label: 'Sandbox History',
      icon: History,
      description: 'Past runs & diagnostics',
      badge: activeSandboxesCount > 0 ? `${activeSandboxesCount}` : undefined,
    },
    {
      id: 'runtimes',
      label: 'Supported Runtimes',
      icon: Cpu,
      description: 'Engines & package managers',
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
      description: 'Cluster & presets',
    },
  ];

  const adminNavItems: NavItem[] = [
    {
      id: 'admin-overview',
      label: 'Admin Overview',
      icon: LayoutDashboard,
      description: 'Cluster metrics & quotas',
    },
    {
      id: 'admin-sandboxes',
      label: 'Sandbox Management',
      icon: Server,
      description: 'All active environments',
      badge: activeSandboxesCount > 0 ? `${activeSandboxesCount}` : undefined,
    },
    {
      id: 'admin-requests',
      label: 'Access Requests',
      icon: KeyRound,
      description: 'Review developer access',
      badge: pendingRequestsCount > 0 ? `${pendingRequestsCount}` : undefined,
      badgeColor: 'rose',
    },
    {
      id: 'admin-developers',
      label: 'Developer Directory',
      icon: Users,
      description: 'Team roles & leases',
    },
    {
      id: 'admin-monitoring',
      label: 'Environment Health',
      icon: Activity,
      description: 'Probe telemetry & logs',
    },
    {
      id: 'admin-audit',
      label: 'Audit Activity',
      icon: ScrollText,
      description: 'Gate approval timeline',
    },
    {
      id: 'admin-settings',
      label: 'Admin Settings',
      icon: Sliders,
      description: 'Security & lease timeouts',
    },
  ];

  const currentNavItems = isDev ? devNavItems : adminNavItems;

  return (
    <aside
      className={`shrink-0 bg-[#0e1117] border-r border-neutral-800 flex flex-col h-screen sticky top-0 select-none z-30 transition-[width] duration-300 ease-in-out ${
        collapsed ? 'w-[70px]' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 px-4 border-b border-neutral-800/80 flex items-center justify-between">
        <BrandLogo
          collapsed={collapsed}
          badgeText={isDev ? 'Developer Workspace' : 'Administrator Workspace'}
        />

        {/* Collapse / Expand Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/80 transition-colors cursor-pointer shrink-0"
          title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          aria-label={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Role Workspace Indicator */}
      <div className="px-3 pt-3 pb-1">
        {!collapsed ? (
          <div className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-neutral-900/80 border border-neutral-800 text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isDev ? 'bg-violet-400' : 'bg-amber-400'
                }`}
              />
              <span className="font-semibold text-neutral-200 truncate capitalize">
                {role} Mode
              </span>
            </div>
            <button
              onClick={() => onSwitchRole(isDev ? 'admin' : 'developer')}
              className="text-[10px] font-mono text-violet-400 hover:text-violet-300 cursor-pointer underline underline-offset-2 shrink-0 ml-1"
              title={`Switch to ${isDev ? 'Administrator' : 'Developer'} workspace`}
            >
              Switch
            </button>
          </div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => onSwitchRole(isDev ? 'admin' : 'developer')}
              className={`w-2.5 h-2.5 rounded-full cursor-pointer ring-2 ring-neutral-800 ${
                isDev ? 'bg-violet-400' : 'bg-amber-400'
              }`}
              title={`Role: ${role.toUpperCase()} (Click to toggle)`}
            />
          </div>
        )}
      </div>

      {/* Primary Navigation List */}
      <nav className="p-2 space-y-1 flex-1 overflow-y-auto">
        {!collapsed && (
          <div className="px-3 pt-2 pb-1 text-[10px] font-mono font-semibold text-neutral-500 uppercase tracking-wider">
            {isDev ? 'NAVIGATION' : 'ADMINISTRATION'}
          </div>
        )}

        {currentNavItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <div key={item.id} className="relative group">
              <button
                onClick={() => onSelectTab(item.id)}
                className={`w-full flex items-center rounded-lg text-left text-xs font-medium transition-all cursor-pointer relative ${
                  collapsed
                    ? 'justify-center p-2.5'
                    : 'gap-3 px-3 py-2.5'
                } ${
                  isActive
                    ? 'bg-violet-600/15 text-violet-300 border border-violet-500/40 font-semibold shadow-sm shadow-violet-950/40'
                    : 'text-neutral-400 hover:text-neutral-100 hover:bg-neutral-800/60 border border-transparent'
                }`}
              >
                {/* Active Indicator Left Accent Bar */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-violet-400" />
                )}

                <div className="relative shrink-0">
                  <Icon
                    className={`w-4 h-4 ${
                      isActive ? 'text-violet-400' : 'text-neutral-400 group-hover:text-neutral-200'
                    }`}
                  />
                  {item.pulse && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                  )}
                </div>

                {!collapsed && (
                  <>
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${
                          item.badgeColor === 'rose'
                            ? 'bg-rose-950/80 text-rose-300 border border-rose-800/60'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700/60'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </button>

              {/* Tooltip for collapsed state */}
              {collapsed && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 hidden group-hover:flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#161b26] border border-neutral-700 text-neutral-100 text-xs shadow-xl z-50 whitespace-nowrap pointer-events-none">
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[10px] font-mono px-1 rounded bg-violet-500/20 text-violet-300">
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Cluster Status Footer */}
      <div className="p-3 border-t border-neutral-800/80 bg-[#0a0d12]">
        {!collapsed ? (
          <div className="p-2.5 rounded-lg bg-neutral-900/90 border border-neutral-800 space-y-2">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-neutral-400 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Restricted Sandbox</span>
              </span>
              <span className="text-[10px] text-emerald-400 font-mono font-semibold">Active</span>
            </div>
            <div className="text-[11px] text-neutral-400 flex items-center justify-between">
              <span>Host Isolation</span>
              <span className="font-mono text-neutral-300 text-[10px]">cgroups v2</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Host Isolation: cgroups v2 active">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
        )}
      </div>
    </aside>
  );
};
