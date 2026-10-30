import React from 'react';
import {
  Cpu,
  Server,
  AlertCircle,
  Clock,
  CheckCircle2,
  ExternalLink,
  Eye,
  ShieldCheck,
  Activity,
  ArrowUpRight,
  HardDrive,
  Layers,
  ScrollText,
} from 'lucide-react';
import { Sandbox, AccessRequest, AuditActivityEvent, AdminNavTab } from '../../types/sandbox';

interface AdminOverviewTabProps {
  sandboxes: Sandbox[];
  accessRequests: AccessRequest[];
  auditLogs: AuditActivityEvent[];
  onSelectSandbox: (sandbox: Sandbox) => void;
  onNavigateTab?: (tab: AdminNavTab) => void;
}

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  sandboxes,
  accessRequests,
  auditLogs,
  onSelectSandbox,
  onNavigateTab,
}) => {
  const totalSandboxes = sandboxes.length;
  const runningSandboxes = sandboxes.filter((s) => s.status === 'running').length;
  const failedSandboxes = sandboxes.filter((s) => s.status === 'failed').length;
  const pendingRequests = accessRequests.filter((r) => r.status === 'pending').length;

  const allocatedCores = runningSandboxes * 2;
  const totalCores = 16;
  const cpuPercent = Math.min(100, Math.round((allocatedCores / totalCores) * 100));

  const allocatedRamMb = runningSandboxes * 2048;
  const totalRamMb = 32768;
  const ramPercent = Math.min(100, Math.round((allocatedRamMb / totalRamMb) * 100));

  const allocatedPorts = runningSandboxes;
  const totalPorts = 50;
  const portsPercent = Math.min(100, Math.round((allocatedPorts / totalPorts) * 100));

  return (
    <div className="space-y-6">
      {/* 4 Summary KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Environments */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] hover:border-[#2b354a] transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium">Total Environments</span>
            <Layers className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-neutral-100">{totalSandboxes}</div>
            <p className="text-[11px] text-neutral-500 mt-0.5">Across all developer teams</p>
          </div>
          <div className="pt-2 border-t border-[#181f2c] flex items-center justify-between text-[11px] text-neutral-400">
            <span>Container instances</span>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('admin-sandboxes')}
                className="text-violet-400 hover:text-violet-300 font-medium cursor-pointer flex items-center gap-0.5"
              >
                <span>View all</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Card 2: Running Hosts */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-emerald-500/30 hover:border-emerald-500/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-emerald-300">Running Hosts</span>
            <span className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>LIVE</span>
            </span>
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-emerald-400">{runningSandboxes}</div>
            <p className="text-[11px] text-neutral-400 mt-0.5">Active loopback port leases</p>
          </div>
          <div className="pt-2 border-t border-[#181f2c] flex items-center justify-between text-[11px] text-neutral-400">
            <span>{allocatedCores} vCPUs in use</span>
            <span className="font-mono text-emerald-400/90 font-medium">cgroups v2</span>
          </div>
        </div>

        {/* Card 3: Failed Probes */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-rose-500/30 hover:border-rose-500/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-rose-300">Failed Probes</span>
            <AlertCircle className={`w-4 h-4 ${failedSandboxes > 0 ? 'text-rose-400' : 'text-neutral-500'}`} />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-rose-400">{failedSandboxes}</div>
            <p className="text-[11px] text-neutral-400 mt-0.5">Failed readiness smoke checks</p>
          </div>
          <div className="pt-2 border-t border-[#181f2c] flex items-center justify-between text-[11px] text-neutral-400">
            <span>Health verification</span>
            <span className={`font-mono text-[10px] ${failedSandboxes > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {failedSandboxes > 0 ? 'Action required' : 'Zero active alerts'}
            </span>
          </div>
        </div>

        {/* Card 4: Pending Approvals */}
        <div className="p-4 rounded-xl bg-[#0e121a] border border-amber-500/30 hover:border-amber-500/50 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-amber-300">Pending Approvals</span>
            <Clock className={`w-4 h-4 ${pendingRequests > 0 ? 'text-amber-400' : 'text-neutral-500'}`} />
          </div>
          <div className="my-2">
            <div className="text-2xl font-bold font-mono text-amber-400">{pendingRequests}</div>
            <p className="text-[11px] text-neutral-400 mt-0.5">Awaiting security sign-off</p>
          </div>
          <div className="pt-2 border-t border-[#181f2c] flex items-center justify-between text-[11px] text-neutral-400">
            <span>Security gates</span>
            {pendingRequests > 0 && onNavigateTab ? (
              <button
                onClick={() => onNavigateTab('admin-requests')}
                className="text-amber-300 hover:text-amber-200 font-medium cursor-pointer flex items-center gap-0.5"
              >
                <span>Review now</span>
                <ArrowUpRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-neutral-500">All cleared</span>
            )}
          </div>
        </div>
      </div>

      {/* Cluster Resource Quota Snapshot (cgroups v2) */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#181f2c]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-violet-950/40 border border-violet-800/40 text-violet-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                <span>Sandbox Host Isolation Pool</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-violet-950/60 text-violet-300 border border-violet-800/40 font-semibold">
                  cgroups v2
                </span>
              </h3>
              <p className="text-xs text-neutral-400 mt-0.5">
                Rootless namespace enforcing CPU ceilings, memory limits, and isolated ephemeral loopback ports.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-mono text-neutral-400 bg-[#121622] px-2.5 py-1 rounded-md border border-[#1e2433] shrink-0">
            Namespace: 127.0.0.1 Rootless
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          {/* CPU Allocation */}
          <div className="p-3.5 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-2">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="font-medium">Allocated CPU Cores</span>
              <span className="font-mono text-neutral-300 text-[11px]">{cpuPercent}%</span>
            </div>
            <div className="text-base font-bold font-mono text-neutral-100">
              {allocatedCores} / {totalCores} Cores
            </div>
            <div className="w-full bg-[#161c28] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-violet-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${cpuPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500">2 Cores assigned per running container</p>
          </div>

          {/* RAM Allocation */}
          <div className="p-3.5 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-2">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="font-medium">Allocated RAM Pool</span>
              <span className="font-mono text-neutral-300 text-[11px]">{ramPercent}%</span>
            </div>
            <div className="text-base font-bold font-mono text-neutral-100">
              {allocatedRamMb} / {totalRamMb} MB
            </div>
            <div className="w-full bg-[#161c28] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-sky-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${ramPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500">2048 MB memory ceiling per sandbox</p>
          </div>

          {/* Network Namespace Ports */}
          <div className="p-3.5 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-2">
            <div className="flex items-center justify-between text-neutral-400">
              <span className="font-medium">Network Namespace Ports</span>
              <span className="font-mono text-neutral-300 text-[11px]">{portsPercent}%</span>
            </div>
            <div className="text-base font-bold font-mono text-emerald-400">
              {allocatedPorts} / {totalPorts} Bound Ports
            </div>
            <div className="w-full bg-[#161c28] h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${portsPercent}%` }}
              />
            </div>
            <p className="text-[11px] text-neutral-500">Ephemeral lease range: 3000-8000</p>
          </div>
        </div>
      </div>

      {/* Two-Column Lower Section: Active Environment Summary & Live Audit Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Active Environment Summary (7 cols) */}
        <div className="lg:col-span-7 bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#181f2c]">
              <div>
                <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                  <Server className="w-4 h-4 text-violet-400" />
                  <span>Active Sandbox Environments</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Current container instances and active port bindings.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('admin-sandboxes')}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium cursor-pointer flex items-center gap-1"
                >
                  <span>Manage all</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {sandboxes.length === 0 ? (
              <div className="p-8 text-center rounded-lg bg-[#090b10] border border-[#1a2130] text-neutral-400 text-xs">
                No active sandbox environments found.
              </div>
            ) : (
              <div className="divide-y divide-[#181f2c] rounded-lg border border-[#1a2130] overflow-hidden bg-[#090b10]">
                {sandboxes.slice(0, 4).map((sbx) => (
                  <div
                    key={sbx.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-[#0e131d] transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-200 truncate">{sbx.repoName}</span>
                        <span className="font-mono text-[10px] text-neutral-500">({sbx.id})</span>
                        <span
                          className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                            sbx.status === 'running'
                              ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                              : sbx.status === 'awaiting_approval'
                              ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                              : sbx.status === 'failed'
                              ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                              : 'bg-neutral-800 text-neutral-400'
                          }`}
                        >
                          {sbx.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-2">
                        <span>{sbx.branch}</span>
                        <span>·</span>
                        <span>Port :{sbx.env.port}</span>
                        <span>·</span>
                        <span>{sbx.env.memoryMb}MB RAM</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectSandbox(sbx)}
                      className="px-2.5 py-1 rounded-md bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-200 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 text-neutral-400" />
                      <span>Inspect</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#181f2c] flex items-center justify-between text-xs text-neutral-400">
            <span>Showing top {Math.min(4, sandboxes.length)} of {sandboxes.length} environments</span>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('admin-sandboxes')}
                className="text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
              >
                Open Full Environment List →
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Security & LangGraph Checkpoint Feed (5 cols) */}
        <div className="lg:col-span-5 bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between pb-3 border-b border-[#181f2c]">
              <div>
                <h3 className="text-sm font-bold text-neutral-100 flex items-center gap-2">
                  <ScrollText className="w-4 h-4 text-violet-400" />
                  <span>Security & Audit Stream</span>
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Recent LangGraph gate & policy events.
                </p>
              </div>
              {onNavigateTab && (
                <button
                  onClick={() => onNavigateTab('admin-audit')}
                  className="text-xs text-violet-400 hover:text-violet-300 font-medium cursor-pointer flex items-center gap-1"
                >
                  <span>All logs</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {auditLogs.length === 0 ? (
              <div className="p-8 text-center rounded-lg bg-[#090b10] border border-[#1a2130] text-neutral-400 text-xs">
                No recent audit activity recorded.
              </div>
            ) : (
              <div className="space-y-2.5">
                {auditLogs.slice(0, 4).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-1 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-mono text-[10px]">
                        <span className="text-neutral-500">{log.timestamp}</span>
                        <span className="text-neutral-600">·</span>
                        <span className="text-violet-300 font-medium">{log.actor}</span>
                      </div>
                      <span
                        className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded font-semibold ${
                          log.status === 'success'
                            ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-500/30'
                            : log.status === 'warning'
                            ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                            : log.status === 'error'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                            : 'bg-neutral-800 text-neutral-300'
                        }`}
                      >
                        {log.status}
                      </span>
                    </div>
                    <div className="font-semibold text-neutral-200 text-xs truncate">
                      {log.action}
                    </div>
                    <p className="text-[11px] text-neutral-400 line-clamp-1 font-sans">
                      {log.details}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-[#181f2c] text-xs text-neutral-400 flex items-center justify-between">
            <span className="flex items-center gap-1 text-[11px]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Immutable audit ledger</span>
            </span>
            {onNavigateTab && (
              <button
                onClick={() => onNavigateTab('admin-audit')}
                className="text-violet-400 hover:text-violet-300 font-medium cursor-pointer"
              >
                Inspect Ledger →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
