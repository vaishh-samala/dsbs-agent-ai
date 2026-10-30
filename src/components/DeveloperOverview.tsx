import React from 'react';
import {
  Plus,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  RotateCcw,
  Eye,
  GitBranch,
  Github,
  Power,
  Layers,
  ArrowRight,
  ShieldCheck,
  Server,
  Terminal,
} from 'lucide-react';
import { Sandbox, SandboxStatus } from '../types/sandbox';

interface DeveloperOverviewProps {
  sandboxes: Sandbox[];
  activeSandbox: Sandbox | null;
  onSelectSandbox: (sandbox: Sandbox) => void;
  onCreateSandbox: () => void;
  onOpenPreview: (sandbox: Sandbox) => void;
  onRetrySandbox: (sandbox: Sandbox) => void;
  onStopSandbox: (id: string) => void;
  onViewAllHistory: () => void;
  isRetrying?: boolean;
}

export const DeveloperOverview: React.FC<DeveloperOverviewProps> = ({
  sandboxes,
  activeSandbox,
  onSelectSandbox,
  onCreateSandbox,
  onOpenPreview,
  onRetrySandbox,
  onStopSandbox,
  onViewAllHistory,
  isRetrying = false,
}) => {
  const total = sandboxes.length;
  const running = sandboxes.filter((s) => s.status === 'running').length;
  const failed = sandboxes.filter((s) => s.status === 'failed').length;
  const awaitingApproval = sandboxes.filter((s) => s.status === 'awaiting_approval').length;

  const latestSandbox = sandboxes[0] || null;
  const recentSandboxes = sandboxes.slice(0, 5);

  const getStatusBadge = (status: SandboxStatus) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Running</span>
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/25">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Needs Approval</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-400 border border-rose-500/25">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Failed</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
            <span>Rejected</span>
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-400 border border-neutral-700">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
            <span>Stopped</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-800 text-neutral-300 capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* 1. Concise Page Heading & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#1c2230]">
        <div>
          <h1 className="text-xl font-bold text-neutral-100 tracking-tight">
            Developer Environments
          </h1>
          <p className="text-xs text-neutral-400 mt-0.5">
            Manage isolated container sandboxes, review LangGraph setup plans, and verify services.
          </p>
        </div>

        <button
          onClick={onCreateSandbox}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold shadow-sm shadow-violet-900/40 transition-all cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Create Sandbox</span>
        </button>
      </div>

      {/* 2. Compact Metric Blocks: Answer Question 1 (State of all environments) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Total */}
        <div className="p-3.5 rounded-xl bg-[#0e121a] border border-[#1e2433] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Total</div>
            <div className="text-2xl font-bold font-mono text-neutral-100 mt-0.5">{total}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-[#141a26] text-neutral-400 border border-[#222a3a]">
            <Layers className="w-4 h-4" />
          </div>
        </div>

        {/* Running */}
        <div className="p-3.5 rounded-xl bg-[#0e121a] border border-[#1e2433] flex items-center justify-between">
          <div>
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Running</div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mt-0.5">{running}</div>
          </div>
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Play className="w-4 h-4" />
          </div>
        </div>

        {/* Awaiting Approval */}
        <div className={`p-3.5 rounded-xl bg-[#0e121a] border flex items-center justify-between transition-colors ${
          awaitingApproval > 0 ? 'border-amber-500/40 bg-amber-950/10' : 'border-[#1e2433]'
        }`}>
          <div>
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Needs Attention</div>
            <div className={`text-2xl font-bold font-mono mt-0.5 ${awaitingApproval > 0 ? 'text-amber-400' : 'text-neutral-300'}`}>
              {awaitingApproval}
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border ${
            awaitingApproval > 0
              ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              : 'bg-[#141a26] text-neutral-400 border-[#222a3a]'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
        </div>

        {/* Failed */}
        <div className={`p-3.5 rounded-xl bg-[#0e121a] border flex items-center justify-between transition-colors ${
          failed > 0 ? 'border-rose-500/40 bg-rose-950/10' : 'border-[#1e2433]'
        }`}>
          <div>
            <div className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">Failed Probes</div>
            <div className={`text-2xl font-bold font-mono mt-0.5 ${failed > 0 ? 'text-rose-400' : 'text-neutral-300'}`}>
              {failed}
            </div>
          </div>
          <div className={`p-2.5 rounded-lg border ${
            failed > 0
              ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
              : 'bg-[#141a26] text-neutral-400 border-[#222a3a]'
          }`}>
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* 3. Latest Environment Spotlight: Answer Question 2 & 3 (What is happening & What should I do next) */}
      {latestSandbox ? (
        <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#1b2130]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-violet-600/15 text-violet-300 border border-violet-500/30 font-semibold">
                Latest Environment
              </span>
              <div className="flex items-center gap-2 truncate">
                <Github className="w-4 h-4 text-neutral-400 shrink-0" />
                <span className="font-bold text-xs text-neutral-100 truncate">
                  {latestSandbox.repoOwner}/{latestSandbox.repoName}
                </span>
                <span className="text-neutral-600 font-mono text-xs">/</span>
                <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-300 bg-[#141a26] px-1.5 py-0.5 rounded border border-[#232c3d]">
                  <GitBranch className="w-3 h-3 text-neutral-500" />
                  <span>{latestSandbox.branch}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {getStatusBadge(latestSandbox.status)}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            {/* Status explanation */}
            <div className="space-y-1">
              <p className="text-neutral-300 font-medium">
                {latestSandbox.status === 'awaiting_approval' && (
                  <span className="text-amber-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    Agent generated setup plan. Awaiting your approval before executing commands.
                  </span>
                )}
                {latestSandbox.status === 'running' && (
                  <span className="text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Environment online. Readiness probe passed on port :{latestSandbox.env.port}.
                  </span>
                )}
                {latestSandbox.status === 'failed' && (
                  <span className="text-rose-400 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Readiness verification check failed. Review diagnostics and re-run.
                  </span>
                )}
                {latestSandbox.status === 'rejected' && (
                  <span className="text-neutral-400">
                    Execution plan was rejected. Container was not started.
                  </span>
                )}
                {latestSandbox.status === 'stopped' && (
                  <span className="text-neutral-400">
                    Sandbox container is stopped. Port :{latestSandbox.env.port} released.
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2 font-mono text-[11px] text-neutral-400">
                <span>{latestSandbox.runtimeVersion}</span>
                <span className="text-neutral-600">·</span>
                <span className="capitalize">{latestSandbox.packageManager}</span>
                <span className="text-neutral-600">·</span>
                <span>{latestSandbox.createdAt}</span>
              </div>
            </div>

            {/* Direct contextual actions */}
            <div className="flex items-center gap-2 shrink-0">
              {latestSandbox.status === 'awaiting_approval' && (
                <button
                  onClick={() => onSelectSandbox(latestSandbox)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Review & Authorize Plan</span>
                </button>
              )}

              {latestSandbox.status === 'running' && (
                <button
                  onClick={() => onOpenPreview(latestSandbox)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Port :{latestSandbox.env.port}</span>
                </button>
              )}

              {latestSandbox.status === 'failed' && (
                <button
                  onClick={() => onRetrySandbox(latestSandbox)}
                  disabled={isRetrying}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-all"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                  <span>Retry Setup</span>
                </button>
              )}

              <button
                onClick={() => onSelectSandbox(latestSandbox)}
                className="px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View Details</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* 4. Recent Environments Section (Calm, scannable table) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-neutral-300 uppercase tracking-wider">
            Recent Environments
          </h2>
          {sandboxes.length > 5 && (
            <button
              onClick={onViewAllHistory}
              className="text-xs font-medium text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>View all ({total})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {recentSandboxes.length > 0 ? (
          <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl overflow-hidden shadow-sm divide-y divide-[#181e2b]">
            {recentSandboxes.map((sbx) => (
              <div
                key={sbx.id}
                className="p-3.5 hover:bg-[#121622] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                {/* Repo / Branch / Runtime */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-lg bg-[#141a26] text-neutral-400 border border-[#232c3d] shrink-0">
                    <Github className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onSelectSandbox(sbx)}
                        className="font-bold text-xs text-neutral-100 hover:text-violet-300 transition-colors truncate text-left cursor-pointer"
                      >
                        {sbx.repoOwner}/{sbx.repoName}
                      </button>
                      <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-400 bg-[#141a26] px-1.5 py-0.2 rounded border border-[#232c3d]">
                        <GitBranch className="w-3 h-3 text-neutral-500" />
                        <span>{sbx.branch}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-neutral-400 font-mono">
                      <span>{sbx.runtimeVersion}</span>
                      <span className="text-neutral-600">·</span>
                      <span>Port :{sbx.env.port}</span>
                      <span className="text-neutral-600">·</span>
                      <span className="font-sans">{sbx.createdAt}</span>
                    </div>
                  </div>
                </div>

                {/* Status & Actions */}
                <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                  {getStatusBadge(sbx.status)}

                  {sbx.status === 'running' && (
                    <button
                      onClick={() => onOpenPreview(sbx)}
                      className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/20 transition-colors cursor-pointer"
                      title={`Open Port :${sbx.env.port}`}
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {sbx.status === 'running' && (
                    <button
                      onClick={() => onStopSandbox(sbx.id)}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 transition-colors cursor-pointer"
                      title="Stop sandbox process"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                  )}

                  {sbx.status === 'failed' && (
                    <button
                      onClick={() => onRetrySandbox(sbx)}
                      disabled={isRetrying}
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-100 hover:bg-[#1a2233] border border-transparent hover:border-[#2a3449] transition-colors cursor-pointer disabled:opacity-50"
                      title="Retry setup"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
                    </button>
                  )}

                  <button
                    onClick={() => onSelectSandbox(sbx)}
                    className="px-2.5 py-1 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-300 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="p-12 text-center rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#141a26] border border-[#232c3d] flex items-center justify-center mx-auto text-neutral-400">
              <Terminal className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="text-sm font-bold text-neutral-200">
              No Sandbox Environments Yet
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto leading-relaxed">
              Connect any GitHub repository to let the LangGraph agent inspect dependencies, plan the environment, and boot an isolated container.
            </p>
            <button
              onClick={onCreateSandbox}
              className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-sm shadow-violet-900/30"
            >
              Create Your First Sandbox
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

