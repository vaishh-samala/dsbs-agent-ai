export type RuntimeType = 'node' | 'python';

export type PackageManager = 'npm' | 'pnpm' | 'yarn' | 'bun' | 'pip' | 'poetry' | 'uv';

export type SandboxStatus = 'queued' | 'running' | 'success' | 'failed' | 'stopped';

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
}

export type ActiveNavTab = 'overview' | 'new-sandbox' | 'history' | 'settings';
