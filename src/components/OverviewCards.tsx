import React from 'react';
import { Box, Play, AlertCircle, CheckCircle2, TrendingUp } from 'lucide-react';
import { Sandbox } from '../types/sandbox';

interface OverviewCardsProps {
  sandboxes: Sandbox[];
  onFilterClick?: (status: 'all' | 'running' | 'failed' | 'success') => void;
  selectedFilter?: string;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  sandboxes,
  onFilterClick,
  selectedFilter,
}) => {
  const total = sandboxes.length;
  const running = sandboxes.filter((s) => s.status === 'running').length;
  const failed = sandboxes.filter((s) => s.status === 'failed').length;
  const successful = sandboxes.filter((s) => s.status === 'success' || s.status === 'running').length;
  const completedOrFailed = sandboxes.filter((s) => s.status === 'success' || s.status === 'failed' || s.status === 'stopped').length;
  const successRate =
    completedOrFailed > 0
      ? Math.round(
          (sandboxes.filter((s) => s.status === 'success' || s.status === 'running').length /
            sandboxes.length) *
            100
        )
      : 100;

  const cards = [
    {
      id: 'all' as const,
      title: 'Total Sandboxes',
      value: total,
      subtext: 'across all projects',
      icon: Box,
      accentColor: 'text-neutral-100',
      iconColor: 'text-violet-400 bg-violet-500/10',
    },
    {
      id: 'running' as const,
      title: 'Running',
      value: running,
      subtext: 'active runtime hosts',
      icon: Play,
      accentColor: 'text-emerald-400',
      iconColor: 'text-emerald-400 bg-emerald-500/10',
    },
    {
      id: 'failed' as const,
      title: 'Failed',
      value: failed,
      subtext: 'requires diagnosis',
      icon: AlertCircle,
      accentColor: failed > 0 ? 'text-rose-400' : 'text-neutral-400',
      iconColor: 'text-rose-400 bg-rose-500/10',
    },
    {
      id: 'success' as const,
      title: 'Success Rate',
      value: `${successRate}%`,
      subtext: 'verification pass rate',
      icon: CheckCircle2,
      accentColor: 'text-emerald-400',
      iconColor: 'text-emerald-400 bg-emerald-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isSelected = selectedFilter === card.id;
        return (
          <button
            key={card.id}
            onClick={() => onFilterClick && onFilterClick(card.id)}
            className={`p-4 rounded-lg bg-[#11141c] border text-left transition-all relative group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer ${
              isSelected
                ? 'border-violet-500/60 bg-[#141824]'
                : 'border-neutral-800 hover:border-neutral-700 hover:bg-[#131722]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-400">
                {card.title}
              </span>
              <div className={`p-1.5 rounded-md ${card.iconColor}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span
                className={`text-2xl font-bold tracking-tight font-mono tabular-nums ${card.accentColor}`}
              >
                {card.value}
              </span>
            </div>

            <div className="mt-1 flex items-center text-[11px] text-neutral-500">
              <span>{card.subtext}</span>
            </div>
          </button>
        );
      })}
    </div>
  );
};
