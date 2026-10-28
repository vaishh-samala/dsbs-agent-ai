/**
 * Centralized TypeScript API Client for Developer Sandbox Bootstrapper Backend.
 * Strictly implements the request and response schemas defined in FastAPI backend.
 * Base URL defaults to http://127.0.0.1:8000 (configurable via VITE_API_BASE_URL).
 */

export type BackendProjectType =
  | 'node_app'
  | 'python_app'
  | 'fastapi_service'
  | 'nextjs_app'
  | 'express_api'
  | 'django_app';

export type BackendRuntimeType = 'node' | 'python';

export type BackendPackageManager =
  | 'npm'
  | 'pnpm'
  | 'yarn'
  | 'bun'
  | 'pip'
  | 'poetry'
  | 'uv';

export type BackendStepStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'skipped';

export type BackendWorkflowStatus =
  | 'queued'
  | 'running'
  | 'awaiting_approval'
  | 'completed'
  | 'failed'
  | 'rejected';

export type BackendApprovalStatus =
  | 'awaiting_approval'
  | 'approved'
  | 'rejected';

export interface PlannedStep {
  step: number;
  phase: string;
  command: string;
  description: string;
  is_safe: boolean;
}

export interface ApprovalDecisionRequest {
  approved: boolean;
  plan_fingerprint?: string;
  reason?: string;
}

export interface WorkflowPlanResponse {
  workflow_id: string;
  status: BackendWorkflowStatus;
  approval_status: BackendApprovalStatus;
  plan_fingerprint: string;
  execution_plan: PlannedStep[];
  setup_commands: string[];
  validation_commands: string[];
  runtime: string;
  package_manager: string;
  dependencies_count: number;
  is_ready_for_approval: boolean;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

/** Setup manifest matching backend SetupManifest schema (extra="forbid") */
export interface SetupManifestPayload {
  version?: string;
  project_name: string;
  project_type: BackendProjectType;
  runtime: BackendRuntimeType;
  language?: string;
  runtime_version: string;
  package_manager: BackendPackageManager;
  dependencies?: string[];
  env_var_names?: string[]; // Keys only, never values or '='
  setup_steps?: string[];
  setup_commands?: string[];
  validation_commands?: string[];
  port?: number;
  start_command?: string;
  test_command?: string;
  repo_url?: string;
  branch?: string;
  repo_path?: string;
}

export interface ManifestDiscoveryResult {
  discovered: boolean;
  source: string;
  manifest_file_path?: string | null;
  manifest: SetupManifestPayload;
  is_fallback: boolean;
  warnings: string[];
}

export interface ValidationErrorDetail {
  field: string;
  message: string;
  error_type: string;
}

export interface ValidationResult {
  is_valid: boolean;
  errors: ValidationErrorDetail[];
  warnings: string[];
  normalized_manifest?: SetupManifestPayload | null;
}

export interface BackendWorkflowStep {
  name: string;
  description: string;
  status: BackendStepStatus;
  started_at?: string | null;
  completed_at?: string | null;
  duration_seconds?: number | null;
  error_message?: string | null;
}

export interface WorkflowCreateResponse {
  workflow_id: string;
  status: BackendWorkflowStatus;
  is_simulated: boolean;
  created_at: string;
  steps: BackendWorkflowStep[];
  message: string;
  approval_status?: BackendApprovalStatus | null;
  plan_fingerprint?: string | null;
  execution_plan?: PlannedStep[] | null;
}

export interface WorkflowManifestSummary {
  project_name: string;
  project_type: string;
  runtime: string;
  package_manager: string;
  dependencies_count: number;
  port?: number;
  env_var_names: string[];
}

export interface WorkflowStatusResponse {
  workflow_id: string;
  status: BackendWorkflowStatus;
  is_simulated: boolean;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
  steps: BackendWorkflowStep[];
  manifest_summary: WorkflowManifestSummary;
  error_details?: string | null;
  approval_status?: BackendApprovalStatus | null;
  plan_fingerprint?: string | null;
  execution_plan?: PlannedStep[] | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
}

export interface APIErrorResponse {
  detail: string;
  error_code: string;
  errors?: ValidationErrorDetail[] | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  service: string;
  timestamp: string;
}

export class ApiError extends Error {
  statusCode: number;
  errorCode: string;
  errors?: ValidationErrorDetail[];

  constructor(statusCode: number, detail: string, errorCode: string, errors?: ValidationErrorDetail[]) {
    super(detail);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.errors = errors;
  }
}

/**
 * Determine the backend base URL.
 * Defaults to http://127.0.0.1:8000.
 */
export const BACKEND_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, '') || 'http://127.0.0.1:8000';

const API_V1_PREFIX = '/api/v1';

async function parseErrorResponse(res: Response): Promise<ApiError> {
  try {
    const errorJson: APIErrorResponse = await res.json();
    return new ApiError(
      res.status,
      errorJson.detail || `Request failed with HTTP ${res.status}`,
      errorJson.error_code || `HTTP_${res.status}`,
      errorJson.errors || undefined
    );
  } catch {
    return new ApiError(
      res.status,
      `HTTP ${res.status}: ${res.statusText || 'Unknown Server Error'}`,
      `HTTP_${res.status}`
    );
  }
}

/**
 * Generic fetch wrapper with timeout, JSON serialization, and error handling.
 */
async function request<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = 10000
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${BACKEND_BASE_URL}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      throw await parseErrorResponse(response);
    }

    return (await response.json()) as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) {
      throw err;
    }
    if ((err as Error)?.name === 'AbortError') {
      throw new ApiError(408, `Request timed out after ${timeoutMs}ms`, 'TIMEOUT_ERROR');
    }
    const message = (err as Error)?.message || 'Network connection to backend failed';
    throw new ApiError(0, `${message}. Backend at ${BACKEND_BASE_URL} might be unreachable.`, 'NETWORK_ERROR');
  } finally {
    clearTimeout(timer);
  }
}

export const sandboxApi = {
  /**
   * Health probe probe to verify API readiness and version
   * GET /health
   */
  async checkHealth(): Promise<HealthResponse> {
    return request<HealthResponse>('/health');
  },

  /**
   * Fetch canonical JSON schema for SetupManifest
   * GET /api/v1/sandbox/manifest/schema
   */
  async getManifestSchema(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>(`${API_V1_PREFIX}/sandbox/manifest/schema`);
  },

  /**
   * Discover or infer setup manifest in a repository directory
   * POST /api/v1/sandbox/manifest/discover
   */
  async discoverManifest(repoPath: string): Promise<ManifestDiscoveryResult> {
    return request<ManifestDiscoveryResult>(`${API_V1_PREFIX}/sandbox/manifest/discover`, {
      method: 'POST',
      body: JSON.stringify({ repo_path: repoPath }),
    });
  },

  /**
   * Validate setup manifest structure and runtime compatibility
   * POST /api/v1/sandbox/validate
   */
  async validateManifest(payload: SetupManifestPayload): Promise<ValidationResult> {
    return request<ValidationResult>(`${API_V1_PREFIX}/sandbox/validate`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Initialize simulated sandbox setup workflow
   * POST /api/v1/sandbox/setup
   */
  async createSandboxSetup(payload: SetupManifestPayload): Promise<WorkflowCreateResponse> {
    return request<WorkflowCreateResponse>(`${API_V1_PREFIX}/sandbox/setup`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  /**
   * Get current workflow execution progress, step details, and status
   * GET /api/v1/sandbox/status/{workflow_id}
   */
  async getWorkflowStatus(workflowId: string): Promise<WorkflowStatusResponse> {
    return request<WorkflowStatusResponse>(`${API_V1_PREFIX}/sandbox/status/${encodeURIComponent(workflowId)}`);
  },

  /**
   * Retrieve the pending execution plan for inspection and approval
   * GET /api/v1/sandbox/{workflow_id}/plan
   */
  async getWorkflowPlan(workflowId: string): Promise<WorkflowPlanResponse> {
    return request<WorkflowPlanResponse>(`${API_V1_PREFIX}/sandbox/${encodeURIComponent(workflowId)}/plan`);
  },

  /**
   * Explicitly approve the proposed plan to resume sandbox setup
   * POST /api/v1/sandbox/{workflow_id}/approve
   */
  async approveWorkflow(
    workflowId: string,
    decision?: ApprovalDecisionRequest
  ): Promise<WorkflowStatusResponse> {
    return request<WorkflowStatusResponse>(`${API_V1_PREFIX}/sandbox/${encodeURIComponent(workflowId)}/approve`, {
      method: 'POST',
      body: JSON.stringify(decision || { approved: true }),
    });
  },

  /**
   * Explicitly reject the proposed plan, cleanly halting execution
   * POST /api/v1/sandbox/{workflow_id}/reject
   */
  async rejectWorkflow(
    workflowId: string,
    reason?: string,
    planFingerprint?: string
  ): Promise<WorkflowStatusResponse> {
    return request<WorkflowStatusResponse>(`${API_V1_PREFIX}/sandbox/${encodeURIComponent(workflowId)}/reject`, {
      method: 'POST',
      body: JSON.stringify({
        approved: false,
        reason,
        plan_fingerprint: planFingerprint,
      }),
    });
  },

  /**
   * Poll workflow status until terminal status (completed, failed, awaiting_approval, or rejected) or timeout
   */
  async pollWorkflowStatus(
    workflowId: string,
    onProgress?: (status: WorkflowStatusResponse) => void,
    intervalMs = 700,
    maxWaitMs = 15000
  ): Promise<WorkflowStatusResponse> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const statusRes = await this.getWorkflowStatus(workflowId);
      if (onProgress) {
        onProgress(statusRes);
      }
      if (
        statusRes.status === 'completed' ||
        statusRes.status === 'failed' ||
        statusRes.status === 'awaiting_approval' ||
        statusRes.status === 'rejected'
      ) {
        return statusRes;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    // Return final fetch if timeout exceeded
    return this.getWorkflowStatus(workflowId);
  },
};

/**
 * Utility helper to convert frontend form data and presets into a strictly valid SetupManifestPayload.
 * Ensures project_name matches ^[a-zA-Z0-9_\-\.]+$ and env_var_names only contains keys.
 */
export function buildSetupManifestPayload(formData: {
  repoUrl: string;
  branch: string;
  runtime: BackendRuntimeType;
  runtimeVersion: string;
  packageManager: BackendPackageManager;
  port: number;
  startCommand?: string;
  testCommand?: string;
  envVars?: { key: string; value: string }[];
  simulateFailure?: boolean;
}): SetupManifestPayload {
  // Extract repository name or fallback
  let cleanName = formData.repoUrl
    .trim()
    .replace(/^https?:\/\/github\.com\//i, '')
    .replace(/\.git$/i, '')
    .split('/')
    .pop() || 'developer-sandbox';

  // Sanitize project name to match backend regex ^[a-zA-Z0-9_\-\.]+$
  cleanName = cleanName.replace(/[^a-zA-Z0-9_.-]/g, '-').slice(0, 80);

  // If simulate failure requested, backend triggers failure when "fail" is in project_name
  if (formData.simulateFailure && !cleanName.toLowerCase().includes('fail')) {
    cleanName = `${cleanName}-fail`;
  }

  // Derive project_type archetype
  let projectType: BackendProjectType;
  if (formData.runtime === 'node') {
    if (cleanName.includes('next') || cleanName.includes('taxonomy')) {
      projectType = 'nextjs_app';
    } else if (cleanName.includes('express')) {
      projectType = 'express_api';
    } else {
      projectType = 'node_app';
    }
  } else {
    if (cleanName.includes('fastapi')) {
      projectType = 'fastapi_service';
    } else if (cleanName.includes('django')) {
      projectType = 'django_app';
    } else {
      projectType = 'python_app';
    }
  }

  // Normalize runtime version string (e.g., "Node.js 20.14.0 LTS" -> "20.14.0", "Python 3.11.9" -> "3.11.9")
  const numericVersion =
    formData.runtimeVersion.replace(/^(Node\.js\s*|Python\s*)/i, '').replace(/\s*LTS.*$/i, '').trim() ||
    formData.runtimeVersion;

  // Dependencies baseline
  const dependencies =
    formData.runtime === 'node'
      ? ['next@14.2.3', 'react@18.3.1', 'react-dom@18.3.1', 'tailwindcss@3.4.1']
      : ['fastapi>=0.111.0', 'uvicorn[standard]>=0.29.0', 'pydantic>=2.7.1'];

  // Critical: Only variable NAMES (keys) are accepted, never values or '='!
  // Sanitize to valid uppercase identifier regex ^[A-Z_][A-Z0-9_]*$
  const envVarNames = (formData.envVars || [])
    .map((v) => v.key.trim().split('=')[0].toUpperCase().replace(/[^A-Z0-9_]/g, '_'))
    .filter((k) => k.length > 0 && /^[A-Z_][A-Z0-9_]*$/.test(k));

  const payload: SetupManifestPayload = {
    project_name: cleanName,
    project_type: projectType,
    runtime: formData.runtime,
    runtime_version: numericVersion,
    package_manager: formData.packageManager,
    dependencies,
    env_var_names: envVarNames.length > 0 ? Array.from(new Set(envVarNames)) : ['PORT'],
    port: formData.port,
    start_command: formData.startCommand?.trim() || undefined,
    test_command: formData.testCommand?.trim() || undefined,
    repo_url: formData.repoUrl.trim() || undefined,
    branch: formData.branch.trim() || 'main',
  };

  return payload;
}
