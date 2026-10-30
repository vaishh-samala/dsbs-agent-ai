import React from 'react';
import {
  Box,
  Play,
  AlertCircle,
  CheckCircle2,
  PlusCircle,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Sandbox } from '../types/sandbox';

interface OverviewCardsProps {
  sandboxes: Sandbox[];
  onFilterClick?: (status: 'all' | 'running' | 'failed' | 'success') => void;
  selectedFilter?: string;
  onCreateSandbox?: () => void;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  sandboxes,
  onFilterClick,
  selectedFilter,
  onCreateSandbox,
}) => {
  const total = sandboxes.length;
  const running = sandboxes.filter((s) => s.status === 'running').length;
  const failed = sandboxes.filter((s) => s.status === 'failed').length;
  const awaitingApproval = sandboxes.filter(
    (s) => s.status === 'awaiting_approval'
  ).length;

  const cards = [
    {
      id: 'all' as const,
      title: 'Total Sandboxes',
      value: total,
      subtext: 'provisioned environments',
      icon: Box,
      accentColor: 'text-neutral-100',
      iconBg: 'bg-neutral-800 text-neutral-300',
      borderColor: 'border-neutral-800',
    },
    {
      id: 'running' as const,
      title: 'Running',
      value: running,
      subtext: 'healthy container ports',
      icon: Play,
      accentColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/15 text-emerald-400',
      borderColor: 'border-emerald-500/20',
      pulse: running > 0,
    },
    {
      id: 'failed' as const,
      title: 'Failed',
      value: failed,
      subtext: failed > 0 ? 'requires diagnosis' : '0 failures recorded',
      icon: AlertCircle,
      accentColor: failed > 0 ? 'text-rose-400' : 'text-neutral-400',
      iconBg:
        failed > 0
          ? 'bg-rose-500/15 text-rose-400'
          : 'bg-neutral-800/60 text-neutral-500',
      borderColor: failed > 0 ? 'border-rose-500/30' : 'border-neutral-800',
    },
    {
      id: 'success' as const,
      title: 'Environment Status',
      value: awaitingApproval > 0 ? `${awaitingApproval} Gate` : 'Nominal',
      subtext:
        awaitingApproval > 0
          ? 'awaiting explicit approval'
          : 'all checks verified',
      icon: ShieldCheck,
      accentColor:
        awaitingApproval > 0 ? 'text-violet-400' : 'text-cyan-400',
      iconBg:
        awaitingApproval > 0
          ? 'bg-violet-500/15 text-violet-400'
          : 'bg-cyan-500/15 text-cyan-400',
      borderColor:
        awaitingApproval > 0 ? 'border-violet-500/30' : 'border-neutral-800',
    },
  ];

  return (
    <div className="space-y-4">
      {/* Top Action Bar with prominent Create Sandbox CTA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#11141c] border border-neutral-800/90 rounded-xl px-5 py-3.5 shadow-sm">
        <div className="space-y-0.5">
          <h2 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
            <span>Developer Overview</span>
            <span className="text-[10px] font-mono text-neutral-400 font-normal">
              · Docker-grade cgroup isolation
            </span>
          </h2>
          <p className="text-xs text-neutral-400">
            Monitor active container sandboxes, readiness probes, and inspect telemetry.
          </p>
        </div>

        {onCreateSandbox && (
          <button
            onClick={onCreateSandbox}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold shadow-md shadow-violet-950/50 transition-all cursor-pointer shrink-0"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Sandbox</span>
          </button>
        )}
      </div>

      {/* 4 Compact Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {cards.map((card) => {
          const Icon = card.icon;
          const isSelected = selectedFilter === card.id;
          return (
            <button
              key={card.id}
              onClick={() => onFilterClick && onFilterClick(card.id)}
              className={`p-3.5 rounded-xl bg-[#11141c] border text-left transition-all relative group cursor-pointer ${
                isSelected
                  ? 'border-violet-500/60 bg-[#151926] shadow-sm shadow-violet-950/30'
                  : 'border-neutral-800 hover:border-neutral-700 hover:bg-[#141824]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-neutral-400">
                  {card.title}
                </span>
                <div
                  className={`p-1.5 rounded-lg ${card.iconBg} relative shrink-0`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {card.pulse && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  )}
                </div>
              </div>

              <div className="mt-2 flex items-baseline gap-2">
                <span
                  className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${card.accentColor}`}
                >
                  {card.value}
                </span>
              </div>

              <p className="text-[11px] text-neutral-500 mt-1 truncate">
                {card.subtext}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
};
