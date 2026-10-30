import React, { useState, useMemo } from 'react';
import {
  Users,
  Search,
  Filter,
  UserCheck,
  CheckCircle2,
  Clock,
  Layers,
  Activity,
  HardDrive,
  X,
  Shield,
  Code,
} from 'lucide-react';
import { DeveloperUser } from '../../types/sandbox';

interface AdminDevelopersTabProps {
  developers: DeveloperUser[];
}

export const AdminDevelopersTab: React.FC<AdminDevelopersTabProps> = ({
  developers,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'developer' | 'lead' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'idle'>('all');

  // Summary Metrics
  const summary = useMemo(() => {
    const total = developers.length;
    const active = developers.filter((d) => d.status === 'active').length;
    const totalSandboxes = developers.reduce((acc, d) => acc + (d.activeSandboxes || 0), 0);
    const totalRuns = developers.reduce((acc, d) => acc + (d.totalRuns || 0), 0);
    return { total, active, totalSandboxes, totalRuns };
  }, [developers]);

  // Filtered Developers
  const filteredDevelopers = useMemo(() => {
    return developers.filter((dev) => {
      if (roleFilter !== 'all' && dev.role !== roleFilter) return false;
      if (statusFilter !== 'all' && dev.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = dev.name.toLowerCase().includes(q);
        const matchEmail = dev.email.toLowerCase().includes(q);
        if (!matchName && !matchEmail) return false;
      }
      return true;
    });
  }, [developers, roleFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-5">
      {/* Page Heading & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2433]">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            <span>Developer Directory & Team Leases</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Overview of developer accounts, active sandbox allocations, and cluster usage history.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-[#121622] border border-[#1e2433] text-neutral-300">
            {summary.total} Registered Accounts
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>{summary.active} Active Now</span>
          </span>
        </div>
      </div>

      {/* Summary KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3.5 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-1">
          <span className="text-[11px] font-medium text-neutral-400">Total Developers</span>
          <div className="text-xl font-bold font-mono text-neutral-100">{summary.total}</div>
          <p className="text-[10px] text-neutral-500">Authorized in organization</p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0e121a] border border-emerald-500/25 space-y-1">
          <span className="text-[11px] font-medium text-emerald-300 flex items-center justify-between">
            <span>Active Developers</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </span>
          <div className="text-xl font-bold font-mono text-emerald-400">{summary.active}</div>
          <p className="text-[10px] text-neutral-500">Active sessions in cluster</p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-1">
          <span className="text-[11px] font-medium text-neutral-400">Active Sandboxes</span>
          <div className="text-xl font-bold font-mono text-cyan-400">{summary.totalSandboxes}</div>
          <p className="text-[10px] text-neutral-500">Allocated cgroup namespaces</p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-1">
          <span className="text-[11px] font-medium text-neutral-400">Total Workflow Runs</span>
          <div className="text-xl font-bold font-mono text-violet-400">{summary.totalRuns}</div>
          <p className="text-[10px] text-neutral-500">Cumulative bootstraps</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search by name or email address..."
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

          <div className="flex items-center gap-2 shrink-0">
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as any)}
              className="px-3 py-2 bg-[#090b10] border border-[#1a2130] rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-violet-500/60 cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="developer">Developer</option>
              <option value="lead">Engineering Lead</option>
              <option value="admin">Administrator</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="px-3 py-2 bg-[#090b10] border border-[#1a2130] rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-violet-500/60 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Now</option>
              <option value="idle">Idle</option>
            </select>
          </div>
        </div>
      </div>

      {/* Developers Table */}
      {filteredDevelopers.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
          <Users className="w-8 h-8 text-neutral-600 mx-auto" />
          <h3 className="text-sm font-semibold text-neutral-200">No developers match your filters</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Try adjusting your search criteria or role filters to view team members.
          </p>
        </div>
      ) : (
        <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl overflow-hidden divide-y divide-[#181f2c]">
          {/* Table Header (hidden on mobile, shown on md+) */}
          <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-3 bg-[#090b10] text-[11px] font-mono font-semibold text-neutral-500 uppercase tracking-wider">
            <div className="col-span-4">Developer</div>
            <div className="col-span-2">Role</div>
            <div className="col-span-2">Active Sandboxes</div>
            <div className="col-span-2">Total Runs</div>
            <div className="col-span-2 text-right">Last Active / Status</div>
          </div>

          {/* Rows */}
          {filteredDevelopers.map((dev) => (
            <div
              key={dev.id}
              className="p-4 md:py-3.5 md:grid md:grid-cols-12 md:gap-4 md:items-center hover:bg-[#111622] transition-colors flex flex-col gap-3"
            >
              {/* Developer identity */}
              <div className="col-span-4 flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-violet-950/70 border border-violet-800/40 text-violet-300 font-bold text-xs flex items-center justify-center shrink-0">
                  {dev.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-bold text-xs text-neutral-100 truncate">{dev.name}</div>
                  <div className="text-[11px] text-neutral-500 font-mono truncate">{dev.email}</div>
                </div>
              </div>

              {/* Role */}
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 md:hidden font-mono">Role:</span>
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                    dev.role === 'admin'
                      ? 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
                      : dev.role === 'lead'
                      ? 'bg-violet-950/60 text-violet-300 border border-violet-500/30'
                      : 'bg-[#141a26] text-neutral-300 border border-[#232c3d]'
                  }`}
                >
                  {dev.role}
                </span>
              </div>

              {/* Active Sandboxes */}
              <div className="col-span-2 flex items-center gap-2">
                <span className="text-[10px] text-neutral-500 md:hidden font-mono">Active Sandboxes:</span>
                <span
                  className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                    dev.activeSandboxes > 0
                      ? 'bg-cyan-950/60 text-cyan-300 border border-cyan-500/30'
                      : 'text-neutral-500'
                  }`}
                >
                  {dev.activeSandboxes} {dev.activeSandboxes === 1 ? 'sandbox' : 'sandboxes'}
                </span>
              </div>

              {/* Total Runs */}
              <div className="col-span-2 flex items-center gap-1.5">
                <span className="text-[10px] text-neutral-500 md:hidden font-mono">Total Runs:</span>
                <span className="text-xs font-mono text-neutral-300">
                  {dev.totalRuns} runs
                </span>
              </div>

              {/* Status and Last Active */}
              <div className="col-span-2 flex md:flex-col md:items-end justify-between items-center gap-1">
                <span
                  className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold flex items-center gap-1.5 ${
                    dev.status === 'active'
                      ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {dev.status === 'active' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                  <span>{dev.status}</span>
                </span>
                <span className="text-[10px] text-neutral-500 font-mono">
                  Active {dev.lastActive}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
