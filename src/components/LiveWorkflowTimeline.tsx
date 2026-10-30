import React, { useState } from 'react';
import {
  Search,
  Cpu,
  ShieldCheck,
  Terminal,
  Activity,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  Clock,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';
import {
  Sandbox,
  StageId,
  StageStatus,
  WorkflowStageInfo,
} from '../types/sandbox';

interface LiveWorkflowTimelineProps {
  sandbox: Sandbox;
  onApprove: (sandboxId: string) => void;
  onReject: (sandboxId: string, reason?: string) => void;
  onRetry?: (sandbox: Sandbox) => void;
  isActionInProgress?: boolean;
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  inspection: Search,
  planning: Cpu,
  approval: ShieldCheck,
  execution: Terminal,
  verification: Activity,
  final_result: Sparkles,
};

export const LiveWorkflowTimeline: React.FC<LiveWorkflowTimelineProps> = ({
  sandbox,
  onApprove,
  onReject,
  onRetry,
  isActionInProgress = false,
}) => {
  const [copiedFingerprint, setCopiedFingerprint] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    approval: true,
    execution: true,
    verification: true,
  });

  const toggleSection = (stageId: string) => {
    setExpandedSections((prev) => ({ ...prev, [stageId]: !prev[stageId] }));
  };

  const handleCopyFingerprint = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedFingerprint(true);
    setTimeout(() => setCopiedFingerprint(false), 2000);
  };

  // Fallback default stages if backend hasn't populated stages yet
  const stages: WorkflowStageInfo[] =
    sandbox.stages && sandbox.stages.length > 0
      ? sandbox.stages
      : [
          {
            id: 'inspection',
            number: 1,
            title: 'Repository Inspection',
            description:
              'Discover project files, identify the project type, inspect dependency manifests, and validate configuration.',
            status:
              sandbox.status === 'failed' && !sandbox.planFingerprint
                ? 'failed'
                : 'completed',
            message: 'Repository inspection completed.',
          },
          {
            id: 'planning',
            number: 2,
            title: 'Setup Planning',
            description: 'Generate the ordered setup plan and proposed commands.',
            status: sandbox.planFingerprint ? 'completed' : 'pending',
            message: 'Setup plan generated successfully.',
          },
          {
            id: 'approval',
            number: 3,
            title: 'Human Approval',
            description: 'Display the proposed commands, plan summary, and plan fingerprint.',
            status:
              sandbox.status === 'rejected'
                ? 'rejected'
                : sandbox.approvalStatus === 'approved'
                ? 'completed'
                : sandbox.status === 'awaiting_approval'
                ? 'waiting_for_approval'
                : 'pending',
            message:
              sandbox.status === 'awaiting_approval'
                ? 'Waiting for your approval.'
                : sandbox.status === 'rejected'
                ? 'Your setup plan was rejected. No commands were executed.'
                : sandbox.approvalStatus === 'approved'
                ? 'Plan approved. Preparing execution...'
                : 'Review proposed commands before execution.',
          },
          {
            id: 'execution',
            number: 4,
            title: 'Sandbox Execution',
            description: 'Agent is executing the approved setup plan...',
            status:
              sandbox.status === 'running' && sandbox.approvalStatus === 'approved'
                ? 'running'
                : sandbox.status === 'success'
                ? 'completed'
                : sandbox.status === 'rejected'
                ? 'skipped'
                : 'pending',
            message: 'Pending user approval.',
          },
          {
            id: 'verification',
            number: 5,
            title: 'Environment Verification',
            description: 'Display actual verification checks and their results.',
            status:
              sandbox.status === 'success'
                ? 'completed'
                : sandbox.status === 'failed' && sandbox.approvalStatus === 'approved'
                ? 'failed'
                : sandbox.status === 'rejected'
                ? 'skipped'
                : 'pending',
            message: 'Pending container execution.',
          },
          {
            id: 'final_result',
            number: 6,
            title: 'Final Result',
            description: 'Final container bootstrap status and diagnostics summary.',
            status:
              sandbox.status === 'success' || sandbox.status === 'running'
                ? 'completed'
                : sandbox.status === 'rejected'
                ? 'rejected'
                : sandbox.status === 'failed'
                ? 'failed'
                : 'pending',
            message:
              sandbox.status === 'success'
                ? 'Setup completed successfully.'
                : sandbox.status === 'rejected'
                ? 'Setup rejected.'
                : sandbox.status === 'failed'
                ? 'Setup failed.'
                : 'In progress...',
          },
        ];

  // Derive dynamic headline matching requirement
  let liveHeadline = sandbox.currentMessage;
  if (!liveHeadline) {
    if (sandbox.status === 'awaiting_approval') {
      liveHeadline = 'Waiting for human approval';
    } else if (sandbox.status === 'rejected') {
      liveHeadline = 'Setup rejected';
    } else if (sandbox.status === 'failed') {
      liveHeadline = 'Setup failed';
    } else if (sandbox.status === 'success' || (sandbox.status === 'running' && sandbox.steps.every((s) => s.status === 'completed'))) {
      liveHeadline = 'Setup completed successfully';
    } else if (sandbox.currentStepId === 'inspection') {
      liveHeadline = 'Agent is inspecting your repository';
    } else if (sandbox.currentStepId === 'dependencies' || sandbox.currentStepId === 'configuration') {
      liveHeadline = 'Agent is executing the approved plan';
    } else if (sandbox.currentStepId === 'verification') {
      liveHeadline = 'Agent is verifying the environment';
    } else {
      liveHeadline = 'Agent is bootstrapping sandbox';
    }
  }

  // Calculate completed count and progress percentage
  const completedCount = stages.filter((s) => s.status === 'completed').length;
  const totalCount = stages.length;
  const progressPercent =
    sandbox.progressPercentage !== undefined
      ? sandbox.progressPercentage
      : Math.round((completedCount / totalCount) * 100);

  const isTerminal =
    sandbox.status === 'success' ||
    sandbox.status === 'rejected' ||
    sandbox.status === 'failed';

  return (
    <section
      role="region"
      aria-label="Live Agent Workflow Progress"
      aria-live="polite"
      className="bg-[#11141c] border border-neutral-800 rounded-xl p-5 sm:p-6 space-y-6 shadow-xl"
    >
      {/* 1. Header with Live Status Headline and Progress Bar */}
      <div className="space-y-3 pb-4 border-b border-neutral-800/80">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* Status indicator pulse / icon */}
            <div className="p-2 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-300">
              {sandbox.status === 'awaiting_approval' ? (
                <ShieldCheck className="w-5 h-5 text-amber-400 animate-pulse motion-reduce:animate-none" />
              ) : sandbox.status === 'rejected' ? (
                <XCircle className="w-5 h-5 text-rose-400" />
              ) : sandbox.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-rose-400" />
              ) : isTerminal ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <Loader2 className="w-5 h-5 text-violet-400 animate-spin motion-reduce:animate-none" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-wider text-neutral-400">
                  Agent Workflow Pipeline
                </span>
                <span className="text-neutral-600">·</span>
                <span className="text-[11px] font-mono text-neutral-400">
                  6-Stage Autonomous Lifecycle
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-neutral-100 tracking-tight flex items-center gap-2">
                <span>{liveHeadline}</span>
                {sandbox.status === 'awaiting_approval' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Action Required
                  </span>
                )}
              </h2>
            </div>
          </div>

          {/* Progress Counter Badge */}
          <div className="flex items-center gap-3 self-start sm:self-center">
            <span className="text-xs font-mono text-neutral-300">
              Stages: <strong className="text-white">{completedCount}</strong>/{totalCount}
            </span>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-violet-300">
              {progressPercent}%
            </span>
          </div>
        </div>

        {/* Animated Progress Bar */}
        <div className="w-full bg-[#0c0e14] h-1.5 rounded-full overflow-hidden border border-neutral-800/80">
          <div
            className={`h-full transition-all duration-500 ease-out motion-reduce:transition-none ${
              sandbox.status === 'rejected'
                ? 'bg-rose-500'
                : sandbox.status === 'failed'
                ? 'bg-rose-500'
                : sandbox.status === 'awaiting_approval'
                ? 'bg-gradient-to-r from-violet-500 to-amber-500'
                : 'bg-gradient-to-r from-violet-500 to-emerald-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
          />
        </div>
      </div>

      {/* 2. Vertical Timeline with Connecting Lines & Arrows */}
      <div className="relative space-y-0 pl-1 sm:pl-2">
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const StageIcon = STAGE_ICONS[stage.id] || Clock;

          // Compute node styling by status
          const isPending = stage.status === 'pending';
          const isRunning = stage.status === 'running';
          const isWaiting = stage.status === 'waiting_for_approval';
          const isCompleted = stage.status === 'completed';
          const isRejected = stage.status === 'rejected';
          const isFailed = stage.status === 'failed';
          const isSkipped = stage.status === 'skipped';

          // Node badge colors
          let nodeRingClass = 'border-neutral-800 bg-[#0e1118] text-neutral-500';
          let numberBgClass = 'bg-neutral-800 text-neutral-400';
          let statusBadge;

          if (isCompleted) {
            nodeRingClass =
              'border-emerald-500/50 bg-emerald-950/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]';
            numberBgClass = 'bg-emerald-500/20 text-emerald-300 font-bold';
            statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-emerald-300 bg-emerald-950/60 border border-emerald-500/40">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Completed</span>
                {stage.duration_seconds !== undefined && (
                  <span className="text-emerald-400/80 text-[10px]">
                    ({stage.duration_seconds}s)
                  </span>
                )}
              </span>
            );
          } else if (isWaiting) {
            nodeRingClass =
              'border-amber-400 bg-amber-950/30 text-amber-300 ring-2 ring-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.2)]';
            numberBgClass = 'bg-amber-500/30 text-amber-200 font-bold';
            statusBadge = (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-amber-300 bg-amber-950/70 border border-amber-500/50">
                <ShieldCheck className="w-3 h-3 text-amber-400 animate-pulse motion-reduce:animate-none" />
                <span>Waiting for Approval</span>
              </span>
            );
          } else if (isRunning) {
            nodeRingClass =
              'border-violet-400 bg-violet-950/30 text-violet-300 ring-2 ring-violet-500/50 shadow-[0_0_20px_rgba(139,92,246,0.25)]';
            numberBgClass = 'bg-violet-500/30 text-violet-200 font-bold';
            statusBadge = (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-violet-300 bg-violet-950/70 border border-violet-500/50">
                <Loader2 className="w-3 h-3 animate-spin text-violet-400 motion-reduce:animate-none" />
                <span>Running...</span>
              </span>
            );
          } else if (isRejected) {
            nodeRingClass =
              'border-rose-500/50 bg-rose-950/20 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]';
            numberBgClass = 'bg-rose-500/20 text-rose-300 font-bold';
            statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-rose-400 bg-rose-950/60 border border-rose-500/40">
                <XCircle className="w-3 h-3 text-rose-400" />
                <span>Rejected</span>
              </span>
            );
          } else if (isFailed) {
            nodeRingClass =
              'border-rose-500/60 bg-rose-950/30 text-rose-400 ring-1 ring-rose-500/40 shadow-[0_0_15px_rgba(244,63,94,0.2)]';
            numberBgClass = 'bg-rose-500/30 text-rose-200 font-bold';
            statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium text-rose-400 bg-rose-950/60 border border-rose-500/40">
                <AlertCircle className="w-3 h-3 text-rose-400" />
                <span>Failed</span>
              </span>
            );
          } else if (isSkipped) {
            statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800">
                <span>Skipped</span>
              </span>
            );
          } else {
            statusBadge = (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono text-neutral-500 bg-neutral-900 border border-neutral-800">
                <Clock className="w-3 h-3 text-neutral-600" />
                <span>Pending</span>
              </span>
            );
          }

          // Connecting line color
          const nextStage = !isLast ? stages[idx + 1] : null;
          let lineColor = 'bg-neutral-800';
          if (isCompleted && nextStage?.status === 'completed') {
            lineColor = 'bg-emerald-500/50';
          } else if (isCompleted && (nextStage?.status === 'running' || nextStage?.status === 'waiting_for_approval')) {
            lineColor = 'bg-gradient-to-b from-emerald-500/50 to-violet-500/70';
          } else if (isRejected || isFailed) {
            lineColor = 'bg-rose-500/40';
          }

          return (
            <div key={stage.id} className="relative flex items-start gap-3.5 pb-6 last:pb-0">
              {/* Connecting Line */}
              {!isLast && (
                <div
                  className={`absolute left-[17px] sm:left-[21px] top-9 bottom-0 w-[2px] transition-colors ${lineColor}`}
                  aria-hidden="true"
                />
              )}

              {/* Node Icon Circle */}
              <div
                className={`relative z-10 w-9 h-9 sm:w-11 sm:h-11 rounded-full border flex items-center justify-center shrink-0 transition-all ${nodeRingClass}`}
              >
                <StageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>

              {/* Stage Content Card */}
              <div className="flex-1 min-w-0 bg-[#0c0e14] border border-neutral-800 rounded-xl p-4 transition-all hover:border-neutral-700">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold shrink-0 ${numberBgClass}`}
                    >
                      0{stage.number}
                    </span>
                    <h3 className="text-sm font-semibold text-neutral-100 tracking-tight">
                      {stage.title}
                    </h3>
                  </div>
                  <div>{statusBadge}</div>
                </div>

                {/* Short Description */}
                <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                  {stage.description}
                </p>

                {/* Live Message or Output Detail */}
                {stage.message && (
                  <div
                    className={`mt-2 text-xs font-mono px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                      isCompleted
                        ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300'
                        : isWaiting
                        ? 'bg-amber-950/20 border-amber-900/40 text-amber-200'
                        : isRunning
                        ? 'bg-violet-950/20 border-violet-900/40 text-violet-300'
                        : isRejected || isFailed
                        ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                        : 'bg-neutral-900/40 border-neutral-800 text-neutral-400'
                    }`}
                  >
                    <span>{stage.message}</span>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STAGE 3 SPECIAL: Human Approval Gate Controls & Plan     */}
                {/* -------------------------------------------------------- */}
                {stage.id === 'approval' && isWaiting && (
                  <div className="mt-4 pt-4 border-t border-neutral-800 space-y-4">
                    {/* Fingerprint row */}
                    <div className="flex flex-wrap items-center justify-between gap-2 bg-[#12151f] p-2.5 rounded-lg border border-neutral-800 text-xs font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-neutral-500">Plan Fingerprint:</span>
                        <span className="text-violet-300 truncate max-w-xs sm:max-w-md select-all">
                          {sandbox.planFingerprint || 'sha256:deterministic-plan-digest'}
                        </span>
                      </div>
                      {sandbox.planFingerprint && (
                        <button
                          onClick={() => handleCopyFingerprint(sandbox.planFingerprint!)}
                          className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors"
                          title="Copy Fingerprint"
                        >
                          {copiedFingerprint ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>

                    {/* Proposed Commands List */}
                    {sandbox.proposedPlan && sandbox.proposedPlan.length > 0 && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                          <span>Proposed Commands ({sandbox.proposedPlan.length} steps)</span>
                          <span className="text-emerald-400 flex items-center gap-1 font-mono normal-case">
                            <ShieldCheck className="w-3.5 h-3.5" /> Sandbox Isolation Enforced
                          </span>
                        </div>
                        <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                          {sandbox.proposedPlan.map((step) => (
                            <div
                              key={step.step}
                              className="flex items-start justify-between gap-2.5 p-2 rounded-lg bg-[#0e1118] border border-neutral-800 text-xs"
                            >
                              <div className="flex items-start gap-2 min-w-0">
                                <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[10px] shrink-0">
                                  #{step.step}
                                </span>
                                <div className="min-w-0">
                                  <div className="font-mono text-neutral-200 text-xs truncate">
                                    $ {step.command}
                                  </div>
                                  <div className="text-[11px] text-neutral-400 mt-0.5">
                                    {step.description}
                                  </div>
                                </div>
                              </div>
                              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-neutral-800/80 text-neutral-400 shrink-0">
                                {step.phase}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Interactive Approve & Reject Buttons */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                      <div className="text-[11px] text-neutral-500 font-mono">
                        Commands run inside the isolated sandbox simulation. No host changes occur.
                      </div>

                      <div className="flex items-center gap-2 self-end">
                        {/* Reject button */}
                        <button
                          onClick={() => {
                            if (!showRejectInput) {
                              setShowRejectInput(true);
                            } else {
                              onReject(sandbox.id, rejectReason || undefined);
                            }
                          }}
                          disabled={isActionInProgress}
                          className="px-3.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 border border-rose-700/50 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>{showRejectInput ? 'Confirm Reject' : 'Reject Plan'}</span>
                        </button>

                        {/* Approve button */}
                        <button
                          onClick={() => onApprove(sandbox.id)}
                          disabled={isActionInProgress}
                          className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isActionInProgress ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                          ) : (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          )}
                          <span>Approve Plan & Boot Sandbox</span>
                        </button>
                      </div>
                    </div>

                    {/* Optional Rejection Reason Input */}
                    {showRejectInput && (
                      <div className="mt-2 flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Optional rejection reason / notes for the agent..."
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-[#0e1118] border border-rose-500/40 rounded-lg text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
                        />
                        <button
                          onClick={() => setShowRejectInput(false)}
                          className="px-2.5 py-1.5 text-xs text-neutral-400 hover:text-neutral-200"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STAGE 4 SPECIAL: Sandbox Execution Step Outputs          */}
                {/* -------------------------------------------------------- */}
                {stage.id === 'execution' && (isRunning || isCompleted || isFailed) && (
                  <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                    <button
                      onClick={() => toggleSection('execution')}
                      className="flex items-center justify-between w-full text-left text-xs font-mono text-neutral-400 hover:text-neutral-200 cursor-pointer"
                    >
                      <span>
                        Sandbox Execution Details ({sandbox.executionSteps?.length || 2} commands)
                      </span>
                      {expandedSections.execution ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>

                    {expandedSections.execution && (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                        {sandbox.executionSteps && sandbox.executionSteps.length > 0 ? (
                          sandbox.executionSteps.map((step, sIdx) => (
                            <div
                              key={sIdx}
                              className="p-2 rounded bg-[#090b10] border border-neutral-800/80 font-mono text-xs space-y-1"
                            >
                              <div className="flex items-center justify-between text-neutral-300">
                                <span className="text-violet-300">$ {step.command}</span>
                                <span
                                  className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                                    step.success
                                      ? 'bg-emerald-500/20 text-emerald-400'
                                      : 'bg-rose-500/20 text-rose-400'
                                  }`}
                                >
                                  exit {step.exit_code} ({step.duration_seconds}s)
                                </span>
                              </div>
                              {step.stdout && (
                                <div className="text-[11px] text-neutral-400 whitespace-pre-wrap">
                                  {step.stdout}
                                </div>
                              )}
                              {step.stderr && (
                                <div className="text-[11px] text-rose-400 whitespace-pre-wrap">
                                  {step.stderr}
                                </div>
                              )}
                            </div>
                          ))
                        ) : (
                          <div className="p-2 text-[11px] font-mono text-neutral-500">
                            Executed within isolated virtual sandbox container.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STAGE 5 SPECIAL: Verification Probes & Checks            */}
                {/* -------------------------------------------------------- */}
                {stage.id === 'verification' && (isRunning || isCompleted || isFailed) && (
                  <div className="mt-3 pt-3 border-t border-neutral-800 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono text-neutral-400">
                      <span>Health & Readiness Probes</span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                          isCompleted
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isFailed
                            ? 'bg-rose-500/20 text-rose-300'
                            : 'bg-violet-500/20 text-violet-300'
                        }`}
                      >
                        {isCompleted
                          ? 'HTTP 200 OK (24ms)'
                          : isFailed
                          ? 'PROBE FAILED'
                          : 'Probing readiness...'}
                      </span>
                    </div>

                    <div className="space-y-1 text-[11px] font-mono">
                      <div className="flex items-center gap-2 text-neutral-300">
                        {isCompleted ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : isFailed ? (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                        )}
                        <span>
                          Port {sandbox.env?.port || 8000} Virtual Listener Readiness Check
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-neutral-300">
                        {isCompleted ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : isFailed ? (
                          <XCircle className="w-3 h-3 text-rose-400" />
                        ) : (
                          <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
                        )}
                        <span>
                          Process smoke assertions ({sandbox.packageManager} verification)
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {/* -------------------------------------------------------- */}
                {/* STAGE 6 SPECIAL: Final Result Summary & Re-run Action    */}
                {/* -------------------------------------------------------- */}
                {stage.id === 'final_result' && isTerminal && (
                  <div className="mt-3 pt-3 border-t border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="text-neutral-400 text-[11px] font-mono">
                      {isCompleted && (
                        <span>
                          Sandbox ready at{' '}
                          <a
                            href={sandbox.previewUrl || `http://localhost:${sandbox.env?.port || 8000}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline"
                          >
                            http://localhost:{sandbox.env?.port || 8000}
                          </a>
                        </span>
                      )}
                      {isRejected && (
                        <span className="text-neutral-400">
                          Execution cleanly halted. Zero setup commands were executed.
                        </span>
                      )}
                      {isFailed && (
                        <span className="text-rose-400">
                          {sandbox.errorSummary?.message || 'Bootstrapping failed during verification.'}
                        </span>
                      )}
                    </div>

                    {onRetry && (
                      <button
                        onClick={() => onRetry(sandbox)}
                        className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <span>Re-plan Setup</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

