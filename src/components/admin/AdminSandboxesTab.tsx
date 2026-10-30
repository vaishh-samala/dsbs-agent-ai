import React, { useState, useMemo } from 'react';
import {
  Server,
  Search,
  Filter,
  Eye,
  Power,
  ExternalLink,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  HardDrive,
  Layers,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Sandbox } from '../../types/sandbox';

interface AdminSandboxesTabProps {
  sandboxes: Sandbox[];
  onSelectSandbox: (sandbox: Sandbox) => void;
  onStopSandbox: (id: string) => void;
  notify?: (msg: string) => void;
}

export const AdminSandboxesTab: React.FC<AdminSandboxesTabProps> = ({
  sandboxes,
  onSelectSandbox,
  onStopSandbox,
  notify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'awaiting_approval' | 'failed' | 'stopped'>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<'all' | 'node' | 'python'>('all');
  const [sortBy, setSortBy] = useState<'id' | 'name' | 'memory'>('id');
  const [confirmStopSandbox, setConfirmStopSandbox] = useState<Sandbox | null>(null);

  // Status Counts
  const counts = useMemo(() => {
    return {
      all: sandboxes.length,
      running: sandboxes.filter((s) => s.status === 'running').length,
      awaiting_approval: sandboxes.filter((s) => s.status === 'awaiting_approval').length,
      failed: sandboxes.filter((s) => s.status === 'failed').length,
      stopped: sandboxes.filter((s) => s.status === 'stopped').length,
    };
  }, [sandboxes]);

  // Filtered and Sorted Sandboxes
  const filteredSandboxes = useMemo(() => {
    return sandboxes
      .filter((sbx) => {
        // Status filter
        if (statusFilter !== 'all' && sbx.status !== statusFilter) return false;
        // Runtime filter
        if (runtimeFilter !== 'all' && sbx.runtime !== runtimeFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = sbx.repoName.toLowerCase().includes(q);
          const matchId = sbx.id.toLowerCase().includes(q);
          const matchBranch = sbx.branch.toLowerCase().includes(q);
          const matchUrl = sbx.repoUrl?.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchBranch && !matchUrl) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.repoName.localeCompare(b.repoName);
        if (sortBy === 'memory') return (b.env.memoryMb || 0) - (a.env.memoryMb || 0);
        return b.id.localeCompare(a.id);
      });
  }, [sandboxes, statusFilter, runtimeFilter, searchQuery, sortBy]);

  const handleExecuteStop = (sbx: Sandbox) => {
    onStopSandbox(sbx.id);
    if (notify) {
      notify(`Force stopped and reclaimed cgroup lease for sandbox ${sbx.id}`);
    }
    setConfirmStopSandbox(null);
  };

  return (
    <div className="space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2433]">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <Server className="w-4 h-4 text-violet-400" />
            <span>All Sandbox Environments</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Audit container namespaces, inspect live telemetry, and control cgroups v2 process lifecycles.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-[#121622] border border-[#1e2433] text-neutral-300">
            {counts.all} Environments Registered
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{counts.running} Live</span>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by repository name, branch, or workflow ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-8 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Runtime Filter */}
          <div className="flex items-center gap-2 shrink-0">
            <select
              value={runtimeFilter}
              onChange={(e) => setRuntimeFilter(e.target.value as any)}
              className="px-3 py-2 bg-[#090b10] border border-[#1a2130] rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-violet-500/60 cursor-pointer"
            >
              <option value="all">All Runtimes</option>
              <option value="node">Node.js Runtimes</option>
              <option value="python">Python Runtimes</option>
            </select>

            {/* Sort Filter */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-[#090b10] border border-[#1a2130] rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-violet-500/60 cursor-pointer"
            >
              <option value="id">Sort: Newest First</option>
              <option value="name">Sort: Repository Name</option>
              <option value="memory">Sort: Memory Allocation</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'all'
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
            }`}
          >
            <span>All</span>
            <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.all}</span>
          </button>

          <button
            onClick={() => setStatusFilter('running')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'running'
                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Running</span>
            <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.running}</span>
          </button>

          <button
            onClick={() => setStatusFilter('awaiting_approval')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'awaiting_approval'
                ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Awaiting Approval</span>
            <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.awaiting_approval}</span>
          </button>

          <button
            onClick={() => setStatusFilter('failed')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'failed'
                ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40'
                : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            <span>Failed</span>
            <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.failed}</span>
          </button>

          <button
            onClick={() => setStatusFilter('stopped')}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
              statusFilter === 'stopped'
                ? 'bg-neutral-700/40 text-neutral-200 border border-neutral-600'
                : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
            }`}
          >
            <span>Stopped</span>
            <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.stopped}</span>
          </button>
        </div>
      </div>

      {/* Environments List / Table */}
      {filteredSandboxes.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
          <Layers className="w-8 h-8 text-neutral-600 mx-auto" />
          <h3 className="text-sm font-semibold text-neutral-200">No environments match your criteria</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Try adjusting your search terms or filters to locate specific developer sandbox instances.
          </p>
          {(searchQuery || statusFilter !== 'all' || runtimeFilter !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
                setRuntimeFilter('all');
              }}
              className="px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-violet-400 text-xs font-medium cursor-pointer transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      ) : (
        <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl overflow-hidden divide-y divide-[#181f2c]">
          {filteredSandboxes.map((sbx) => (
            <div
              key={sbx.id}
              className="p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-[#111622] transition-colors"
            >
              {/* Left Column: Repository, Branch & Workflow Identity */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold text-sm text-neutral-100 truncate">{sbx.repoName}</span>
                  <a
                    href={sbx.repoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-neutral-500 hover:text-neutral-300 transition-colors"
                    title="View repository on GitHub"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <span className="font-mono text-xs text-neutral-500 bg-[#121622] px-1.5 py-0.5 rounded border border-[#1e2433]">
                    {sbx.id}
                  </span>
                  {sbx.workflowId && sbx.workflowId !== sbx.id && (
                    <span className="font-mono text-[10px] text-violet-400/90 bg-violet-950/40 px-1.5 py-0.5 rounded border border-violet-800/40">
                      wf: {sbx.workflowId}
                    </span>
                  )}
                  {/* Status Badge */}
                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                      sbx.status === 'running'
                        ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                        : sbx.status === 'awaiting_approval'
                        ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40 animate-pulse'
                        : sbx.status === 'failed'
                        ? 'bg-rose-950/70 text-rose-300 border border-rose-500/40'
                        : 'bg-neutral-800 text-neutral-400 border border-neutral-700/60'
                    }`}
                  >
                    {sbx.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Subtitle Details: branch, runtime, port, memory */}
                <div className="text-xs text-neutral-400 font-mono flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="text-neutral-300 bg-[#141a26] px-1.5 py-0.2 rounded border border-[#232c3d]">
                    {sbx.branch}
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span className="capitalize">{sbx.runtimeVersion || sbx.runtime}</span>
                  <span className="text-neutral-600">·</span>
                  <span className="text-neutral-300">
                    Port :{sbx.env.port}
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span className="flex items-center gap-1">
                    <HardDrive className="w-3 h-3 text-neutral-500" />
                    <span>{sbx.env.memoryMb || 2048}MB RAM</span>
                  </span>
                  <span className="text-neutral-600">·</span>
                  <span>{sbx.env.cpuCores || 2} Cores</span>
                </div>
              </div>

              {/* Right Column: Actions */}
              <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                {sbx.status === 'running' && (
                  <a
                    href={`http://localhost:${sbx.env.port}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-emerald-400 hover:text-emerald-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open :{sbx.env.port}</span>
                  </a>
                )}

                <button
                  onClick={() => onSelectSandbox(sbx)}
                  className="px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-200 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Eye className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Inspect</span>
                </button>

                {sbx.status === 'running' && (
                  <button
                    onClick={() => setConfirmStopSandbox(sbx)}
                    className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Power className="w-3.5 h-3.5" />
                    <span>Force Stop</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Dialog for Destructive Force Stop */}
      {confirmStopSandbox && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0e121a] border border-rose-500/40 rounded-xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-rose-950/60 border border-rose-800/40 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-bold text-neutral-100">
                  Confirm Force Stop Sandbox?
                </h3>
                <p className="text-xs text-neutral-400 leading-relaxed">
                  Are you sure you want to terminate the container process for{' '}
                  <strong className="text-neutral-200 font-mono">{confirmStopSandbox.repoName}</strong> (
                  <span className="font-mono text-neutral-400">{confirmStopSandbox.id}</span>)?
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] text-xs font-mono text-neutral-300 space-y-1">
              <div className="flex justify-between">
                <span className="text-neutral-500">Bound Port:</span>
                <span className="text-emerald-400">127.0.0.1:{confirmStopSandbox.env.port}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">cgroups Memory:</span>
                <span>{confirmStopSandbox.env.memoryMb}MB unbinding</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Effect:</span>
                <span className="text-rose-300">Container SIGKILL & lease returned to pool</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#181f2c]">
              <button
                type="button"
                onClick={() => setConfirmStopSandbox(null)}
                className="px-3.5 py-1.5 rounded-lg text-neutral-300 hover:text-neutral-100 hover:bg-[#141a26] text-xs font-medium transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExecuteStop(confirmStopSandbox)}
                className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold transition-colors cursor-pointer shadow-md flex items-center gap-1.5"
              >
                <Power className="w-3.5 h-3.5" />
                <span>Confirm Force Stop</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
