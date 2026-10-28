import React from 'react';
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
} from 'lucide-react';
import { EnvironmentDetails as EnvDetailsType, SandboxStatus, HealthStatus } from '../types/sandbox';

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
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  const getStatusDisplay = () => {
    switch (status) {
      case 'running':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-emerald-300">
              Running (Healthy)
            </span>
          </div>
        );
      case 'awaiting_approval':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-violet-950/60 border border-violet-500/40">
            <span className="w-2 h-2 rounded-full bg-violet-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-violet-300">
              Awaiting Approval
            </span>
          </div>
        );
      case 'rejected':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/40">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-xs font-semibold text-rose-300">
              Plan Rejected
            </span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-rose-950/60 border border-rose-500/30">
            <span className="w-2 h-2 rounded-full bg-rose-400"></span>
            <span className="text-xs font-semibold text-rose-300">
              Failed (Exit 1)
            </span>
          </div>
        );
      case 'queued':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-amber-950/60 border border-amber-500/30">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
            <span className="text-xs font-semibold text-amber-300">
              Bootstrapping...
            </span>
          </div>
        );
      case 'stopped':
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
            <span className="text-xs font-semibold text-neutral-400">
              Stopped (Lease expired)
            </span>
          </div>
        );
      default:
        return (
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-neutral-900 border border-neutral-700">
            <span className="text-xs font-semibold text-neutral-300 capitalize">{status}</span>
          </div>
        );
    }
  };

  return (
    <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-6 space-y-6 flex flex-col justify-between h-full min-h-[500px] shadow-sm">
      <div className="space-y-5">
        {/* Header: Title, Repo, Branch, Status */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-800 pb-4">
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-violet-400 shrink-0" />
              <h2 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
                Environment Details
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-neutral-100 break-words break-all">
                {repoName}
              </span>
              <span className="text-neutral-600">·</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#0c0e14] border border-neutral-800 text-[11px] font-mono text-neutral-300 break-words break-all">
                <GitBranch className="w-3 h-3 text-neutral-500 shrink-0" />
                {branch}
              </span>
            </div>
          </div>
          <div className="shrink-0">{getStatusDisplay()}</div>
        </div>

        {/* 4 Primary Specification Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {/* Runtime */}
          <div className="p-3.5 rounded-md bg-[#0c0e14] border border-neutral-800/90 flex flex-col justify-between gap-1.5">
            <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-neutral-500" />
              Runtime
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-neutral-100 block break-words break-all">
                {env.detectedRuntime}
              </span>
              {env.runtimeVersion && (
                <span className="text-[10px] font-mono text-neutral-400 block mt-0.5">
                  v{env.runtimeVersion}
                </span>
              )}
            </div>
          </div>

          {/* Package Manager */}
          <div className="p-3.5 rounded-md bg-[#0c0e14] border border-neutral-800/90 flex flex-col justify-between gap-1.5">
            <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-neutral-500" />
              Pkg Manager
            </span>
            <div className="min-w-0">
              <span className="font-mono font-bold text-violet-400 uppercase text-sm block">
                {env.packageManager}
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                Lockfile verified
              </span>
            </div>
          </div>

          {/* Dependencies */}
          <div className="p-3.5 rounded-md bg-[#0c0e14] border border-neutral-800/90 flex flex-col justify-between gap-1.5">
            <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
              <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
              Dependencies
            </span>
            <div className="min-w-0">
              <span className="font-mono font-bold text-neutral-100 tabular-nums text-sm block">
                {env.detectedDependencies}
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5">
                packages resolved
              </span>
            </div>
          </div>

          {/* Bound Port */}
          <div className="p-3.5 rounded-md bg-[#0c0e14] border border-neutral-800/90 flex flex-col justify-between gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-neutral-400 flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-neutral-500" />
                Bound Port
              </span>
              {onOpenPreview && (
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="text-[10px] text-violet-400 hover:text-violet-300 hover:underline flex items-center gap-0.5 cursor-pointer"
                  title="Open preview"
                >
                  <span>Preview</span>
                  <ExternalLink className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            <div className="min-w-0">
              <span className="font-mono font-bold text-emerald-400 tabular-nums text-sm block">
                :{env.port}
              </span>
              <span className="text-[10px] text-neutral-400 block mt-0.5 truncate">
                {env.healthEndpoint || '/api/health'}
              </span>
            </div>
          </div>
        </div>

        {/* Commands & Configuration Specs with clean wrapping */}
        <div className="space-y-2.5 text-xs">
          {/* Local Preview URL */}
          <div className="p-3 rounded-md bg-[#0c0e14] border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <ExternalLink className="w-3.5 h-3.5 text-violet-400 shrink-0" />
              <span className="text-neutral-400 text-[11px] font-medium">Local Preview:</span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0 flex-1 sm:justify-end">
              <button
                type="button"
                onClick={onOpenPreview}
                className="text-violet-400 hover:text-violet-300 text-xs font-mono break-all hover:underline flex items-center gap-1.5 cursor-pointer text-left"
              >
                <span>{previewUrl || `http://localhost:${env.port || 3000}`}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </button>
              {onOpenPreview && (
                <button
                  type="button"
                  onClick={onOpenPreview}
                  className="px-2 py-0.5 rounded text-[11px] font-medium text-violet-200 bg-violet-950/70 hover:bg-violet-900 border border-violet-800/60 transition-colors cursor-pointer shrink-0"
                >
                  Launch
                </button>
              )}
            </div>
          </div>

          {/* Start Command */}
          <div className="p-3 rounded-md bg-[#0c0e14] border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <Terminal className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="text-neutral-400 text-[11px] font-medium">Start Command:</span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0 flex-1 sm:justify-end">
              <code className="text-neutral-200 text-xs font-mono break-all whitespace-pre-wrap bg-neutral-900/80 px-2 py-1 rounded border border-neutral-800/60 max-w-full">
                {env.startCommand}
              </code>
              <button
                onClick={() => handleCopy(env.startCommand, 'start')}
                title="Copy start command"
                className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors shrink-0"
              >
                {copiedCmd === 'start' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Test Command */}
          <div className="p-3 rounded-md bg-[#0c0e14] border border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2 shrink-0">
              <FileCode className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
              <span className="text-neutral-400 text-[11px] font-medium">Test Command:</span>
            </div>
            <div className="flex items-center justify-between gap-2 min-w-0 flex-1 sm:justify-end">
              <code className="text-neutral-200 text-xs font-mono break-all whitespace-pre-wrap bg-neutral-900/80 px-2 py-1 rounded border border-neutral-800/60 max-w-full">
                {env.testCommand}
              </code>
              <button
                onClick={() => handleCopy(env.testCommand, 'test')}
                title="Copy test command"
                className="p-1 rounded text-neutral-500 hover:text-neutral-200 hover:bg-neutral-800 transition-colors shrink-0"
              >
                {copiedCmd === 'test' ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Resources & Health Allocation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
          <div className="p-2.5 rounded bg-[#0c0e14] border border-neutral-800/80 flex items-center justify-between">
            <span className="text-neutral-400 text-[11px]">Allocated Memory:</span>
            <span className="font-mono text-neutral-200 font-medium">
              {env.memoryMb ? `${env.memoryMb} MB` : '4096 MB'}
            </span>
          </div>
          <div className="p-2.5 rounded bg-[#0c0e14] border border-neutral-800/80 flex items-center justify-between">
            <span className="text-neutral-400 text-[11px]">vCPU Cores:</span>
            <span className="font-mono text-neutral-200 font-medium">
              {env.cpuCores ? `${env.cpuCores} vCPU` : '2 vCPU'}
            </span>
          </div>
          <div className="col-span-2 sm:col-span-1 p-2.5 rounded bg-[#0c0e14] border border-neutral-800/80 flex items-center justify-between">
            <span className="text-neutral-400 text-[11px]">Health Probe:</span>
            <span className="font-mono text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              {healthStatus?.latencyMs ? `${healthStatus.latencyMs}ms` : '18ms'} (200)
            </span>
          </div>
        </div>

        {/* Detected Core Modules Chips with clean wrapping */}
        {env.dependenciesList && env.dependenciesList.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-neutral-400">
                Detected Core Modules ({env.dependenciesList.length})
              </span>
              <span className="text-[10px] text-neutral-500">Auto-configured</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {env.dependenciesList.slice(0, 8).map((dep, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded bg-[#0c0e14] border border-neutral-800 text-[11px] font-mono text-neutral-300 break-all"
                >
                  {dep}
                </span>
              ))}
              {env.dependenciesList.length > 8 && (
                <span className="px-2 py-1 text-[11px] text-neutral-500 self-center">
                  +{env.dependenciesList.length - 8} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="pt-4 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
          <span>Lease expiration:</span>
          <span className="font-mono text-neutral-200">{env.leaseExpiresAt}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onViewDiagnostics && (
            <button
              onClick={onViewDiagnostics}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 hover:text-white transition-colors cursor-pointer border border-neutral-700/60"
            >
              View Full Diagnostics
            </button>
          )}

          {onRestart && (
            <button
              onClick={onRestart}
              disabled={isRetrying}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium text-neutral-300 bg-neutral-800 hover:bg-neutral-700 transition-colors flex items-center gap-1.5 cursor-pointer border border-neutral-700/60 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>Retry Sandbox</span>
            </button>
          )}

          {onOpenPreview && (
            <button
              onClick={onOpenPreview}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm ${
                status === 'running'
                  ? 'text-white bg-violet-600 hover:bg-violet-500 active:bg-violet-700 shadow-violet-950/40'
                  : 'text-neutral-200 bg-violet-900/40 hover:bg-violet-800/60 border border-violet-700/50 hover:text-white'
              }`}
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Open Local Preview</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
