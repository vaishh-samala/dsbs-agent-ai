export type RuntimeType = 'node' | 'python';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'poetry' | 'uv';

export type SandboxStatus = 'queued' | 'running' | 'awaiting_approval' | 'needs_clarification' | 'rejected' | 'success' | 'failed' | 'stopped';

export type ApprovalStatus = 'awaiting_approval' | 'approved' | 'rejected' | 'needs_clarification';

export type AgentDecision = 'APPROVE_FOR_REVIEW' | 'REJECT' | 'NEEDS_CLARIFICATION';

export interface EvaluationResult {
  decision: AgentDecision;
  request_summary: string;
  repository_findings: string[];
  compatibility_issues: string[];
  security_findings: string[];
  validation_errors: string[];
  warnings: string[];
  proposed_manifest?: Record<string, any> | null;
  proposed_commands: string[];
  permission_justification?: string | null;
  verification_plan: string[];
  reasoning_summary: string;
  clarification_questions: string[];
}

export type StageId =
  | 'inspection'
  | 'planning'
  | 'approval'
  | 'execution'
  | 'verification'
  | 'final_result';

export type StageStatus =
  | 'pending'
  | 'running'
  | 'waiting_for_approval'
  | 'completed'
  | 'rejected'
  | 'failed'
  | 'skipped';

export interface WorkflowStageInfo {
  id: string;
  number: number;
  title: string;
  description: string;
  status: StageStatus;
  message?: string;
  started_at?: string;
  completed_at?: string;
  duration_seconds?: number;
  error_message?: string;
  details?: Record<string, unknown>;
}

export interface PlannedExecutionStep {
  step: number;
  phase: string;
  command: string;
  description: string;
  is_safe: boolean;
}

export type WorkflowStepId = 'inspection' | 'dependencies' | 'configuration' | 'verification';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped';

export interface WorkflowStep {
  id: WorkflowStepId;
  title: string;
  description: string;
  status: StepStatus;
  durationMs?: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'stdout';
  stepId: WorkflowStepId;
  message: string;
}

export interface EnvironmentDetails {
  detectedRuntime: string;
  runtimeVersion: string;
  packageManager: PackageManager;
  detectedDependencies: number;
  dependenciesList: string[];
  port: number;
  startCommand: string;
  testCommand: string;
  healthEndpoint: string;
  memoryMb: number;
  cpuCores: number;
  leaseExpiresAt: string;
}

export interface ErrorSummary {
  title: string;
  message: string;
  step: WorkflowStepId;
  suggestedFix: string;
  exitCode?: number;
  stackTrace?: string;
}

export interface HealthStatus {
  healthy: boolean;
  latencyMs: number;
  statusCode: number;
  checkedAt: string;
}

export type AccessScope = 'read_only' | 'sandbox_debug' | 'full_ports';

export interface AccessRequest {
  id: string;
  workflowId?: string;
  sandboxId?: string;
  repoUrl: string;
  repoName: string;
  branch: string;
  runtime?: RuntimeType;
  runtimeVersion?: string;
  packageManager?: PackageManager;
  developerName: string;
  developerEmail: string;
  scope: AccessScope;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  proposedPlan?: PlannedExecutionStep[];
  planFingerprint?: string;
  manifestFileName?: string;
  dependencies?: string[];
  startCommand?: string;
  testCommand?: string;
  warnings?: string[];
  evaluationResult?: EvaluationResult;
}

export interface DeveloperUser {
  id: string;
  name: string;
  email: string;
  role: 'developer' | 'admin' | 'lead';
  activeSandboxes: number;
  totalRuns: number;
  lastActive: string;
  status: 'active' | 'idle' | 'suspended';
}

export interface AuditActivityEvent {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  status: 'success' | 'warning' | 'error' | 'info';
  details: string;
}

export interface Sandbox {
  id: string;
  name: string;
  repoUrl: string;
  repoOwner: string;
  repoName: string;
  branch: string;
  runtime: RuntimeType;
  runtimeVersion: string;
  packageManager: PackageManager;
  createdAt: string;
  status: SandboxStatus;
  currentStepId?: WorkflowStepId;
  steps: WorkflowStep[];
  logs: LogEntry[];
  env: EnvironmentDetails;
  envVars: { key: string; value: string }[];
  errorSummary?: ErrorSummary;
  healthStatus?: HealthStatus;
  previewUrl?: string;
  workflowId?: string;
  backendSynced?: boolean;
  approvalStatus?: ApprovalStatus;
  planFingerprint?: string;
  proposedPlan?: PlannedExecutionStep[];
  approvedAt?: string;
  rejectionReason?: string;
  currentStage?: string;
  currentMessage?: string;
  progressPercentage?: number;
  completedStages?: string[];
  stages?: WorkflowStageInfo[];
  approvalRequired?: boolean;
  requestedScope?: AccessScope;
  accessReason?: string;
  executionSteps?: Array<{
    command: string;
    exit_code: number;
    stdout: string;
    stderr: string;
    duration_seconds: number;
    success: boolean;
  }>;
  verificationResults?: {
    port: number;
    status_code: number;
    latency_ms: number;
    healthy: boolean;
    checks: string[];
  };
  evaluationResult?: EvaluationResult;
}

export type UserRole = 'developer' | 'admin';

export type ActiveNavTab =
  | 'overview'
  | 'new-sandbox'
  | 'history'
  | 'runtimes'
  | 'settings';

export type AdminNavTab =
  | 'admin-overview'
  | 'admin-sandboxes'
  | 'admin-requests'
  | 'admin-developers'
  | 'admin-monitoring'
  | 'admin-audit'
  | 'admin-settings';

