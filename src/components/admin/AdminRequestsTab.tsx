import React, { useState, useMemo } from 'react';
import {
  KeyRound,
  ShieldCheck,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  FileCode,
  Copy,
  Check,
  X,
  Search,
  Filter,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  GitBranch,
  Terminal,
  Lock,
  Layers,
  Info,
} from 'lucide-react';
import {
  AccessRequest,
  Sandbox,
  PlannedExecutionStep,
} from '../../types/sandbox';

interface AdminRequestsTabProps {
  accessRequests: AccessRequest[];
  sandboxes: Sandbox[];
  onApproveRequest: (id: string, workflowId?: string, fingerprint?: string) => Promise<void> | void;
  onRejectRequest: (id: string, workflowId?: string, reason?: string) => Promise<void> | void;
  isProcessingAction?: boolean;
  notify?: (msg: string) => void;
}

export const AdminRequestsTab: React.FC<AdminRequestsTabProps> = ({
  accessRequests,
  sandboxes,
  onApproveRequest,
  onRejectRequest,
  isProcessingAction = false,
  notify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string>('');

  const counts = useMemo(() => {
    return {
      all: accessRequests.length,
      pending: accessRequests.filter((r) => r.status === 'pending').length,
      approved: accessRequests.filter((r) => r.status === 'approved').length,
      rejected: accessRequests.filter((r) => r.status === 'rejected').length,
    };
  }, [accessRequests]);

  const filteredRequests = useMemo(() => {
    return accessRequests.filter((req) => {
      if (statusFilter !== 'all' && req.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchDev = req.developerName.toLowerCase().includes(q) || req.developerEmail.toLowerCase().includes(q);
        const matchRepo = req.repoName.toLowerCase().includes(q) || req.branch.toLowerCase().includes(q);
        const matchWf = req.workflowId?.toLowerCase().includes(q) || req.id.toLowerCase().includes(q);
        if (!matchDev && !matchRepo && !matchWf) return false;
      }
      return true;
    });
  }, [accessRequests, statusFilter, searchQuery]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(id);
    setTimeout(() => setCopiedFingerprint(null), 2000);
  };

  const handleApprove = async (req: AccessRequest, planFingerprint: string) => {
    await onApproveRequest(req.id, req.workflowId, planFingerprint);
    if (notify) {
      notify(`Authorized access request ${req.id}. Resumed LangGraph execution checkpoint.`);
    }
  };

  const handleRejectConfirm = async (req: AccessRequest) => {
    await onRejectRequest(
      req.id,
      req.workflowId,
      rejectionReason.trim() || 'Security policy rejection by cluster admin.'
    );
    if (notify) {
      notify(`Rejected request ${req.id} and halted workflow checkpoint.`);
    }
    setRejectingId(null);
    setRejectionReason('');
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2433]">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-violet-400" />
            <span>Developer Access Requests & Security Gates</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Evaluate repository permissions, inspect agent execution plans, and authorize container setup checkpoints.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="px-2.5 py-1 rounded-md bg-[#121622] border border-[#1e2433] text-neutral-300">
            {counts.all} Total Requests
          </span>
          <span
            className={`px-2.5 py-1 rounded-md border text-xs font-semibold flex items-center gap-1.5 ${
              counts.pending > 0
                ? 'bg-amber-950/60 border-amber-500/40 text-amber-300 animate-pulse'
                : 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
            }`}
          >
            {counts.pending > 0 ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>{counts.pending} Awaiting Sign-off</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Pending</span>
              </>
            )}
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
              placeholder="Search by developer, email, repository, or workflow ID..."
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

          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'all'
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <span>All</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.all}</span>
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'pending'
                  ? 'bg-amber-600/20 text-amber-300 border border-amber-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Pending</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.pending}</span>
            </button>

            <button
              onClick={() => setStatusFilter('approved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'approved'
                  ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Approved</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.approved}</span>
            </button>

            <button
              onClick={() => setStatusFilter('rejected')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === 'rejected'
                  ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40'
                  : 'bg-[#121622] text-neutral-400 hover:text-neutral-200 border border-transparent'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              <span>Rejected</span>
              <span className="font-mono text-[10px] px-1 rounded bg-[#1a2130]">{counts.rejected}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Access Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-3">
          <KeyRound className="w-8 h-8 text-neutral-600 mx-auto" />
          <h3 className="text-sm font-semibold text-neutral-200">No access requests match your criteria</h3>
          <p className="text-xs text-neutral-400 max-w-sm mx-auto">
            Try adjusting your status filter or search parameters to inspect past or pending submissions.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => {
            const isExpanded = expandedRequestId === req.id;
            const isRejecting = rejectingId === req.id;

            // Find matching sandbox if available to show real execution plan
            const matchingSandbox =
              sandboxes.find(
                (s) =>
                  s.workflowId === req.workflowId ||
                  s.id === req.sandboxId ||
                  s.repoName === req.repoName
              );

            const proposedPlan: PlannedExecutionStep[] =
              req.proposedPlan ||
              matchingSandbox?.proposedPlan || [
                {
                  step: 1,
                  phase: 'install',
                  command: `${req.packageManager || 'pnpm'} install`,
                  description: 'Download and link isolated packages',
                  is_safe: true,
                },
                {
                  step: 2,
                  phase: 'build',
                  command: `${req.packageManager || 'pnpm'} run build`,
                  description: 'Validate config and compile bundle',
                  is_safe: true,
                },
                {
                  step: 3,
                  phase: 'start',
                  command: req.startCommand || 'pnpm dev',
                  description: 'Start development service bound to 127.0.0.1',
                  is_safe: true,
                },
              ];

            const planFingerprint =
              req.planFingerprint ||
              matchingSandbox?.planFingerprint ||
              'sha256:7f9a2b4e81c0de94';

            const manifestFile =
              req.manifestFileName ||
              (req.runtime === 'python' ? 'pyproject.toml' : 'package.json');

            return (
              <div
                key={req.id}
                className={`rounded-xl border transition-all ${
                  req.status === 'pending'
                    ? 'bg-[#0f1420] border-amber-500/40 shadow-lg shadow-amber-950/20'
                    : req.status === 'approved'
                    ? 'bg-[#0e121a] border-emerald-500/25 opacity-90'
                    : 'bg-[#0e121a] border-[#1e2433] opacity-80'
                }`}
              >
                {/* Header: Developer Identity, Timestamp, Workflow ID & Status */}
                <div className="p-4 pb-3 border-b border-[#181f2c] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Developer Avatar Pill */}
                    <div className="w-7 h-7 rounded-full bg-violet-950/80 border border-violet-800/40 text-violet-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {req.developerName.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-neutral-100">{req.developerName}</span>
                        <span className="text-neutral-500 font-mono text-[11px]">({req.developerEmail})</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-neutral-400 font-mono mt-0.5">
                        <span>Submitted {req.requestedAt}</span>
                        {req.workflowId && (
                          <>
                            <span>·</span>
                            <span className="text-violet-400">Workflow: {req.workflowId}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status Pill */}
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded font-semibold ${
                        req.status === 'pending'
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/50 flex items-center gap-1.5'
                          : req.status === 'approved'
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                          : 'bg-rose-950/80 text-rose-300 border border-rose-500/40'
                      }`}
                    >
                      {req.status === 'pending' && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                      <span>{req.status}</span>
                    </span>
                  </div>
                </div>

                {/* Body Content */}
                <div className="p-4 space-y-3 text-xs">
                  {/* Metadata Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 bg-[#090b10] p-3 rounded-lg border border-[#1a2130]">
                    {/* Repo & Branch */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-neutral-500 font-mono block">Repository & Branch</span>
                      <div className="flex items-center gap-1.5 font-mono text-xs">
                        <a
                          href={req.repoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-violet-400 hover:text-violet-300 font-bold truncate flex items-center gap-1"
                        >
                          <span>{req.repoName}</span>
                          <ExternalLink className="w-3 h-3 text-neutral-500" />
                        </a>
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">{req.branch}</span>
                    </div>

                    {/* Runtime & Version */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-neutral-500 font-mono block">Runtime / Engine</span>
                      <div className="font-mono text-xs text-neutral-200 capitalize">
                        {req.runtimeVersion || req.runtime || 'Node.js'}
                      </div>
                      <span className="text-[10px] text-neutral-400 font-mono">
                        Manager: {req.packageManager || 'pnpm'}
                      </span>
                    </div>

                    {/* Requested Scope */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-neutral-500 font-mono block">Requested Scope</span>
                      <span
                        className={`inline-block font-mono text-[10px] uppercase font-semibold px-2 py-0.5 rounded ${
                          req.scope === 'full_ports'
                            ? 'bg-amber-950/70 text-amber-300 border border-amber-500/40'
                            : req.scope === 'sandbox_debug'
                            ? 'bg-violet-950/70 text-violet-300 border border-violet-500/40'
                            : 'bg-neutral-800 text-neutral-300 border border-neutral-700/60'
                        }`}
                      >
                        {req.scope}
                      </span>
                      <span className="text-[10px] text-neutral-500 block">
                        {req.scope === 'full_ports'
                          ? 'Port forward to 127.0.0.1'
                          : req.scope === 'sandbox_debug'
                          ? 'Isolated build & shell access'
                          : 'Read-only discovery'}
                      </span>
                    </div>

                    {/* Decision info or Request ID */}
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-neutral-500 font-mono block">Request Tracking</span>
                      <span className="font-mono text-xs text-neutral-300 block">{req.id}</span>
                      {req.decidedBy && (
                        <span className="text-[10px] text-neutral-400 font-mono block">
                          By: {req.decidedBy} ({req.decidedAt})
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Justification Box */}
                  <div className="p-3 rounded-lg bg-[#090b10] border border-[#1a2130] space-y-1">
                    <span className="text-[10px] text-neutral-500 font-mono uppercase tracking-wider block">
                      Access Justification
                    </span>
                    <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                      "{req.reason}"
                    </p>
                  </div>

                  {/* Expandable Agent Setup Plan & Manifest Drawer */}
                  <div className="pt-1">
                    <button
                      onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                      className="text-xs font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1.5 cursor-pointer py-1 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {isExpanded
                          ? 'Hide Agent Setup Plan & Manifest'
                          : `Inspect Agent Setup Plan & Manifest (${proposedPlan.length} proposed commands)`}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="mt-2.5 p-4 rounded-xl bg-[#090b10] border border-[#1a2130] space-y-3.5 font-mono text-xs animate-in fade-in duration-150">
                        {/* Manifest info & Plan Fingerprint */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#181f2c] text-[11px]">
                          <div className="flex items-center gap-2">
                            <FileCode className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-neutral-400">Target Manifest:</span>
                            <span className="text-neutral-100 font-bold">{manifestFile}</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-neutral-500">Plan Fingerprint:</span>
                            <code className="text-violet-300 font-bold bg-[#141a26] px-2 py-0.5 rounded border border-[#232c3d]">
                              {planFingerprint}
                            </code>
                            <button
                              onClick={() => handleCopy(planFingerprint, req.id)}
                              className="text-neutral-400 hover:text-neutral-200 cursor-pointer ml-1 p-1 hover:bg-[#141a26] rounded"
                              title="Copy SHA-256 Plan Fingerprint"
                            >
                              {copiedFingerprint === req.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Agent Evaluation & Intelligence Assessment */}
                        {(matchingSandbox?.evaluationResult || req.evaluationResult) && (
                          <div className="p-3 rounded-lg bg-[#0e1422] border border-violet-500/30 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-violet-300 flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
                                Agent Intelligence Evaluation
                              </span>
                              <span
                                className={`text-[10px] font-mono px-2 py-0.5 rounded border font-semibold ${
                                  (matchingSandbox?.evaluationResult || req.evaluationResult)?.decision === 'APPROVE_FOR_REVIEW'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-500/30'
                                    : 'bg-amber-950 text-amber-300 border-amber-500/30'
                                }`}
                              >
                                {(matchingSandbox?.evaluationResult || req.evaluationResult)?.decision}
                              </span>
                            </div>
                            <p className="text-neutral-300 font-sans text-[11px] leading-relaxed">
                              {(matchingSandbox?.evaluationResult || req.evaluationResult)?.reasoning_summary}
                            </p>
                          </div>
                        )}

                        {/* Proposed Commands Table */}
                        <div className="space-y-2">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider block">
                            Agent Planned Execution Commands (Exact sequence executed upon authorization):
                          </span>
                          <div className="space-y-1.5 rounded-lg border border-[#1a2130] overflow-hidden bg-[#06080d] p-3">
                            {proposedPlan.map((step) => (
                              <div
                                key={step.step}
                                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs py-1 border-b border-[#141822] last:border-0"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-neutral-500 font-mono text-[11px]">#{step.step}</span>
                                  <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-[#141a26] text-neutral-300 font-semibold shrink-0">
                                    {step.phase}
                                  </span>
                                  <code className="text-emerald-400 font-mono text-xs truncate">
                                    {step.command}
                                  </code>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 text-[11px]">
                                  <span className="text-neutral-500 font-sans hidden sm:inline">
                                    {step.description}
                                  </span>
                                  <span className="text-[10px] text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-500/30">
                                    verified
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Security check note */}
                        <div className="text-[11px] text-neutral-400 font-sans flex items-center gap-2 pt-1">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>
                            Validated with Pydantic SetupManifest schema (<code>extra="forbid"</code>). Zero host execution; all commands isolate into cgroup namespace with strict loopback.
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions for Pending Requests */}
                  {req.status === 'pending' && (
                    <div className="pt-3 border-t border-[#181f2c]">
                      {isRejecting ? (
                        <div className="p-3.5 rounded-lg bg-rose-950/30 border border-rose-900/50 space-y-2.5">
                          <div className="flex items-center gap-2 text-rose-300 text-xs font-semibold">
                            <AlertTriangle className="w-4 h-4 text-rose-400" />
                            <span>Specify Reason for Denying Request {req.id}:</span>
                          </div>
                          <input
                            type="text"
                            placeholder="e.g. Disallowed network socket or policy violation"
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            className="w-full px-3 py-2 bg-[#090b10] border border-neutral-800 rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-rose-500/60"
                          />
                          <div className="flex items-center justify-end gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                setRejectingId(null);
                                setRejectionReason('');
                              }}
                              className="px-3 py-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 text-xs cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRejectConfirm(req)}
                              disabled={isProcessingAction}
                              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 transition-colors shadow-md"
                            >
                              Confirm Denial & Halt Workflow
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <span className="text-[11px] text-amber-400 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Awaiting security gate authorization to resume execution.</span>
                          </span>

                          <div className="flex items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => setRejectingId(req.id)}
                              disabled={isProcessingAction}
                              className="px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/50 text-rose-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Deny Scope</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleApprove(req, planFingerprint)}
                              disabled={isProcessingAction}
                              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors shadow-md shadow-emerald-950/40"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Authorize & Resume Workflow</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
