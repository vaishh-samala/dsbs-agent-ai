import React, { useState } from 'react';
import {
  Search,
  Filter,
  Play,
  RotateCcw,
  Eye,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Github,
  GitBranch,
  Power,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  Terminal,
} from 'lucide-react';
import { Sandbox, SandboxStatus } from '../types/sandbox';

interface SandboxHistoryViewProps {
  sandboxes: Sandbox[];
  onSelectSandbox: (sandbox: Sandbox) => void;
  onRetrySandbox: (sandbox: Sandbox) => void;
  onStopSandbox: (sandboxId: string) => void;
  onDeleteSandbox: (sandboxId: string) => void;
  onOpenPreview: (sandbox: Sandbox) => void;
  initialFilter?: string;
  isRetrying?: boolean;
}

export const SandboxHistoryView: React.FC<SandboxHistoryViewProps> = ({
  sandboxes,
  onSelectSandbox,
  onRetrySandbox,
  onStopSandbox,
  onDeleteSandbox,
  onOpenPreview,
  initialFilter = 'all',
  isRetrying = false,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');

  const filteredSandboxes = sandboxes.filter((s) => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (runtimeFilter !== 'all' && s.runtime !== runtimeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.repoName.toLowerCase().includes(q) ||
        s.repoOwner.toLowerCase().includes(q) ||
        s.branch.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getStatusBadge = (status: SandboxStatus) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Running</span>
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/25">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Needs Approval</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-300 border border-rose-500/25">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            <span>Failed</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
            <span>Rejected</span>
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Verified</span>
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-400 border border-neutral-700">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
            <span>Stopped</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-neutral-800 text-neutral-300 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      {/* Search & Filter Controls Bar */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search by repo, branch, or environment ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center p-1 bg-[#090b10] border border-[#1e2433] rounded-lg text-xs">
          {['all', 'running', 'awaiting_approval', 'failed', 'stopped'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer capitalize ${
                statusFilter === st
                  ? 'bg-[#181e2b] text-neutral-100 font-semibold'
                  : 'text-neutral-400 hover:text-neutral-200'
              }`}
            >
              {st === 'awaiting_approval' ? 'approval' : st}
            </button>
          ))}
        </div>

        {/* Runtime Filter Dropdown */}
        <select
          value={runtimeFilter}
          onChange={(e) => setRuntimeFilter(e.target.value)}
          className="px-3 py-1.5 bg-[#090b10] border border-[#1e2433] rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-violet-500 cursor-pointer"
        >
          <option value="all">All Runtimes</option>
          <option value="node">Node.js</option>
          <option value="python">Python</option>
        </select>
      </div>

      {/* History Table / Card List */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl overflow-hidden shadow-sm">
        {filteredSandboxes.length > 0 ? (
          <div className="divide-y divide-[#181e2b]">
            {filteredSandboxes.map((sbx) => (
              <div
                key={sbx.id}
                className="p-4 hover:bg-[#121622] transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Identity & Metadata */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="p-2.5 rounded-lg bg-[#141a26] border border-[#232c3d] text-neutral-400 shrink-0 mt-0.5">
                    <Github className="w-4 h-4" />
                  </div>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => onSelectSandbox(sbx)}
                        className="font-bold text-xs text-neutral-100 hover:text-violet-300 transition-colors truncate text-left cursor-pointer"
                      >
                        {sbx.repoOwner}/{sbx.repoName}
                      </button>
                      <span className="text-neutral-600 font-mono text-xs">/</span>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-300 bg-[#141a26] px-2 py-0.5 rounded border border-[#232c3d]">
                        <GitBranch className="w-3 h-3 text-neutral-500" />
                        <span>{sbx.branch}</span>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-400">
                        {sbx.id}
                      </span>
                      {getStatusBadge(sbx.status)}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400 font-mono">
                      <span>{sbx.runtimeVersion}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="capitalize">{sbx.packageManager}</span>
                      <span className="text-neutral-600">·</span>
                      <span>Port :{sbx.env.port}</span>
                      <span className="text-neutral-600">·</span>
                      <span>Created {sbx.createdAt}</span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {sbx.status === 'running' && (
                    <button
                      onClick={() => onOpenPreview(sbx)}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Port :{sbx.env.port}</span>
                    </button>
                  )}

                  {sbx.status === 'running' && (
                    <button
                      onClick={() => onStopSandbox(sbx.id)}
                      className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/40 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Power className="w-3.5 h-3.5" />
                      <span>Stop</span>
                    </button>
                  )}

                  {sbx.status === 'failed' && (
                    <button
                      onClick={() => onRetrySandbox(sbx)}
                      disabled={isRetrying}
                      className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                      <span>Retry</span>
                    </button>
                  )}

                  <button
                    onClick={() => onSelectSandbox(sbx)}
                    className="px-3.5 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-neutral-400" />
                    <span>View Details</span>
                  </button>

                  <button
                    onClick={() => onDeleteSandbox(sbx.id)}
                    className="p-1.5 rounded-lg text-neutral-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Delete environment record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center space-y-2 text-xs">
            <Terminal className="w-8 h-8 text-neutral-500 mx-auto" />
            <div className="font-semibold text-neutral-300">No environments match your criteria</div>
            <div className="text-neutral-500">Try adjusting your search terms or status filters.</div>
          </div>
        )}
      </div>
    </div>
  );
};
