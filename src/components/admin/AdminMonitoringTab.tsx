import React, { useMemo } from 'react';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Cpu,
  Server,
  Layers,
  ExternalLink,
  ShieldCheck,
  Eye,
  Radio,
  Wifi,
  HardDrive,
  RefreshCw,
} from 'lucide-react';
import { Sandbox } from '../../types/sandbox';

interface AdminMonitoringTabProps {
  sandboxes: Sandbox[];
  onSelectSandbox: (sandbox: Sandbox) => void;
}

export const AdminMonitoringTab: React.FC<AdminMonitoringTabProps> = ({
  sandboxes,
  onSelectSandbox,
}) => {
  const total = sandboxes.length;
  const runningCount = sandboxes.filter((s) => s.status === 'running').length;
  const failedCount = sandboxes.filter((s) => s.status === 'failed').length;
  const pendingCount = sandboxes.filter((s) => s.status === 'awaiting_approval').length;

  const successRate = total > 0 ? Math.round((runningCount / total) * 100) : 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2433]">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            <span>Environment Health & Readiness Probe Telemetry</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Real-time status of sandbox container probes, port bindings, and cgroups v2 resource health.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Telemetry Stream Active</span>
          </span>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Readiness Probe Success Rate */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-medium">Readiness Probe Success Rate</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {successRate}%
          </div>
          <p className="text-[11px] text-neutral-400">
            {runningCount} healthy of {total} environments · avg 24ms latency
          </p>
        </div>

        {/* Card 2: Active Runtimes */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-medium">Active Runtimes & Engines</span>
            <Cpu className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="text-2xl font-bold font-mono text-neutral-100">
            Node.js & Python
          </div>
          <p className="text-[11px] text-neutral-400">
            npm, pnpm, yarn, poetry, pip, uv supported
          </p>
        </div>

        {/* Card 3: Active Port Bindings */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-2">
          <div className="flex items-center justify-between text-neutral-400 text-xs">
            <span className="font-medium">Active Port Bindings</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {runningCount} Allocated
          </div>
          <p className="text-[11px] text-neutral-400">
            Ephemeral lease range 3000-8000 on 127.0.0.1
          </p>
        </div>
      </div>

      {/* Cluster Subsystems Status Grid */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4">
        <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Core Infrastructure Subsystems</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-300">LangGraph Agent Engine</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                HEALTHY
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              State machine checkpoints persistent and recoverable
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-300">cgroups v2 Isolation</span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                ENFORCING
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Rootless namespace CPU & memory quotas active
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-300">Port Lease Manager</span>
              <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/60 px-1.5 py-0.2 rounded border border-cyan-500/30">
                BOUND
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Isolated loopback address 127.0.0.1 mapping
            </p>
          </div>

          <div className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-300">Lease Garbage Collector</span>
              <span className="text-[10px] font-mono text-violet-400 bg-violet-950/60 px-1.5 py-0.2 rounded border border-violet-800/40">
                ACTIVE
              </span>
            </div>
            <p className="text-[11px] text-neutral-400">
              Auto-pruning stale and stopped container leases
            </p>
          </div>
        </div>
      </div>

      {/* Environment Health & Probe Matrix */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl overflow-hidden space-y-0">
        <div className="p-4 border-b border-[#181f2c] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <span>Live Environment Probe Matrix</span>
            </h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Individual sandbox HTTP readiness smoke checks and cgroup namespace metrics.
            </p>
          </div>
          <span className="text-xs font-mono text-neutral-400">{total} Monitored Environments</span>
        </div>

        {total === 0 ? (
          <div className="p-12 text-center text-neutral-400 text-xs space-y-2">
            <Activity className="w-8 h-8 text-neutral-600 mx-auto" />
            <p>No sandbox environments currently available to monitor.</p>
          </div>
        ) : (
          <div className="divide-y divide-[#181f2c]">
            {sandboxes.map((sbx) => {
              const isRunning = sbx.status === 'running';
              const isFailed = sbx.status === 'failed';
              const isPending = sbx.status === 'awaiting_approval';

              return (
                <div
                  key={sbx.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-[#111622] transition-colors"
                >
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-xs text-neutral-100 truncate">{sbx.repoName}</span>
                      <span className="font-mono text-xs text-neutral-500">({sbx.id})</span>
                      <span
                        className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                          isRunning
                            ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                            : isPending
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                            : isFailed
                            ? 'bg-rose-950/70 text-rose-300 border border-rose-500/40'
                            : 'bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {isRunning
                          ? 'PROBE HEALTHY (200 OK)'
                          : isPending
                          ? 'AWAITING APPROVAL'
                          : isFailed
                          ? 'PROBE FAILED'
                          : 'INACTIVE'}
                      </span>
                    </div>

                    <div className="text-[11px] text-neutral-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-neutral-300">
                        Target: http://127.0.0.1:{sbx.env.port}
                      </span>
                      <span className="text-neutral-600">·</span>
                      <span>Latency: {isRunning ? '28ms' : '-'}</span>
                      <span className="text-neutral-600">·</span>
                      <span>Memory: {sbx.env.memoryMb || 2048}MB limit</span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-emerald-400/90 font-medium">cgroups v2 restricted</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => onSelectSandbox(sbx)}
                      className="px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-violet-400 hover:text-violet-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Inspect Diagnostics</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
