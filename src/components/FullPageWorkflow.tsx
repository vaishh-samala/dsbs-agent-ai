import React from 'react';
import {
  ArrowLeft,
  Github,
  GitBranch,
  RotateCcw,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Terminal,
} from 'lucide-react';
import { Sandbox } from '../types/sandbox';
import { LiveWorkflowTimeline } from './LiveWorkflowTimeline';

interface FullPageWorkflowProps {
  sandbox: Sandbox;
  allSandboxes: Sandbox[];
  onSelectSandbox: (id: string) => void;
  onBackToOverview: () => void;
  onApprovePlan: (sandboxId: string) => void;
  onRejectPlan: (sandboxId: string, reason?: string) => void;
  onRetrySandbox: (sandbox: Sandbox) => void;
  onOpenPreview?: (sandbox: Sandbox) => void;
  isActionInProgress?: boolean;
}

export const FullPageWorkflow: React.FC<FullPageWorkflowProps> = ({
  sandbox,
  allSandboxes,
  onSelectSandbox,
  onBackToOverview,
  onApprovePlan,
  onRejectPlan,
  onRetrySandbox,
  onOpenPreview,
  isActionInProgress = false,
}) => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Workflow Navigation Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-[#11141c] border border-neutral-800 rounded-xl px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToOverview}
            className="p-1.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800 transition-colors flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            title="Return to Developer Overview"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Overview</span>
          </button>

          <div className="h-4 w-[1px] bg-neutral-800" />

          {/* Repo & Branch Identity */}
          <div className="flex items-center gap-2 text-xs">
            <div className="p-1.5 rounded bg-neutral-900 text-neutral-400">
              <Github className="w-3.5 h-3.5" />
            </div>
            <span className="font-bold text-neutral-200">
              {sandbox.repoOwner}/{sandbox.repoName}
            </span>
            <span className="text-neutral-600">·</span>
            <div className="flex items-center gap-1 font-mono text-[11px] text-neutral-400 bg-[#0c0e14] px-2 py-0.5 rounded border border-neutral-800">
              <GitBranch className="w-3 h-3 text-neutral-500" />
              <span>{sandbox.branch}</span>
            </div>
          </div>
        </div>

        {/* Sandbox Selector & Actions */}
        <div className="flex items-center gap-2.5">
          <select
            value={sandbox.id}
            onChange={(e) => onSelectSandbox(e.target.value)}
            className="px-2.5 py-1.5 bg-[#0c0e14] border border-neutral-800 rounded-lg text-xs font-mono text-neutral-300 focus:outline-none focus:border-violet-500/80 cursor-pointer"
          >
            {allSandboxes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.repoName} ({s.id}) - {s.status.toUpperCase()}
              </option>
            ))}
          </select>

          {sandbox.previewUrl && (
            <button
              onClick={() => onOpenPreview && onOpenPreview(sandbox)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Port {sandbox.env.port}</span>
            </button>
          )}

          <button
            onClick={() => onRetrySandbox(sandbox)}
            disabled={isActionInProgress}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Re-run workflow"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isActionInProgress ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Re-run</span>
          </button>
        </div>
      </div>

      {/* Main Dedicated Agent Workflow Timeline */}
      <div className="bg-[#0e1117] border border-neutral-800/90 rounded-2xl p-6 sm:p-8 shadow-xl">
        <LiveWorkflowTimeline
          sandbox={sandbox}
          onApprove={onApprovePlan}
          onReject={onRejectPlan}
          onRetry={onRetrySandbox}
          isActionInProgress={isActionInProgress}
        />
      </div>
    </div>
  );
};

