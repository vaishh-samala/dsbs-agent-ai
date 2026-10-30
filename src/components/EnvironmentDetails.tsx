import React, { useState } from 'react';
import {
  Server,
  Layers,
  Radio,
  Clock,
  ExternalLink,
  RefreshCw,
  Cpu,
  FileCode,
  ShieldCheck,
  AlertTriangle,
  GitBranch,
  Terminal,
  Activity,
  HardDrive,
  Copy,
  Check,
  Zap,
} from 'lucide-react';
import {
  EnvironmentDetails as EnvDetailsType,
  SandboxStatus,
  HealthStatus,
} from '../types/sandbox';

interface EnvironmentDetailsProps {
  env: EnvDetailsType;
  status: SandboxStatus;
  repoName: string;
  branch: string;
  healthStatus?: HealthStatus;
  previewUrl?: string;
  onOpenPreview?: () => void;
  onRestart?: () => void;
  onViewDiagnostics?: () => void;
  isRetrying?: boolean;
}

export const EnvironmentDetails: React.FC<EnvironmentDetailsProps> = ({
  env,
  status,
  repoName,
  branch,
  healthStatus,
  previewUrl,
  onOpenPreview,
  onRestart,
  onViewDiagnostics,
  isRetrying = false,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Running (Healthy)</span>
          </span>
        );
      case 'awaiting_approval':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-950/60 border border-violet-500/40 text-violet-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span>Awaiting Approval</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Plan Rejected</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs font-semibold">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>Failed (Exit 1)</span>
          </span>
        );
      case 'queued':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/40 text-amber-300 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>Bootstrapping</span>
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-400 text-xs font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500" />
            <span>Stopped</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700 text-neutral-300 text-xs font-semibold capitalize">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-[#11141c] border border-neutral-800 rounded-xl p-5 space-y-4 flex flex-col h-full shadow-sm">
      {/* Header Row */}
      <div className="flex items-center justify-between pb-3 border-b border-neutral-800/80">
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-violet-400" />
          <h3 className="text-sm font-bold text-neutral-100 tracking-tight">
            Environment Specifications
          </h3>
        </div>
        {getStatusBadge()}
      </div>

      {/* Grid of Key Properties */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* Runtime & Version */}
        <div className="p-2.5 rounded-lg bg-[#0c0e14] border border-neutral-800/80 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1">
            <Cpu className="w-3 h-3" />
            Runtime
          </span>
          <div className="font-semibold text-neutral-200 truncate">
            {env.detectedRuntime || 'Node.js 20.14.0 LTS'}
          </div>
        </div>

        {/* Package Manager */}
        <div className="p-2.5 rounded-lg bg-[#0c0e14] border border-neutral-800/80 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1">
            <FileCode className="w-3 h-3" />
            Package Manager
          </span>
          <div className="font-semibold text-neutral-200 capitalize font-mono">
            {env.packageManager}
          </div>
        </div>

        {/* Bound Port */}
        <div className="p-2.5 rounded-lg bg-[#0c0e14] border border-neutral-800/80 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1">
            <Radio className="w-3 h-3" />
            Bound Port
          </span>
          <div className="font-semibold text-emerald-400 font-mono flex items-center justify-between">
            <span>:{env.port}</span>
            <span className="text-[10px] text-neutral-500 font-sans font-normal">127.0.0.1</span>
          </div>
        </div>

        {/* Dependencies Count */}
        <div className="p-2.5 rounded-lg bg-[#0c0e14] border border-neutral-800/80 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Dependencies
          </span>
          <div className="font-semibold text-neutral-200 font-mono">
            {env.detectedDependencies} packages
          </div>
        </div>
      </div>

      {/* Commands & URL Section */}
      <div className="space-y-2.5 text-xs">
        {/* Start Command */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-neutral-400">
            <span>Start Command</span>
            <button
              onClick={() => handleCopy(env.startCommand, 'startCmd')}
              className="text-neutral-500 hover:text-neutral-300 flex items-center gap-1 font-mono text-[10px] transition-colors cursor-pointer"
            >
              {copiedKey === 'startCmd' ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span>{copiedKey === 'startCmd' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <div className="px-3 py-2 rounded-lg bg-[#0c0e14] border border-neutral-800 font-mono text-[11px] text-neutral-200 truncate select-all">
            $ {env.startCommand}
          </div>
        </div>

        {/* Local Preview URL (if available) */}
        {previewUrl && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-neutral-400">
              <span className="flex items-center gap-1 text-emerald-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Readiness Endpoint
              </span>
              <button
                onClick={() => handleCopy(previewUrl, 'previewUrl')}
                className="text-neutral-500 hover:text-neutral-300 flex items-center gap-1 font-mono text-[10px] transition-colors cursor-pointer"
              >
                {copiedKey === 'previewUrl' ? (
                  <Check className="w-3 h-3 text-emerald-400" />
                ) : (
                  <Copy className="w-3 h-3" />
                )}
                <span>{copiedKey === 'previewUrl' ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
            <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-emerald-950/20 border border-emerald-500/30 font-mono text-xs text-emerald-300">
              <span className="truncate">{previewUrl}</span>
              {onOpenPreview && (
                <button
                  onClick={onOpenPreview}
                  className="ml-2 text-emerald-400 hover:text-emerald-200 flex items-center gap-1 text-[11px] cursor-pointer shrink-0 font-sans"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Preview</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Cgroups & Resource Quota Footer */}
      <div className="mt-auto pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400 font-mono">
        <span className="flex items-center gap-1.5">
          <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
          <span>RAM: {env.memoryMb} MB · CPU: {env.cpuCores} cores</span>
        </span>
        <span className="text-neutral-500">Lease: {env.leaseExpiresAt}</span>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 pt-1">
        {onViewDiagnostics && (
          <button
            onClick={onViewDiagnostics}
            className="flex-1 py-1.5 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-medium transition-colors text-center cursor-pointer"
          >
            Diagnostics Modal
          </button>
        )}
        {onRestart && (
          <button
            onClick={onRestart}
            disabled={isRetrying}
            className="py-1.5 px-3 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-200 text-xs font-medium transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Restart sandbox boot sequence"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Restart</span>
          </button>
        )}
      </div>
    </div>
  );
};
