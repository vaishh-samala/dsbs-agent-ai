import React, { useState, useMemo } from 'react';
import {
  ScrollText,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  Clock,
  ShieldCheck,
  User,
  Copy,
  Check,
  X,
  Layers,
} from 'lucide-react';
import { AuditActivityEvent } from '../../types/sandbox';

interface AdminAuditTabProps {
  auditLogs: AuditActivityEvent[];
}

export const AdminAuditTab: React.FC<AdminAuditTabProps> = ({ auditLogs }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | 'success' | 'warning' | 'error' | 'info'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      all: auditLogs.length,
      success: auditLogs.filter((l) => l.status === 'success').length,
      warning: auditLogs.filter((l) => l.status === 'warning').length,
      error: auditLogs.filter((l) => l.status === 'error').length,
      info: auditLogs.filter((l) => l.status === 'info').length,
    };
  }, [auditLogs]);

  const filteredLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (severityFilter !== 'all' && log.status !== severityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchActor = log.actor.toLowerCase().includes(q);
        const matchAction = log.action.toLowerCase().includes(q);
        const matchTarget = log.target.toLowerCase().includes(q);
        const matchDetails = log.details.toLowerCase().includes(q);
        if (!matchActor && !matchAction && !matchTarget && !matchDetails) return false;
      }
      return true;
    });
  }, [auditLogs, severityFilter, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2433]">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <ScrollText className="w-4 h-4 text-violet-400" />
            <span>Cluster Security & Approval Audit Ledger</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Immutable chronological timeline of human approval gates, policy decisions, and container operations.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-[#121622] border border-[#1e2433] text-neutral-300">
            {auditLogs.length} Events Logged
          </span>
          <span className="px-2.5 py-1 rounded-md bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Audit Integrity Active</span>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="Search audit trail by actor, action, target, or fingerprint..."
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

          {/* Severity Pills */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={() => setSeverityFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                severityFilter === 'all'
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <span>All</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.all}</span>
            </button>

            <button
              onClick={() => setSeverityFilter('success')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                severityFilter === 'success'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Success</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.success}</span>
            </button>

            <button
              onClick={() => setSeverityFilter('warning')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                severityFilter === 'warning'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span>Warning</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.warning}</span>
            </button>

            <button
              onClick={() => setSeverityFilter('info')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                severityFilter === 'info'
                  ? 'bg-sky-600/20 text-sky-300 border border-sky-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <Info className="w-3.5 h-3.5 text-sky-400" />
              <span>Info</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.info}</span>
            </button>

            {counts.error > 0 && (
              <button
                onClick={() => setSeverityFilter('error')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                  severityFilter === 'error'
                    ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40'
                    : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
                }`}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                <span>Error</span>
                <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.error}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Timeline */}
      {filteredLogs.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
          <ScrollText className="w-8 h-8 text-neutral-600 mx-auto" />
          <h3 className="text-sm font-semibold text-neutral-200">No audit events match your search</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Try adjusting your search query or severity filter to view past cluster activities.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-[#1e2433]">
          {filteredLogs.map((log) => {
            const isSuccess = log.status === 'success';
            const isWarning = log.status === 'warning';
            const isError = log.status === 'error';
            const isInfo = log.status === 'info';

            return (
              <div key={log.id} className="relative group">
                {/* Node icon along the timeline */}
                <div
                  className={`absolute -left-6 top-3 w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                    isSuccess
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-400'
                      : isWarning
                      ? 'bg-amber-950 border-amber-500 text-amber-400'
                      : isError
                      ? 'bg-rose-950 border-rose-500 text-rose-400'
                      : 'bg-violet-950 border-violet-500 text-violet-400'
                  }`}
                >
                  {isSuccess ? (
                    <CheckCircle2 className="w-3 h-3" />
                  ) : isWarning ? (
                    <AlertTriangle className="w-3 h-3" />
                  ) : isError ? (
                    <AlertCircle className="w-3 h-3" />
                  ) : (
                    <Info className="w-3 h-3" />
                  )}
                </div>

                {/* Event Card */}
                <div className="p-4 rounded-xl bg-[#0e121a] border border-[#1e2433] hover:border-[#2b354a] transition-all space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#181f2c]">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono text-neutral-400 text-[11px] bg-[#090b10] px-2 py-0.5 rounded border border-[#1a2130]">
                        {log.timestamp}
                      </span>
                      <span className="font-bold text-neutral-100 font-mono">
                        {log.action}
                      </span>
                      <span className="text-neutral-600">·</span>
                      <span className="text-[11px] text-neutral-400 flex items-center gap-1 font-mono">
                        <User className="w-3 h-3 text-neutral-500" />
                        <span className="text-violet-300">{log.actor}</span>
                      </span>
                    </div>

                    <span
                      className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold self-start sm:self-auto ${
                        isSuccess
                          ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-500/40'
                          : isWarning
                          ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                          : isError
                          ? 'bg-rose-950/70 text-rose-300 border border-rose-500/40'
                          : 'bg-sky-950/70 text-sky-300 border border-sky-500/40'
                      }`}
                    >
                      {log.status}
                    </span>
                  </div>

                  {/* Target & Details */}
                  <div className="text-xs space-y-1.5">
                    <div className="text-[11px] text-neutral-400 font-mono flex items-center gap-1.5">
                      <span className="text-neutral-500">Target:</span>
                      <span className="text-neutral-200 bg-[#090b10] px-1.5 py-0.5 rounded border border-[#1a2130]">
                        {log.target}
                      </span>
                    </div>

                    <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                      {log.details}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
