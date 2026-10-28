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
}

export const SandboxHistoryView: React.FC<SandboxHistoryViewProps> = ({
  sandboxes,
  onSelectSandbox,
  onRetrySandbox,
  onStopSandbox,
  onDeleteSandbox,
  onOpenPreview,
  initialFilter = 'all',
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [runtimeFilter, setRuntimeFilter] = useState<string>('all');

  // Filter logic
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
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
            Running
          </span>
        );
      case 'success':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Verified
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400">
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
            Failed
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-neutral-500"></span>
            Stopped
          </span>
        );
      default:
        return <span className="text-xs text-neutral-400">{status}</span>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header and Filter Controls */}
      <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by repo name, branch, or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500/80"
            />
          </div>

          {/* Status Filter Tabs */}
          <div className="flex items-center p-1 bg-[#0c0e14] border border-neutral-800 rounded-md text-xs">
            {['all', 'running', 'success', 'failed', 'stopped'].map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1 rounded capitalize font-medium transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-neutral-800 text-neutral-100 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Runtime Dropdown */}
          <select
            value={runtimeFilter}
            onChange={(e) => setRuntimeFilter(e.target.value)}
            className="px-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-xs text-neutral-300 focus:outline-none focus:border-violet-500/80 cursor-pointer"
          >
            <option value="all">All Runtimes</option>
            <option value="node">Node.js</option>
            <option value="python">Python</option>
          </select>
        </div>
      </div>

      {/* Table Container */}
      <div className="bg-[#11141c] border border-neutral-800 rounded-lg overflow-hidden">
        {filteredSandboxes.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-10 h-10 mx-auto rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-500">
              <Search className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-semibold text-neutral-300">
              No sandboxes match criteria
            </h3>
            <p className="text-xs text-neutral-500 max-w-sm mx-auto">
              Try adjusting your search terms or filters to find past sandbox runs.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#0e1117] text-neutral-400 border-b border-neutral-800 font-medium select-none">
                <tr>
                  <th className="py-3 px-4">Repository</th>
                  <th className="py-3 px-4">Branch</th>
                  <th className="py-3 px-4">Runtime</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Port</th>
                  <th className="py-3 px-4">Created</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {filteredSandboxes.map((sbx) => (
                  <tr
                    key={sbx.id}
                    className="hover:bg-neutral-800/30 transition-colors group"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Github className="w-4 h-4 text-neutral-500 shrink-0" />
                        <div>
                          <div className="font-semibold text-neutral-200 hover:text-violet-300 transition-colors cursor-pointer" onClick={() => onSelectSandbox(sbx)}>
                            {sbx.repoOwner}/{sbx.repoName}
                          </div>
                          <div className="text-[10px] text-neutral-500 font-mono">
                            {sbx.id}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 font-mono text-neutral-300">
                        <GitBranch className="w-3.5 h-3.5 text-neutral-500" />
                        <span>{sbx.branch}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-neutral-300">
                          {sbx.runtime === 'node' ? 'Node.js' : 'Python'}
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">
                          ({sbx.packageManager})
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4">{getStatusBadge(sbx.status)}</td>

                    <td className="py-3 px-4 font-mono tabular-nums text-neutral-400">
                      :{sbx.env.port}
                    </td>

                    <td className="py-3 px-4 text-neutral-400 font-mono text-[11px]">
                      {sbx.createdAt}
                    </td>

                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {sbx.status === 'running' && (
                          <button
                            onClick={() => onOpenPreview(sbx)}
                            title="Open Preview"
                            className="p-1.5 rounded text-neutral-400 hover:text-indigo-300 hover:bg-neutral-800 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onSelectSandbox(sbx)}
                          title="View Setup Timeline & Diagnostics"
                          className="px-2.5 py-1 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Details</span>
                        </button>

                        <button
                          onClick={() => onRetrySandbox(sbx)}
                          title="Retry Sandbox Run"
                          className="p-1.5 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {sbx.status === 'running' && (
                          <button
                            onClick={() => onStopSandbox(sbx.id)}
                            title="Stop Running Sandbox"
                            className="p-1.5 rounded text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                          >
                            <Power className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => onDeleteSandbox(sbx.id)}
                          title="Remove from history"
                          className="p-1.5 rounded text-neutral-500 hover:text-rose-400 hover:bg-neutral-800 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
