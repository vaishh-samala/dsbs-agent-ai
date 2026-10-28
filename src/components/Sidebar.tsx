import React from 'react';
import {
  Layers,
  PlusCircle,
  History,
  Settings,
  Terminal,
  Cpu,
  GitBranch,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import { ActiveNavTab } from '../types/sandbox';

interface SidebarProps {
  activeTab: ActiveNavTab;
  onSelectTab: (tab: ActiveNavTab) => void;
  activeSandboxesCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  activeSandboxesCount,
}) => {
  const navItems = [
    {
      id: 'overview' as ActiveNavTab,
      label: 'Overview',
      icon: Layers,
      description: 'System metrics & active environments',
    },
    {
      id: 'new-sandbox' as ActiveNavTab,
      label: 'New Sandbox',
      icon: PlusCircle,
      description: 'Bootstrap a GitHub repository',
    },
    {
      id: 'history' as ActiveNavTab,
      label: 'Sandbox History',
      icon: History,
      description: 'Past runs, logs & diagnostics',
    },
    {
      id: 'settings' as ActiveNavTab,
      label: 'Settings',
      icon: Settings,
      description: 'Runtimes, resources & timeouts',
    },
  ];

  return (
    <aside className="w-[270px] shrink-0 bg-[#0e1117] border-r border-neutral-800 flex flex-col h-screen sticky top-0 select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400">
            <Terminal className="w-5 h-5" />
          </div>
          <div>
            <div className="font-semibold text-sm text-neutral-100 tracking-tight flex items-center gap-1.5">
              <span>Sandbox Bootstrapper</span>
            </div>
            <div className="text-[11px] text-neutral-400 font-mono">
              v1.0 · test env engine
            </div>
          </div>
        </div>
      </div>

      {/* Primary Navigation */}
      <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
        <div className="px-3 pt-2 pb-1.5 text-[11px] font-medium text-neutral-400 tracking-wider">
          WORKSPACE
        </div>

        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-left text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-violet-600/15 text-violet-300 border border-violet-500/40 font-semibold shadow-sm shadow-violet-950/30'
                  : 'text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/60 border border-transparent'
              }`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 ${
                  isActive ? 'text-violet-400' : 'text-neutral-400'
                }`}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {item.id === 'history' && activeSandboxesCount > 0 && (
                <span className="text-[10px] font-mono tabular-nums text-neutral-300 bg-neutral-800/80 px-1.5 py-0.5 rounded">
                  {activeSandboxesCount} active
                </span>
              )}
            </button>
          );
        })}

        <div className="pt-6 px-3 pb-1.5 text-[11px] font-medium text-neutral-300">
          SUPPORTED RUNTIMES
        </div>

        <div className="space-y-1.5 px-2">
          <div className="p-2.5 rounded-md bg-neutral-900/60 border border-neutral-800/80 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-neutral-200">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Node.js Engine
              </span>
              <span className="font-mono text-neutral-400">20 / 22 / 18</span>
            </div>
            <div className="text-neutral-400 text-[10px]">
              pnpm · npm · yarn · bun
            </div>
          </div>

          <div className="p-2.5 rounded-md bg-neutral-900/60 border border-neutral-800/80 text-[11px] space-y-1">
            <div className="flex items-center justify-between text-neutral-200">
              <span className="flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                Python Engine
              </span>
              <span className="font-mono text-neutral-400">3.11 / 3.12</span>
            </div>
            <div className="text-neutral-400 text-[10px]">
              poetry · pip · uv virtualenv
            </div>
          </div>
        </div>
      </nav>

      {/* Cluster Footer */}
      <div className="p-3 border-t border-neutral-800 bg-[#0a0d12]">
        <div className="p-2.5 rounded-md bg-neutral-900 border border-neutral-800 space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-neutral-400 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Isolated Host
            </span>
            <span className="text-[10px] text-neutral-300 font-mono">cgroups v2</span>
          </div>
          <div className="text-[11px] text-neutral-300 flex items-center justify-between">
            <span>Pool Capacity</span>
            <span className="font-mono tabular-nums text-neutral-200">14 / 16 Cores</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
