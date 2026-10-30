import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveNavTab,
  AdminNavTab,
  ErrorSummary,
  PackageManager,
  RuntimeType,
  Sandbox,
  SandboxStatus,
  StepStatus,
  UserRole,
  WorkflowStep,
  WorkflowStepId,
  AccessRequest,
  DeveloperUser,
  AuditActivityEvent,
} from './types/sandbox';
import { INITIAL_MOCK_SANDBOXES } from './data/mockSandboxes';
import {
  INITIAL_ACCESS_REQUESTS,
  INITIAL_DEVELOPERS,
  INITIAL_AUDIT_LOGS,
} from './data/mockAdminData';
import { parseRepoDetails, startSandboxSimulation, resumeSandboxSimulation } from './utils/sandboxSimulator';
import {
  sandboxApi,
  buildSetupManifestPayload,
  BACKEND_BASE_URL,
  BackendWorkflowStep,
  WorkflowStatusResponse,
  setApiUserRole,
} from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DeveloperOverview } from './components/DeveloperOverview';
import { RepositoryForm, SandboxFormData } from './components/RepositoryForm';
import { DetailedSandboxModal } from './components/DetailedSandboxModal';
import { SandboxHistoryView } from './components/SandboxHistoryView';
import { SettingsView } from './components/SettingsView';
import { MockPreviewModal } from './components/MockPreviewModal';
import { SupportedRuntimesView } from './components/SupportedRuntimesView';
import { AdminWorkspace } from './components/admin/AdminWorkspace';
import { DemoLoginModal } from './components/DemoLoginModal';
import {
  Github,
  RotateCcw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  GitBranch,
  Clock,
} from 'lucide-react';

function mapBackendStepToFrontend(
  backendStep: BackendWorkflowStep,
  existingStep: WorkflowStep
): WorkflowStep {
  let status: StepStatus = 'pending';
  if (backendStep.status === 'completed') status = 'completed';
  else if (backendStep.status === 'running') status = 'running';
  else if (backendStep.status === 'failed') status = 'failed';
  else if (backendStep.status === 'skipped') status = 'skipped';

  return {
    ...existingStep,
    status,
    durationMs: backendStep.duration_seconds
      ? Math.round(backendStep.duration_seconds * 1000)
      : existingStep.durationMs,
    startedAt: backendStep.started_at ? 'Just now' : existingStep.startedAt,
    completedAt: backendStep.completed_at ? 'Just now' : existingStep.completedAt,
    error: backendStep.error_message || existingStep.error,
  };
}

function mapBackendStepsToPipeline(
  backendSteps: BackendWorkflowStep[],
  baseSteps: WorkflowStep[]
): WorkflowStep[] {
  const stepMap: Record<string, BackendWorkflowStep> = {};
  backendSteps.forEach((s) => {
    stepMap[s.name] = s;
  });

  return baseSteps.map((step) => {
    let backendName = '';
    if (step.id === 'inspection') backendName = 'validate_manifest';
    else if (step.id === 'dependencies') backendName = 'resolve_dependencies';
    else if (step.id === 'configuration') backendName = 'prepare_environment';
    else if (step.id === 'verification') backendName = 'run_health_checks';

    const matched = stepMap[backendName];
    if (matched) {
      return mapBackendStepToFrontend(matched, step);
    }
    return step;
  });
}

function applyWorkflowStatusToSandbox(
  s: Sandbox,
  prog: WorkflowStatusResponse
): Sandbox {
  const updatedSteps = mapBackendStepsToPipeline(prog.steps || [], s.steps);
  const status: SandboxStatus =
    prog.status === 'awaiting_approval'
      ? 'awaiting_approval'
      : prog.status === 'completed'
      ? 'running'
      : prog.status === 'rejected'
      ? 'rejected'
      : prog.status === 'failed'
      ? 'failed'
      : 'running';

  return {
    ...s,
    status,
    approvalStatus: prog.approval_status || s.approvalStatus,
    planFingerprint: prog.plan_fingerprint || s.planFingerprint,
    proposedPlan: (prog.execution_plan as any) || s.proposedPlan,
    rejectionReason: prog.rejection_reason || s.rejectionReason,
    currentStage: prog.current_stage || s.currentStage,
    currentMessage: prog.current_message || s.currentMessage,
    progressPercentage:
      prog.progress_percentage != null ? prog.progress_percentage : s.progressPercentage,
    stages: prog.stages || s.stages,
    approvalRequired:
      prog.approval_required != null ? prog.approval_required : s.approvalRequired,
    executionSteps: (prog.execution_steps as any) || s.executionSteps,
    verificationResults: (prog.verification_results as any) || s.verificationResults,
    evaluationResult: (prog as any).evaluation_result || s.evaluationResult,
    steps: updatedSteps,
    currentStepId:
      updatedSteps.find((st) => st.status === 'running')?.id || s.currentStepId,
  };
}

export default function App() {
  // Demo Role and Navigation State
  const [userRole, setUserRole] = useState<UserRole>('developer');
  const [activeTab, setActiveTab] = useState<ActiveNavTab | AdminNavTab>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDemoLoginModalOpen, setIsDemoLoginModalOpen] = useState(false);

  // Sandboxes State
  const [sandboxes, setSandboxes] = useState<Sandbox[]>(INITIAL_MOCK_SANDBOXES);
  const [activeSandboxId, setActiveSandboxId] = useState<string>(INITIAL_MOCK_SANDBOXES[0].id);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  // Administrator Workspace State
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>(INITIAL_ACCESS_REQUESTS);
  const [developers, setDevelopers] = useState<DeveloperUser[]>(INITIAL_DEVELOPERS);
  const [auditLogs, setAuditLogs] = useState<AuditActivityEvent[]>(INITIAL_AUDIT_LOGS);

  // Backend Health and API Status
  const [backendHealth, setBackendHealth] = useState<{
    status: 'healthy' | 'offline' | 'checking';
    version?: string;
  }>({ status: 'checking', version: '1.0.0' });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [apiNotification, setApiNotification] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Modals
  const [detailModalSandbox, setDetailModalSandbox] = useState<Sandbox | null>(null);
  const [previewModalSandbox, setPreviewModalSandbox] = useState<Sandbox | null>(null);

  // Active step filter for logs in Overview
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<WorkflowStepId | 'all'>('all');

  // Cancel ref for simulator fallback
  const cancelSimulationRef = useRef<(() => void) | null>(null);

  // Active Sandbox
  const activeSandbox =
    sandboxes.find((s) => s.id === activeSandboxId) || sandboxes[0] || null;

  // Query Backend Health on Mount and synchronize API role
  useEffect(() => {
    setApiUserRole(userRole);
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const res = await sandboxApi.checkHealth();
      setBackendHealth({ status: 'healthy', version: res.version });
    } catch {
      setBackendHealth({ status: 'offline' });
    }
  };

  // Header Refresh Handler
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkHealth();

    if (activeSandbox?.workflowId) {
      try {
        const statusRes = await sandboxApi.getWorkflowStatus(activeSandbox.workflowId);
        setSandboxes((prev) =>
          prev.map((s) => {
            if (s.id === activeSandbox.id) {
              return {
                ...applyWorkflowStatusToSandbox(s, statusRes),
                backendSynced: true,
              };
            }
            return s;
          })
        );
        setApiNotification({
          type: 'success',
          message: `Synced workflow ${activeSandbox.workflowId} with backend (${statusRes.status.toUpperCase()}).`,
        });
        setTimeout(() => setApiNotification(null), 3500);
      } catch (err: unknown) {
        setApiNotification({
          type: 'error',
          message: `Refresh failed: ${(err as Error)?.message || 'Unknown error'}`,
        });
        setTimeout(() => setApiNotification(null), 4000);
      }
    }
    setIsRefreshing(false);
  };

  // Switch Role Handler
  const handleSwitchRole = (newRole: UserRole) => {
    setUserRole(newRole);
    setApiUserRole(newRole);
    if (newRole === 'admin') {
      setActiveTab('admin-overview');
    } else {
      setActiveTab('overview');
    }
  };

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (cancelSimulationRef.current) {
        cancelSimulationRef.current();
      }
    };
  }, []);

  // Handle Form Submission / Start Sandbox Setup
  // CRITICAL REQUIREMENT: "When the developer clicks Create Sandbox, open a dedicated, full-page Agent Workflow screen. Do not redirect to Overview."
  const handleCreateSandbox = async (formData: SandboxFormData) => {
    setIsBootstrapping(true);

    // Cancel any ongoing fallback simulation
    if (cancelSimulationRef.current) {
      cancelSimulationRef.current();
      cancelSimulationRef.current = null;
    }

    const { owner, name } = parseRepoDetails(formData.repoUrl);
    const payload = buildSetupManifestPayload({
      repoUrl: formData.repoUrl,
      branch: formData.branch,
      runtime: formData.runtime,
      runtimeVersion: formData.runtimeVersion,
      packageManager: formData.packageManager,
      port: formData.port,
      startCommand: formData.startCommand,
      testCommand: formData.testCommand,
      envVars: formData.envVars,
      simulateFailure: formData.simulateFailure,
    });

    // Record access request in admin data
    const newReqId = `req-${Math.floor(100 + Math.random() * 900)}`;
    const newAccessReq: AccessRequest = {
      id: newReqId,
      repoUrl: formData.repoUrl,
      repoName: name,
      branch: formData.branch,
      developerName: 'Developer Demo User',
      developerEmail: 'developer@sandbox.dev',
      scope: formData.requestedScope,
      reason: formData.accessReason,
      status: 'pending',
      requestedAt: 'Just now',
    };
    setAccessRequests((prev) => [newAccessReq, ...prev]);

    try {
      // 1. Submit setup workflow to FastAPI backend (background execution for real-time progress)
      const initRes = await sandboxApi.createSandboxSetup(payload, { background: true });
      const newId = initRes.workflow_id;

      const basePipeline: WorkflowStep[] = [
        {
          id: 'inspection',
          title: 'Repository Inspection',
          description: 'Cloning git ref, analyzing directory tree, detecting runtime manifests',
          status: 'pending',
        },
        {
          id: 'dependencies',
          title: 'Dependency Installation',
          description: `Resolving lockfiles and downloading isolated dependencies via ${formData.packageManager}`,
          status: 'pending',
        },
        {
          id: 'configuration',
          title: 'Environment Configuration',
          description: 'Allocating sandbox network ports, setting up cgroups and environment variables',
          status: 'pending',
        },
        {
          id: 'verification',
          title: 'Verification',
          description: 'Executing process start command and checking readiness health probe',
          status: 'pending',
        },
      ];

      const initialSteps = mapBackendStepsToPipeline(initRes.steps, basePipeline);
      const nowTime = new Date().toTimeString().split(' ')[0];

      const newSandbox: Sandbox = {
        id: newId,
        workflowId: newId,
        backendSynced: true,
        name: `${name}-${formData.branch}`,
        repoUrl: formData.repoUrl,
        repoOwner: owner,
        repoName: name,
        branch: formData.branch,
        runtime: formData.runtime,
        runtimeVersion: formData.runtimeVersion,
        packageManager: formData.packageManager,
        createdAt: 'Just now',
        status: initRes.status === 'awaiting_approval' ? 'awaiting_approval' : 'running',
        approvalStatus:
          initRes.approval_status ||
          (initRes.status === 'awaiting_approval' ? 'awaiting_approval' : undefined),
        planFingerprint: initRes.plan_fingerprint || undefined,
        proposedPlan: (initRes.execution_plan as any) || undefined,
        currentStage: initRes.current_stage || 'inspection',
        currentMessage: initRes.current_message || 'Agent is inspecting your repository...',
        progressPercentage: initRes.progress_percentage ?? 5,
        stages: initRes.stages || [],
        approvalRequired: initRes.approval_required ?? undefined,
        requestedScope: formData.requestedScope,
        accessReason: formData.accessReason,
        executionSteps: (initRes as any).execution_steps || undefined,
        verificationResults: (initRes as any).verification_results || undefined,
        evaluationResult: (initRes as any).evaluation_result || undefined,
        currentStepId: 'inspection',
        steps: initialSteps,
        logs: [
          {
            id: `log-${Date.now()}-0`,
            timestamp: nowTime,
            level: 'info',
            stepId: 'inspection',
            message: `FastAPI workflow ${newId} initialized. Bootstrapping isolated sandbox for ${formData.repoUrl} @ ${formData.branch}`,
          },
          {
            id: `log-${Date.now()}-1`,
            timestamp: nowTime,
            level: 'success',
            stepId: 'inspection',
            message: `Manifest validated and normalized by backend service. Project archetype: ${payload.project_type}.`,
          },
          ...(initRes.status === 'awaiting_approval'
            ? [
                {
                  id: `log-${Date.now()}-gate`,
                  timestamp: nowTime,
                  level: 'info' as const,
                  stepId: 'inspection' as const,
                  message: `Execution plan prepared (${initRes.execution_plan?.length || 0} steps). Paused at approval gate awaiting explicit user approval.`,
                },
              ]
            : []),
        ],
        env: {
          detectedRuntime: formData.runtimeVersion,
          runtimeVersion: formData.runtimeVersion.replace(/[^0-9.]/g, ''),
          packageManager: formData.packageManager,
          detectedDependencies: payload.dependencies?.length || 24,
          dependenciesList: payload.dependencies || [],
          port: formData.port,
          startCommand:
            formData.startCommand ||
            (formData.runtime === 'node'
              ? `${formData.packageManager} run dev`
              : `${formData.packageManager} run uvicorn main:app`),
          testCommand:
            formData.testCommand ||
            (formData.runtime === 'node' ? `${formData.packageManager} test` : 'pytest -v'),
          healthEndpoint: `http://127.0.0.1:${formData.port}/health`,
          memoryMb: 2048,
          cpuCores: 2,
          leaseExpiresAt: 'In 60 minutes',
        },
        envVars:
          formData.envVars.length > 0
            ? formData.envVars
            : [
                { key: 'PORT', value: String(formData.port) },
                { key: 'NODE_ENV', value: 'development' },
              ],
      };

      setSandboxes((prev) => [newSandbox, ...prev]);
      setActiveSandboxId(newId);

      // Record Audit Log
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          timestamp: nowTime,
          actor: 'developer@sandbox.dev',
          action: 'WORKFLOW_INITIALIZED',
          target: `${newId} (${name})`,
          status: 'info',
          details: `Requested ${formData.requestedScope} scope. Initialized LangGraph agent workflow.`,
        },
        ...prev,
      ]);

      // Attach real workflow metadata to access request for admin visibility
      setAccessRequests((prev) =>
        prev.map((r) =>
          r.id === newReqId
            ? {
                ...r,
                workflowId: newId,
                sandboxId: newId,
                runtime: formData.runtime,
                runtimeVersion: formData.runtimeVersion,
                packageManager: formData.packageManager,
                proposedPlan: (initRes.execution_plan as any) || undefined,
                planFingerprint: initRes.plan_fingerprint || undefined,
                manifestFileName: formData.runtime === 'node' ? 'package.json' : 'pyproject.toml',
                dependencies: payload.dependencies || [],
                startCommand: formData.startCommand,
                testCommand: formData.testCommand,
                evaluationResult: (initRes as any).evaluation_result || undefined,
              }
            : r
        )
      );

      // Navigate to Sandbox History and inspect recorded setup timeline
      setActiveTab('history');
      setDetailModalSandbox(newSandbox);

      // Set up SSE subscription with polling fallback
      let sseCleanup: (() => void) | null = null;
      try {
        sseCleanup = sandboxApi.subscribeWorkflowEvents(newId, (prog) => {
          setSandboxes((prev) =>
            prev.map((s) => (s.id === newId ? applyWorkflowStatusToSandbox(s, prog) : s))
          );
          setDetailModalSandbox((curr) =>
            curr && curr.id === newId ? applyWorkflowStatusToSandbox(curr, prog) : curr
          );
        });
      } catch (e) {
        console.warn('SSE subscription failed, falling back to polling', e);
      }

      // If workflow is already awaiting approval
      if (initRes.status === 'awaiting_approval') {
        setIsBootstrapping(false);
        if (sseCleanup) sseCleanup();
        setDetailModalSandbox(newSandbox);
        setApiNotification({
          type: 'info',
          message: `Execution plan prepared (${initRes.execution_plan?.length || 0} steps). Review the commands in the setup timeline and approve to boot sandbox.`,
        });
        return;
      }

      // 2. Poll workflow status from FastAPI backend until terminal status or awaiting_approval
      const finalStatus = await sandboxApi.pollWorkflowStatus(newId, (prog) => {
        setSandboxes((prev) =>
          prev.map((s) => (s.id === newId ? applyWorkflowStatusToSandbox(s, prog) : s))
        );
        setDetailModalSandbox((curr) =>
          curr && curr.id === newId ? applyWorkflowStatusToSandbox(curr, prog) : curr
        );
      });

      if (sseCleanup) {
        sseCleanup();
      }

      // If workflow paused at approval gate
      if (finalStatus.status === 'awaiting_approval') {
        setIsBootstrapping(false);
        const updated = applyWorkflowStatusToSandbox(newSandbox, finalStatus);
        setSandboxes((prev) =>
          prev.map((s) => (s.id === newId ? updated : s))
        );
        setDetailModalSandbox(updated);
        setApiNotification({
          type: 'info',
          message: `Execution plan prepared (${finalStatus.execution_plan?.length || 0} steps). Review the commands in the setup timeline and approve to boot sandbox.`,
        });
        return;
      }

      // 3. Finalize sandbox state
      finalizeWorkflowResult(newId, finalStatus, newSandbox);
    } catch (err: unknown) {
      // Backend not running / connection failed: inform and run local simulator
      const errMsg = (err as Error)?.message || 'Network error';
      setApiNotification({
        type: 'info',
        message: `FastAPI backend at ${BACKEND_BASE_URL} unreachable (${errMsg}). Switched to local simulated runner.`,
      });
      setTimeout(() => setApiNotification(null), 6000);

      const newId = `sbx-${Math.floor(1000 + Math.random() * 9000)}`;
      const cancel = startSandboxSimulation({
        sandboxId: newId,
        name: '',
        repoUrl: formData.repoUrl,
        branch: formData.branch,
        runtime: formData.runtime,
        runtimeVersion: formData.runtimeVersion,
        packageManager: formData.packageManager,
        startCommand: formData.startCommand,
        testCommand: formData.testCommand,
        port: formData.port,
        envVars: formData.envVars,
        simulateFailure: formData.simulateFailure,
        onUpdate: (updatedSandbox) => {
          setSandboxes((prev) => {
            const exists = prev.some((s) => s.id === updatedSandbox.id);
            if (exists) {
              return prev.map((s) => (s.id === updatedSandbox.id ? updatedSandbox : s));
            }
            return [updatedSandbox, ...prev];
          });
          setDetailModalSandbox((curr) =>
            curr && curr.id === updatedSandbox.id ? updatedSandbox : curr
          );
        },
        onFinish: (finalSandbox) => {
          setIsBootstrapping(false);
          if (finalSandbox) {
            setDetailModalSandbox(finalSandbox);
            if (finalSandbox.status === 'awaiting_approval') {
              setApiNotification({
                type: 'info',
                message: `Execution plan formulated (${finalSandbox.proposedPlan?.length || 3} steps). Review the plan and click 'Approve & Execute Plan' to boot sandbox.`,
              });
              setTimeout(() => setApiNotification(null), 6000);
            }
          }
        },
      });

      cancelSimulationRef.current = cancel;
      setActiveSandboxId(newId);
      setActiveTab('history');
    } finally {
      setIsBootstrapping(false);
    }
  };

  // Helper to finalize workflow status after completion/failure/rejection
  const finalizeWorkflowResult = (
    sandboxId: string,
    finalStatus: {
      status: string;
      error_details?: string | null;
      steps: BackendWorkflowStep[];
      approval_status?: string | null;
      rejection_reason?: string | null;
      current_stage?: string | null;
      current_message?: string | null;
      progress_percentage?: number | null;
      stages?: any[] | null;
      execution_steps?: any[] | null;
      verification_results?: any;
    },
    targetSandbox: Sandbox
  ) => {
    const updatedSteps = mapBackendStepsToPipeline(finalStatus.steps, targetSandbox.steps);
    const isFailed = finalStatus.status === 'failed';
    const isRejected = finalStatus.status === 'rejected';

    let errorSummary: ErrorSummary | undefined;
    if (isFailed) {
      const failedStep = finalStatus.steps.find((st) => st.status === 'failed');
      errorSummary = {
        title: 'Verification Health Check Failed',
        message:
          finalStatus.error_details ||
          failedStep?.error_message ||
          `Process started but failed readiness probes on port ${targetSandbox.env.port}.`,
        step: 'verification',
        exitCode: 1,
        suggestedFix:
          targetSandbox.runtime === 'python'
            ? 'Add MOCK_DATABASE=true or use a local SQLite connection string in the Environment Variables section.'
            : 'Verify port binding and check that all required environment variables are configured.',
        stackTrace: failedStep?.error_message || 'Simulated health check failed.',
      };
    }

    setSandboxes((prev) =>
      prev.map((s) => {
        if (s.id === sandboxId) {
          return {
            ...s,
            status: isFailed ? 'failed' : isRejected ? 'rejected' : 'running',
            approvalStatus: (finalStatus.approval_status as any) || s.approvalStatus,
            rejectionReason: finalStatus.rejection_reason || s.rejectionReason,
            currentStage: finalStatus.current_stage || s.currentStage || 'final_result',
            currentMessage:
              finalStatus.current_message ||
              (isFailed
                ? 'Environment verification failed.'
                : isRejected
                ? 'Your setup plan was rejected. No commands were executed.'
                : 'Setup completed successfully.'),
            progressPercentage:
              finalStatus.progress_percentage != null
                ? finalStatus.progress_percentage
                : isFailed
                ? 90
                : 100,
            stages: finalStatus.stages || s.stages,
            executionSteps: finalStatus.execution_steps || s.executionSteps,
            verificationResults: finalStatus.verification_results || s.verificationResults,
            steps: updatedSteps,
            errorSummary,
            healthStatus:
              isFailed || isRejected
                ? undefined
                : {
                    healthy: true,
                    latencyMs: 24,
                    statusCode: 200,
                    checkedAt: 'Just now',
                  },
            previewUrl:
              isFailed || isRejected ? undefined : `http://localhost:${targetSandbox.env.port}`,
            logs: [
              ...s.logs,
              ...(isFailed
                ? [
                    {
                      id: `log-${Date.now()}-err`,
                      timestamp: new Date().toTimeString().split(' ')[0],
                      level: 'error' as const,
                      stepId: 'verification' as const,
                      message: finalStatus.error_details || 'Health probe failed.',
                    },
                  ]
                : isRejected
                ? [
                    {
                      id: `log-${Date.now()}-rej`,
                      timestamp: new Date().toTimeString().split(' ')[0],
                      level: 'warn' as const,
                      stepId: 'inspection' as const,
                      message: `Workflow halted cleanly at approval gate: ${
                        finalStatus.rejection_reason || 'Plan rejected.'
                      }`,
                    },
                  ]
                : [
                    {
                      id: `log-${Date.now()}-succ`,
                      timestamp: new Date().toTimeString().split(' ')[0],
                      level: 'success' as const,
                      stepId: 'verification' as const,
                      message: `FastAPI workflow ${sandboxId} completed successfully! Sandbox ready at http://localhost:${targetSandbox.env.port}`,
                    },
                  ]),
            ],
          };
        }
        return s;
      })
    );

    // Keep detail modal updated if currently open
    setDetailModalSandbox((curr) => {
      if (curr && curr.id === sandboxId) {
        return {
          ...curr,
          status: isFailed ? 'failed' : isRejected ? 'rejected' : 'running',
          approvalStatus: (finalStatus.approval_status as any) || curr.approvalStatus,
          rejectionReason: finalStatus.rejection_reason || curr.rejectionReason,
          currentStage: finalStatus.current_stage || curr.currentStage || 'final_result',
          currentMessage:
            finalStatus.current_message ||
            (isFailed
              ? 'Environment verification failed.'
              : isRejected
              ? 'Your setup plan was rejected. No commands were executed.'
              : 'Setup completed successfully.'),
          progressPercentage:
            finalStatus.progress_percentage != null
              ? finalStatus.progress_percentage
              : isFailed
              ? 90
              : 100,
          stages: finalStatus.stages || curr.stages,
          executionSteps: finalStatus.execution_steps || curr.executionSteps,
          verificationResults: finalStatus.verification_results || curr.verificationResults,
          steps: updatedSteps,
          errorSummary,
          previewUrl:
            isFailed || isRejected ? undefined : `http://localhost:${targetSandbox.env.port}`,
        };
      }
      return curr;
    });

    setApiNotification({
      type: isFailed ? 'error' : isRejected ? 'info' : 'success',
      message: isFailed
        ? `Backend workflow ${sandboxId} finished with verification error.`
        : isRejected
        ? `Backend workflow ${sandboxId} setup was cleanly rejected.`
        : `Backend workflow ${sandboxId} bootstrapped successfully via FastAPI.`,
    });
    setTimeout(() => setApiNotification(null), 5000);
  };

  // Handle Explicit User Approval for Proposed Execution Plan
  const handleApprovePlan = async (sandboxId: string) => {
    if (userRole !== 'admin') {
      setApiNotification({
        type: 'error',
        message: 'Access Denied: Only administrators are authorized to approve setup plans.',
      });
      setTimeout(() => setApiNotification(null), 4000);
      return;
    }

    const target = sandboxes.find((s) => s.id === sandboxId);
    if (!target) return;

    const workflowId = target.workflowId;
    const isSimulated =
      !target.backendSynced ||
      !workflowId ||
      target.id.startsWith('sbx-') ||
      workflowId.startsWith('sbx-');

    if (isSimulated || !workflowId) {
      setIsBootstrapping(true);
      // Record Audit
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          actor: 'admin@sandbox.internal',
          action: 'APPROVAL_GATE_APPROVED',
          target: `${target.id} (${target.repoName})`,
          status: 'success',
          details: `Plan approved (simulated sandbox). Fingerprint: ${target.planFingerprint || 'sha256:simulated'}`,
        },
        ...prev,
      ]);

      const cancel = resumeSandboxSimulation(
        target,
        true,
        undefined,
        (updated) => {
          setSandboxes((prev) => prev.map((s) => (s.id === sandboxId ? updated : s)));
          setDetailModalSandbox((curr) => (curr && curr.id === sandboxId ? updated : curr));
        },
        () => {
          setIsBootstrapping(false);
          setApiNotification({
            type: 'success',
            message: `Sandbox ${target.repoName} approved and bootstrapped successfully!`,
          });
          setTimeout(() => setApiNotification(null), 4000);
        }
      );
      cancelSimulationRef.current = cancel;
      return;
    }

    setIsBootstrapping(true);
    let sseCleanup: (() => void) | null = null;

    try {
      try {
        sseCleanup = sandboxApi.subscribeWorkflowEvents(workflowId, (prog) => {
          setSandboxes((prev) =>
            prev.map((s) => (s.id === sandboxId ? applyWorkflowStatusToSandbox(s, prog) : s))
          );
          setDetailModalSandbox((curr) =>
            curr && curr.id === sandboxId ? applyWorkflowStatusToSandbox(curr, prog) : curr
          );
        });
      } catch (e) {
        console.warn('SSE subscription failed, using polling', e);
      }

      const apprRes = await sandboxApi.approveWorkflow(
        workflowId,
        {
          approved: true,
          plan_fingerprint: target.planFingerprint,
        },
        { background: true }
      );

      // Record Audit
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          actor: 'admin@sandbox.internal',
          action: 'APPROVAL_GATE_APPROVED',
          target: `${target.id} (${target.repoName})`,
          status: 'success',
          details: `Plan approved. Fingerprint: ${target.planFingerprint}`,
        },
        ...prev,
      ]);

      // Update access request status to approved
      setAccessRequests((prev) =>
        prev.map((r) =>
          r.workflowId === workflowId || r.sandboxId === sandboxId
            ? {
                ...r,
                status: 'approved',
                decidedAt: 'Just now',
                decidedBy: 'Operator Approval Gate',
              }
            : r
        )
      );

      // Update sandbox state after resuming
      setSandboxes((prev) =>
        prev.map((s) => {
          if (s.id === sandboxId) {
            const updated = applyWorkflowStatusToSandbox(s, apprRes);
            return {
              ...updated,
              logs: [
                ...updated.logs,
                {
                  id: `log-${Date.now()}-appr`,
                  timestamp: new Date().toTimeString().split(' ')[0],
                  level: 'success' as const,
                  stepId: 'dependencies' as const,
                  message: `Execution plan explicitly approved. Resuming setup via sandbox executor.`,
                },
              ],
            };
          }
          return s;
        })
      );

      setDetailModalSandbox((curr) =>
        curr && curr.id === sandboxId ? applyWorkflowStatusToSandbox(curr, apprRes) : curr
      );

      // If already finished in synchronous execution
      if (apprRes.status === 'completed' || apprRes.status === 'failed') {
        if (sseCleanup) sseCleanup();
        finalizeWorkflowResult(sandboxId, apprRes, target);
        return;
      }

      // Poll until completed, failed, or rejected
      const finalStatus = await sandboxApi.pollWorkflowStatus(workflowId, (prog) => {
        setSandboxes((prev) =>
          prev.map((s) => (s.id === sandboxId ? applyWorkflowStatusToSandbox(s, prog) : s))
        );
        setDetailModalSandbox((curr) =>
          curr && curr.id === sandboxId ? applyWorkflowStatusToSandbox(curr, prog) : curr
        );
      });

      if (sseCleanup) sseCleanup();
      finalizeWorkflowResult(sandboxId, finalStatus, target);
    } catch (err: unknown) {
      if (sseCleanup) sseCleanup();
      // Graceful fallback to simulator if backend drops connection or route fails
      const cancel = resumeSandboxSimulation(
        target,
        true,
        undefined,
        (updated) => {
          setSandboxes((prev) => prev.map((s) => (s.id === sandboxId ? updated : s)));
          setDetailModalSandbox((curr) => (curr && curr.id === sandboxId ? updated : curr));
        },
        () => {
          setIsBootstrapping(false);
          setApiNotification({
            type: 'success',
            message: `Sandbox ${target.repoName} approved and bootstrapped successfully!`,
          });
          setTimeout(() => setApiNotification(null), 4000);
        }
      );
      cancelSimulationRef.current = cancel;
    } finally {
      setIsBootstrapping(false);
    }
  };

  // Handle Explicit User Rejection for Proposed Execution Plan
  const handleRejectPlan = async (sandboxId: string, reason?: string) => {
    if (userRole !== 'admin') {
      setApiNotification({
        type: 'error',
        message: 'Access Denied: Only administrators are authorized to reject setup plans.',
      });
      setTimeout(() => setApiNotification(null), 4000);
      return;
    }

    const target = sandboxes.find((s) => s.id === sandboxId);
    if (!target) return;

    const workflowId = target.workflowId;
    const isSimulated =
      !target.backendSynced ||
      !workflowId ||
      target.id.startsWith('sbx-') ||
      workflowId.startsWith('sbx-');

    if (isSimulated || !workflowId) {
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          actor: 'admin@sandbox.internal',
          action: 'APPROVAL_GATE_REJECTED',
          target: `${target.id} (${target.repoName})`,
          status: 'warning',
          details: `Execution plan rejected: ${reason || 'User rejected execution plan.'}`,
        },
        ...prev,
      ]);

      resumeSandboxSimulation(
        target,
        false,
        reason || 'User rejected execution plan.',
        (updated) => {
          setSandboxes((prev) => prev.map((s) => (s.id === sandboxId ? updated : s)));
          setDetailModalSandbox((curr) => (curr && curr.id === sandboxId ? updated : curr));
        },
        () => {
          setIsBootstrapping(false);
          setApiNotification({
            type: 'info',
            message: `Execution plan for ${target.repoName} rejected. No commands were executed.`,
          });
          setTimeout(() => setApiNotification(null), 4000);
        }
      );
      return;
    }

    try {
      const rejRes = await sandboxApi.rejectWorkflow(
        workflowId,
        reason || 'User rejected execution plan.',
        target.planFingerprint
      );

      // Record Audit
      setAuditLogs((prev) => [
        {
          id: `aud-${Date.now()}`,
          timestamp: new Date().toTimeString().split(' ')[0],
          actor: 'admin@sandbox.internal',
          action: 'APPROVAL_GATE_REJECTED',
          target: `${target.id} (${target.repoName})`,
          status: 'warning',
          details: `Execution plan rejected: ${reason || 'User rejected execution plan.'}`,
        },
        ...prev,
      ]);

      // Update access request status to rejected
      setAccessRequests((prev) =>
        prev.map((r) =>
          r.workflowId === target.workflowId || r.sandboxId === sandboxId
            ? {
                ...r,
                status: 'rejected',
                decidedAt: 'Just now',
                decidedBy: 'Operator Approval Gate',
              }
            : r
        )
      );

      setSandboxes((prev) =>
        prev.map((s) => (s.id === sandboxId ? applyWorkflowStatusToSandbox(s, rejRes) : s))
      );

      setDetailModalSandbox((curr) =>
        curr && curr.id === sandboxId ? applyWorkflowStatusToSandbox(curr, rejRes) : curr
      );

      finalizeWorkflowResult(sandboxId, rejRes, target);
    } catch (err: unknown) {
      resumeSandboxSimulation(
        target,
        false,
        reason || 'User rejected execution plan.',
        (updated) => {
          setSandboxes((prev) => prev.map((s) => (s.id === sandboxId ? updated : s)));
          setDetailModalSandbox((curr) => (curr && curr.id === sandboxId ? updated : curr));
        }
      );
      setApiNotification({
        type: 'info',
        message: `Execution plan for ${target.repoName} rejected.`,
      });
      setTimeout(() => setApiNotification(null), 4000);
    }
  };

  // Handle Retry Sandbox
  const handleRetrySandbox = (targetSandbox: Sandbox, withSuggestedFix = false) => {
    if (detailModalSandbox) {
      setDetailModalSandbox(null);
    }

    const envVars = withSuggestedFix
      ? [
          ...targetSandbox.envVars,
          { key: 'MOCK_DATABASE', value: 'true' },
          { key: 'DATABASE_URL', value: 'sqlite:///local_test.db' },
        ]
      : targetSandbox.envVars;

    handleCreateSandbox({
      repoUrl: targetSandbox.repoUrl,
      branch: targetSandbox.branch,
      runtime: targetSandbox.runtime,
      runtimeVersion: targetSandbox.runtimeVersion,
      packageManager: targetSandbox.packageManager,
      port: targetSandbox.env.port,
      startCommand: targetSandbox.env.startCommand,
      testCommand: targetSandbox.env.testCommand,
      envVars,
      requestedScope: targetSandbox.requestedScope || 'sandbox_debug',
      accessReason: targetSandbox.accessReason || 'Re-run execution',
      simulateFailure: withSuggestedFix ? false : targetSandbox.status === 'failed',
    });
  };

  // Stop Sandbox
  const handleStopSandbox = (sandboxId: string) => {
    setSandboxes((prev) =>
      prev.map((s) => (s.id === sandboxId ? { ...s, status: 'stopped' } : s))
    );
  };

  // Delete Sandbox
  const handleDeleteSandbox = (sandboxId: string) => {
    setSandboxes((prev) => prev.filter((s) => s.id !== sandboxId));
    if (activeSandboxId === sandboxId) {
      const remaining = sandboxes.filter((s) => s.id !== sandboxId);
      if (remaining.length > 0) {
        setActiveSandboxId(remaining[0].id);
      }
    }
  };

  // Admin Request Handlers: Direct connection to LangGraph Workflow
  const handleApproveAccessRequest = async (
    requestId: string,
    workflowId?: string,
    fingerprint?: string
  ) => {
    if (userRole !== 'admin') return;
    // 1. Update access request status
    setAccessRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'approved',
              decidedAt: 'Just now',
              decidedBy: 'admin@sandbox.internal',
            }
          : r
      )
    );

    // 2. Resume real LangGraph workflow
    const matchingSandbox = sandboxes.find(
      (s) => s.workflowId === workflowId || s.id === workflowId
    );

    if (matchingSandbox) {
      await handleApprovePlan(matchingSandbox.id);
    } else if (workflowId) {
      try {
        await sandboxApi.approveWorkflow(workflowId, {
          approved: true,
          plan_fingerprint: fingerprint,
        });
      } catch (e) {
        console.warn('Backend approval call error:', e);
      }
    }

    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        actor: 'admin@sandbox.internal',
        action: 'ACCESS_REQUEST_APPROVED',
        target: requestId,
        status: 'success',
        details: `Access request ${requestId} approved by cluster administrator. LangGraph checkpoint resumed.`,
      },
      ...prev,
    ]);
  };

  const handleRejectAccessRequest = async (
    requestId: string,
    workflowId?: string,
    reason?: string
  ) => {
    if (userRole !== 'admin') return;
    // 1. Update access request status
    setAccessRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              status: 'rejected',
              decidedAt: 'Just now',
              decidedBy: 'admin@sandbox.internal',
            }
          : r
      )
    );

    // 2. Reject real LangGraph workflow
    const matchingSandbox = sandboxes.find(
      (s) => s.workflowId === workflowId || s.id === workflowId
    );

    if (matchingSandbox) {
      await handleRejectPlan(matchingSandbox.id, reason);
    } else if (workflowId) {
      try {
        await sandboxApi.rejectWorkflow(
          workflowId,
          reason || 'Security policy rejection by cluster admin.'
        );
      } catch (e) {
        console.warn('Backend rejection call error:', e);
      }
    }

    setAuditLogs((prev) => [
      {
        id: `aud-${Date.now()}`,
        timestamp: new Date().toTimeString().split(' ')[0],
        actor: 'admin@sandbox.internal',
        action: 'ACCESS_REQUEST_REJECTED',
        target: requestId,
        status: 'warning',
        details: `Access request ${requestId} rejected by cluster admin. Reason: ${
          reason || 'Security policy rejection'
        }.`,
      },
      ...prev,
    ]);
  };

  // Filter click on KPI card
  const handleKpiFilterClick = (status: 'all' | 'running' | 'failed' | 'success') => {
    setHistoryFilter(status);
    setActiveTab('history');
  };

  const runningCount = sandboxes.filter((s) => s.status === 'running').length;
  const pendingRequestsCount = accessRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0e14] text-neutral-100 font-sans">
      {/* 2. Expandable / Collapsible Sidebar */}
      <Sidebar
        role={userRole}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'history') {
            setHistoryFilter('all');
          }
        }}
        activeSandboxesCount={runningCount}
        pendingRequestsCount={pendingRequestsCount}
        collapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onSwitchRole={handleSwitchRole}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto">
        {/* 3. Main Header with Breadcrumb, Cluster Status, and Role Switcher */}
        <Header
          role={userRole}
          activeTab={activeTab}
          backendHealth={backendHealth}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onOpenRoleModal={() => setIsDemoLoginModalOpen(true)}
        />

        {/* API Notification Banner */}
        {apiNotification && (
          <div
            className={`mx-6 mt-3 px-4 py-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
              apiNotification.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                : apiNotification.type === 'error'
                ? 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                : 'bg-violet-950/40 border-violet-500/40 text-violet-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {apiNotification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : apiNotification.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              ) : (
                <Terminal className="w-4 h-4 text-violet-400 shrink-0" />
              )}
              <span>{apiNotification.message}</span>
            </div>
            <button
              onClick={() => setApiNotification(null)}
              className="text-neutral-400 hover:text-neutral-200 text-xs ml-3 font-mono cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* Global Action Required: Human Approval Gate Banner */}
        {(() => {
          const awaitingSbx = sandboxes.find((s) => s.status === 'awaiting_approval');
          if (!awaitingSbx) return null;

          if (userRole === 'admin') {
            return (
              <div className="mx-6 mt-3 px-4 py-3 rounded-xl bg-amber-950/30 border border-amber-500/50 text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-lg shadow-amber-950/20">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                        Action Required: Human Approval Gate
                      </span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-300">
                        Operator Sign-off
                      </span>
                    </div>
                    <div className="text-xs text-neutral-300">
                      Agent has analyzed <span className="font-semibold text-white">{awaitingSbx.repoOwner}/{awaitingSbx.repoName}</span> ({awaitingSbx.branch}). Proposed {awaitingSbx.proposedPlan?.length || 3} setup commands require explicit authorization before execution.
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDetailModalSandbox(awaitingSbx)}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold cursor-pointer transition-colors"
                  >
                    Inspect Plan & Safety
                  </button>
                  <button
                    onClick={() => handleRejectPlan(awaitingSbx.id, 'User rejected via dashboard banner.')}
                    className="px-3 py-1.5 rounded-lg bg-neutral-900/80 hover:bg-neutral-800 text-neutral-300 border border-neutral-700 text-xs font-medium cursor-pointer transition-colors"
                  >
                    Reject
                  </button>
                  <button
                    onClick={() => handleApprovePlan(awaitingSbx.id)}
                    disabled={isBootstrapping}
                    className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{isBootstrapping ? 'Authorizing...' : 'Authorize & Boot'}</span>
                  </button>
                </div>
              </div>
            );
          }

          // For Developer role: Read-only pending approval banner
          return (
            <div className="mx-6 mt-3 px-4 py-3 rounded-xl bg-amber-950/20 border border-amber-500/30 text-amber-200 flex flex-wrap items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
                  <Clock className="w-4 h-4 animate-pulse" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-300">
                      Setup Plan Awaiting Administrator Approval
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-400">
                      Review Pending
                    </span>
                  </div>
                  <div className="text-xs text-neutral-300">
                    Agent prepared the setup plan for <span className="font-semibold text-white">{awaitingSbx.repoOwner}/{awaitingSbx.repoName}</span> ({awaitingSbx.branch}). Commands will execute once an administrator reviews and authorizes the plan.
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDetailModalSandbox(awaitingSbx)}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-semibold cursor-pointer transition-colors flex items-center gap-1.5"
                >
                  Inspect Plan & Status
                </button>
              </div>
            </div>
          );
        })()}

        {/* Dynamic Page Views */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* ========================================================= */}
          {/* TAB: DEVELOPER OVERVIEW (CLEAN, FOCUSED, SCANNABLE)       */}
          {/* ========================================================= */}
          {userRole === 'developer' && activeTab === 'overview' && (
            <DeveloperOverview
              role={userRole}
              sandboxes={sandboxes}
              activeSandbox={activeSandbox}
              onSelectSandbox={(sbx) => setDetailModalSandbox(sbx)}
              onCreateSandbox={() => setActiveTab('new-sandbox')}
              onOpenPreview={(sbx) => setPreviewModalSandbox(sbx)}
              onRetrySandbox={(sbx) => handleRetrySandbox(sbx)}
              onStopSandbox={handleStopSandbox}
              onViewAllHistory={() => {
                setHistoryFilter('all');
                setActiveTab('history');
              }}
              isRetrying={isBootstrapping}
            />
          )}

          {/* ========================================================= */}
          {/* TAB: NEW SANDBOX PAGE                                     */}
          {/* ========================================================= */}
          {userRole === 'developer' && activeTab === 'new-sandbox' && (
            <div className="max-w-4xl space-y-4">
              <div>
                <h2 className="text-base font-bold text-neutral-100">
                  Provision New Sandbox
                </h2>
                <p className="text-xs text-neutral-400 mt-1">
                  Connect any GitHub repository. The bootstrapper will inspect project manifests, install dependencies in a sandboxed cgroup, and perform readiness verification.
                </p>
              </div>

              <RepositoryForm
                onSubmit={handleCreateSandbox}
                isLoading={isBootstrapping}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: SANDBOX HISTORY                                      */}
          {/* ========================================================= */}
          {userRole === 'developer' && activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-neutral-100">
                    Sandbox Execution History
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Audit past boot sequences, inspect timelines, and retry failed environments.
                  </p>
                </div>
                <button
                  onClick={() => setActiveTab('new-sandbox')}
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-violet-950/40"
                >
                  New Sandbox
                </button>
              </div>

              <SandboxHistoryView
                role={userRole}
                sandboxes={sandboxes}
                initialFilter={historyFilter}
                onSelectSandbox={(sbx) => setDetailModalSandbox(sbx)}
                onRetrySandbox={(sbx) => handleRetrySandbox(sbx)}
                onStopSandbox={handleStopSandbox}
                onDeleteSandbox={handleDeleteSandbox}
                onOpenPreview={(sbx) => setPreviewModalSandbox(sbx)}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB: SUPPORTED RUNTIMES                                   */}
          {/* ========================================================= */}
          {userRole === 'developer' && activeTab === 'runtimes' && (
            <SupportedRuntimesView />
          )}

          {/* ========================================================= */}
          {/* TAB: SETTINGS                                             */}
          {/* ========================================================= */}
          {userRole === 'developer' && activeTab === 'settings' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-base font-bold text-neutral-100">
                  Cluster & Sandbox Settings
                </h2>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Configure default runtime versions, container resource limits, and lease cleanup policies.
                </p>
              </div>

              <SettingsView />
            </div>
          )}

          {/* ========================================================= */}
          {/* ADMINISTRATOR WORKSPACE PAGES                             */}
          {/* ========================================================= */}
          {userRole === 'admin' && (
            <AdminWorkspace
              activeTab={activeTab as AdminNavTab}
              sandboxes={sandboxes}
              accessRequests={accessRequests}
              onApproveRequest={handleApproveAccessRequest}
              onRejectRequest={handleRejectAccessRequest}
              developers={developers}
              auditLogs={auditLogs}
              onSelectSandbox={(sbx) => setDetailModalSandbox(sbx)}
              onStopSandbox={handleStopSandbox}
              onNavigateTab={(tab) => setActiveTab(tab)}
            />
          )}
        </main>
      </div>

      {/* MODAL 1: DETAILED SANDBOX INSPECTION (WITH SETUP TIMELINE & APPROVAL ACTIONS) */}
      {detailModalSandbox && (
        <DetailedSandboxModal
          role={userRole}
          sandbox={detailModalSandbox}
          onClose={() => setDetailModalSandbox(null)}
          onRetry={(sbx, withFix) => handleRetrySandbox(sbx, withFix)}
          onResubmitClarification={(sbx) => {
            setDetailModalSandbox(null);
            setActiveTab('new-sandbox');
          }}
          onOpenPreview={() => {
            const sbx = detailModalSandbox;
            setDetailModalSandbox(null);
            setPreviewModalSandbox(sbx);
          }}
          onApprove={(sbx) => handleApprovePlan(sbx.id)}
          onReject={(sbx, reason) => handleRejectPlan(sbx.id, reason)}
          isApproving={isBootstrapping}
        />
      )}

      {/* MODAL 2: MOCK BROWSER PREVIEW */}
      {previewModalSandbox && (
        <MockPreviewModal
          sandbox={previewModalSandbox}
          onClose={() => setPreviewModalSandbox(null)}
        />
      )}

      {/* MODAL 3: DEMO LOGIN / ROLE SWITCHER */}
      <DemoLoginModal
        isOpen={isDemoLoginModalOpen}
        onClose={() => setIsDemoLoginModalOpen(false)}
        currentRole={userRole}
        onSelectRole={handleSwitchRole}
      />
    </div>
  );
}
