import React from 'react';
import {
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Search,
  Package,
  Cpu,
  ShieldCheck,
} from 'lucide-react';
import { StepStatus, WorkflowStep, WorkflowStepId } from '../types/sandbox';

interface SetupWorkflowProps {
  steps: WorkflowStep[];
  activeStepId?: WorkflowStepId;
  onSelectStep?: (stepId: WorkflowStepId) => void;
}

const STEP_ICONS: Record<WorkflowStepId, React.ElementType> = {
  inspection: Search,
  dependencies: Package,
  configuration: Cpu,
  verification: ShieldCheck,
};

const ORDERED_STEP_IDS: WorkflowStepId[] = [
  'inspection',
  'dependencies',
  'configuration',
  'verification',
];

// Downward Directional Arrow Connector with SVG path
interface VerticalFlowConnectorProps {
  fromStatus: StepStatus;
  toStatus: StepStatus;
  isActive: boolean;
}

const VerticalFlowConnector: React.FC<VerticalFlowConnectorProps> = ({
  fromStatus,
  toStatus,
  isActive,
}) => {
  let strokeColor = '#27272a'; // neutral-800
  let fillColor = '#27272a';

  if (fromStatus === 'completed' && toStatus === 'completed') {
    strokeColor = '#10b981'; // emerald-500
    fillColor = '#10b981';
  } else if (fromStatus === 'completed' && toStatus === 'running') {
    strokeColor = '#10b981';
    fillColor = '#8b5cf6';
  } else if (toStatus === 'failed') {
    strokeColor = '#f43f5e'; // rose-500
    fillColor = '#f43f5e';
  } else if (isActive || toStatus === 'running') {
    strokeColor = '#8b5cf6'; // violet-500
    fillColor = '#8b5cf6';
  }

  return (
    <div
      className="h-10 w-full flex items-center justify-center my-1 select-none"
      aria-hidden="true"
    >
      <svg
        className="w-8 h-10 overflow-visible"
        viewBox="0 0 32 40"
        fill="none"
      >
        {/* Smooth downward curved connecting path */}
        <path
          d="M 16 0 C 16 10, 16 18, 16 28"
          stroke={strokeColor}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Downward-pointing arrowhead */}
        <polygon
          points="16,38 10.5,26 21.5,26"
          fill={fillColor}
        />
        {/* Active highlight pulse animation */}
        {isActive && (
          <path
            d="M 16 0 C 16 10, 16 18, 16 28"
            stroke="#c4b5fd"
            strokeWidth="3"
            strokeLinecap="round"
            className="flow-active-v"
          />
        )}
      </svg>
    </div>
  );
};

// Vertical Oval / Pill Stage Node
interface OvalStageNodeProps {
  step: WorkflowStep;
  index: number;
  isCurrent: boolean;
  onSelect?: () => void;
}

const OvalStageNode: React.FC<OvalStageNodeProps> = ({
  step,
  index,
  isCurrent,
  onSelect,
}) => {
  const StepIcon = STEP_ICONS[step.id] || Circle;
  const isVerification = step.id === 'verification';

  let statusBadge;
  let borderClass = 'border-neutral-800 bg-[#0c0e14]';
  let numberBadgeClass = 'bg-neutral-800 text-neutral-400';
  let iconClass = 'bg-neutral-800 text-neutral-400';

  if (step.status === 'completed') {
    borderClass = isVerification
      ? 'border-emerald-400/90 bg-gradient-to-r from-emerald-950/30 via-[#0c1914] to-emerald-950/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] ring-1 ring-emerald-500/40'
      : 'border-emerald-500/50 bg-[#0c1914] shadow-[0_0_15px_rgba(16,185,129,0.1)]';
    numberBadgeClass = 'bg-emerald-500/20 text-emerald-300 font-bold';
    iconClass = 'bg-emerald-500/20 text-emerald-400';
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium text-emerald-400 bg-emerald-950/60 border border-emerald-500/40">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
        <span>Passed</span>
        {step.durationMs !== undefined && (
          <span className="text-emerald-400/80 font-mono text-[10px]">
            ({(step.durationMs / 1000).toFixed(1)}s)
          </span>
        )}
      </span>
    );
  } else if (step.status === 'running') {
    borderClass = isVerification
      ? 'border-violet-400 bg-gradient-to-r from-violet-950/40 via-[#161226] to-violet-950/40 shadow-[0_0_25px_rgba(139,92,246,0.3)] ring-2 ring-violet-500/60'
      : 'border-violet-500/80 bg-[#161226] shadow-[0_0_20px_rgba(139,92,246,0.2)] ring-1 ring-violet-500/50';
    numberBadgeClass = 'bg-violet-500/30 text-violet-200 font-bold';
    iconClass = 'bg-violet-500/30 text-violet-300';
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium text-violet-300 bg-violet-950/70 border border-violet-500/50">
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0 text-violet-400" />
        <span>Running...</span>
      </span>
    );
  } else if (step.status === 'failed') {
    borderClass = 'border-rose-500/70 bg-[#1f1015] shadow-[0_0_18px_rgba(244,63,94,0.2)]';
    numberBadgeClass = 'bg-rose-500/20 text-rose-300 font-bold';
    iconClass = 'bg-rose-500/20 text-rose-400';
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-medium text-rose-400 bg-rose-950/60 border border-rose-500/40">
        <AlertCircle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
        <span>Failed</span>
      </span>
    );
  } else {
    borderClass = isVerification
      ? 'border-dashed border-neutral-700 bg-neutral-900/40 text-neutral-400'
      : 'border-neutral-800 bg-[#0c0e14] text-neutral-400';
    statusBadge = (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-neutral-400 bg-neutral-900 border border-neutral-800">
        <Circle className="w-3 h-3 text-neutral-600" />
        <span>Pending</span>
      </span>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Centered Oval / Pill-shaped Node */}
      <div
        onClick={onSelect}
        className={`w-full max-w-xl rounded-full border transition-all duration-200 px-4 py-2.5 sm:px-6 sm:py-3.5 flex items-center justify-between gap-3 shadow-sm select-none ${borderClass} ${
          onSelect ? 'cursor-pointer hover:border-neutral-600' : ''
        } ${isCurrent ? 'ring-2 ring-violet-500/70' : ''}`}
      >
        {/* Left: Number + Icon + Title */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0">
          <span
            className={`px-2 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${numberBadgeClass}`}
          >
            0{index + 1}
          </span>

          <div className={`p-1.5 rounded-full shrink-0 ${iconClass}`}>
            <StepIcon className="w-4 h-4" />
          </div>

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs sm:text-sm font-semibold text-neutral-100 truncate tracking-tight">
              {step.title}
            </span>
            {isVerification && (
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                Milestone
              </span>
            )}
          </div>
        </div>

        {/* Right: Status badge & Duration */}
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge}
        </div>
      </div>

      {/* Readable Compact Description directly below each oval node */}
      <p className="text-[11px] text-neutral-400 text-center mt-1.5 px-6 max-w-lg leading-relaxed line-clamp-2">
        {step.description}
      </p>

      {/* Error banner if step failed */}
      {step.error && (
        <div className="mt-1.5 text-[11px] font-mono text-rose-400 bg-rose-950/40 px-3 py-1 rounded-md border border-rose-900/60 max-w-lg text-center truncate">
          {step.error}
        </div>
      )}
    </div>
  );
};

export const SetupWorkflow: React.FC<SetupWorkflowProps> = ({
  steps,
  activeStepId,
  onSelectStep,
}) => {
  // Guarantee exact order: Repository Inspection -> Dependency Installation -> Environment Configuration -> Verification
  const orderedSteps = [...steps].sort((a, b) => {
    const indexA = ORDERED_STEP_IDS.indexOf(a.id);
    const indexB = ORDERED_STEP_IDS.indexOf(b.id);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const allCompleted = orderedSteps.length > 0 && orderedSteps.every((s) => s.status === 'completed');
  const hasFailed = orderedSteps.some((s) => s.status === 'failed');

  return (
    <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-5 sm:p-6 space-y-6">
      {/* Workflow Section Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-800/80">
        <div>
          <h2 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider">
            SETUP WORKFLOW PIPELINE
          </h2>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            4-phase deterministic container bootstrapping and health verification
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-neutral-400">
            Pipeline:
          </span>
          {allCompleted ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              All Passed
            </span>
          ) : hasFailed ? (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-rose-400 bg-rose-950/40 border border-rose-500/30 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-rose-400" />
              Failed
            </span>
          ) : (
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono text-violet-300 bg-violet-950/40 border border-violet-500/30 font-medium flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-violet-400" />
              Running
            </span>
          )}
        </div>
      </div>

      {/* Centered Vertical Workflow Diagram */}
      <div className="py-2 px-2 sm:px-4 flex flex-col items-center max-w-2xl mx-auto w-full">
        {orderedSteps.map((step, index) => {
          const isCurrent = activeStepId === step.id;
          const nextStep = orderedSteps[index + 1];
          const isNextRunning = nextStep ? nextStep.status === 'running' : false;

          return (
            <React.Fragment key={step.id}>
              <OvalStageNode
                step={step}
                index={index}
                isCurrent={isCurrent}
                onSelect={onSelectStep ? () => onSelectStep(step.id) : undefined}
              />

              {index < orderedSteps.length - 1 && (
                <VerticalFlowConnector
                  fromStatus={step.status}
                  toStatus={nextStep ? nextStep.status : 'pending'}
                  isActive={isNextRunning}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
