import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveNavTab,
  ErrorSummary,
  PackageManager,
  RuntimeType,
  Sandbox,
  StepStatus,
  WorkflowStep,
  WorkflowStepId,
} from './types/sandbox';
import { INITIAL_MOCK_SANDBOXES } from './data/mockSandboxes';
import { parseRepoDetails, startSandboxSimulation } from './utils/sandboxSimulator';
import {
  sandboxApi,
  buildSetupManifestPayload,
  BACKEND_BASE_URL,
  BackendWorkflowStep,
} from './services/api';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewCards } from './components/OverviewCards';
import { RepositoryForm } from './components/RepositoryForm';
import { ActivityPanel } from './components/ActivityPanel';
import { EnvironmentDetails } from './components/EnvironmentDetails';
import { DetailedSandboxModal } from './components/DetailedSandboxModal';
import { SandboxHistoryView } from './components/SandboxHistoryView';
import { SettingsView } from './components/SettingsView';
import { MockPreviewModal } from './components/MockPreviewModal';
import {
  Github,
  RotateCcw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  XCircle,
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

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('overview');
  const [sandboxes, setSandboxes] = useState<Sandbox[]>(INITIAL_MOCK_SANDBOXES);
  const [activeSandboxId, setActiveSandboxId] = useState<string>(INITIAL_MOCK_SANDBOXES[0].id);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('all');

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

  // Query Backend Health on Mount
  useEffect(() => {
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
              const updatedSteps = mapBackendStepsToPipeline(statusRes.steps, s.steps);
              return {
                ...s,
                status:
                  statusRes.status === 'completed'
                    ? 'running'
                    : statusRes.status === 'failed'
                    ? 'failed'
                    : 'running',
                steps: updatedSteps,
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

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (cancelSimulationRef.current) {
        cancelSimulationRef.current();
      }
    };
  }, []);

  // Handle Form Submission / Start Simulation with Backend Setup & Polling
  const handleCreateSandbox = async (formData: {
    repoUrl: string;
    branch: string;
    runtime: RuntimeType;
    runtimeVersion: string;
    packageManager: PackageManager;
    port: number;
    startCommand?: string;
    testCommand?: string;
    envVars: { key: string; value: string }[];
    simulateFailure: boolean;
  }) => {
    setIsBootstrapping(true);

    // Cancel any ongoing fallback simulation
    if (cancelSimulationRef.current) {
      cancelSimulationRef.current();
      cancelSimulationRef.current = null;
    }

    const { owner, name } = parseRepoDetails(formData.repoUrl);
    const payload = buildSetupManifestPayload(formData);

    try {
      // 1. Submit setup workflow to FastAPI backend
      const initRes = await sandboxApi.createSandboxSetup(payload);
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
        approvalStatus: initRes.approval_status || (initRes.status === 'awaiting_approval' ? 'awaiting_approval' : undefined),
        planFingerprint: initRes.plan_fingerprint || undefined,
        proposedPlan: (initRes.execution_plan as any) || undefined,
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
      setActiveTab('overview');

      // If workflow is awaiting approval, stop here and prompt user to approve
      if (initRes.status === 'awaiting_approval') {
        setIsBootstrapping(false);
        setApiNotification({
          type: 'info',
          message: `Execution plan prepared (${initRes.execution_plan?.length || 0} steps). Review the commands below and approve to boot sandbox.`,
        });
        return;
      }

      // 2. Poll workflow status from FastAPI backend until terminal status
      const finalStatus = await sandboxApi.pollWorkflowStatus(newId, (prog) => {
        setSandboxes((prev) =>
          prev.map((s) => {
            if (s.id === newId) {
              const updatedSteps = mapBackendStepsToPipeline(prog.steps, s.steps);
              return {
                ...s,
                steps: updatedSteps,
                currentStepId:
                  updatedSteps.find((st) => st.status === 'running')?.id || s.currentStepId,
              };
            }
            return s;
          })
        );
      });

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
        },
        onFinish: () => {
          setIsBootstrapping(false);
        },
      });

      cancelSimulationRef.current = cancel;
      setActiveSandboxId(newId);
      setActiveTab('overview');
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
            previewUrl: isFailed || isRejected ? undefined : `http://localhost:${targetSandbox.env.port}`,
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
                      message: `Workflow halted cleanly at approval gate: ${finalStatus.rejection_reason || 'Plan rejected.'}`,
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
    const target = sandboxes.find((s) => s.id === sandboxId);
    if (!target || !target.workflowId) return;

    setIsBootstrapping(true);
    try {
      const apprRes = await sandboxApi.approveWorkflow(target.workflowId, {
        approved: true,
        plan_fingerprint: target.planFingerprint,
      });

      // Update sandbox state after resuming
      setSandboxes((prev) =>
        prev.map((s) => {
          if (s.id === sandboxId) {
            const updatedSteps = mapBackendStepsToPipeline(apprRes.steps, s.steps);
            return {
              ...s,
              status: apprRes.status === 'completed' ? 'running' : (apprRes.status as SandboxStatus),
              approvalStatus: 'approved',
              steps: updatedSteps,
              logs: [
                ...s.logs,
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

      // If already finished in synchronous execution
      if (apprRes.status === 'completed' || apprRes.status === 'failed') {
        finalizeWorkflowResult(sandboxId, apprRes, target);
        return;
      }

      // Poll until completed or failed
      const finalStatus = await sandboxApi.pollWorkflowStatus(target.workflowId, (prog) => {
        setSandboxes((prev) =>
          prev.map((s) => {
            if (s.id === sandboxId) {
              const updatedSteps = mapBackendStepsToPipeline(prog.steps, s.steps);
              return {
                ...s,
                steps: updatedSteps,
                currentStepId:
                  updatedSteps.find((st) => st.status === 'running')?.id || s.currentStepId,
              };
            }
            return s;
          })
        );
      });

      finalizeWorkflowResult(sandboxId, finalStatus, target);
    } catch (err: unknown) {
      setApiNotification({
        type: 'error',
        message: `Approval failed: ${(err as Error)?.message || 'Unknown error'}`,
      });
      setTimeout(() => setApiNotification(null), 5000);
    } finally {
      setIsBootstrapping(false);
    }
  };

  // Handle Explicit User Rejection for Proposed Execution Plan
  const handleRejectPlan = async (sandboxId: string, reason?: string) => {
    const target = sandboxes.find((s) => s.id === sandboxId);
    if (!target || !target.workflowId) return;

    try {
      const rejRes = await sandboxApi.rejectWorkflow(
        target.workflowId,
        reason || 'User rejected execution plan.',
        target.planFingerprint
      );

      finalizeWorkflowResult(sandboxId, rejRes, target);
    } catch (err: unknown) {
      setApiNotification({
        type: 'error',
        message: `Rejection failed: ${(err as Error)?.message || 'Unknown error'}`,
      });
      setTimeout(() => setApiNotification(null), 5000);
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

  // Filter click on KPI card
  const handleKpiFilterClick = (status: 'all' | 'running' | 'failed' | 'success') => {
    setHistoryFilter(status);
    setActiveTab('history');
  };

  const runningCount = sandboxes.filter((s) => s.status === 'running').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0c0e14] text-neutral-100 font-sans">
      {/* 2. Left Sidebar Branded "Sandbox Bootstrapper" */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'history') {
            setHistoryFilter('all');
          }
        }}
        activeSandboxesCount={runningCount}
      />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col h-screen min-w-0 overflow-y-auto">
        {/* 3. Main Header with Breadcrumb, Cluster Status, and Create Sandbox CTA */}
        <Header
          activeTab={activeTab}
          backendHealth={backendHealth}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
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

        {/* Dynamic Page Views */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* 4. Four Summary KPI Cards */}
              <OverviewCards
                sandboxes={sandboxes}
                onFilterClick={handleKpiFilterClick}
              />

              {activeSandbox ? (
                <div className="space-y-5">
                  {/* 5. Repository Summary Row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 bg-[#11141c] border border-neutral-800 rounded-lg px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded bg-neutral-900 border border-neutral-800 text-neutral-300">
                        <Github className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-neutral-200">
                            {activeSandbox.repoOwner}/{activeSandbox.repoName}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <span className="font-mono text-xs text-neutral-400">
                            {activeSandbox.branch}
                          </span>
                          <span className="text-neutral-600">·</span>
                          <span className="text-neutral-400 text-xs font-mono">
                            {activeSandbox.id}
                          </span>
                        </div>
                        <div className="text-[11px] text-neutral-400 mt-0.5">
                          {activeSandbox.runtimeVersion} · {activeSandbox.packageManager} · Created {activeSandbox.createdAt}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={activeSandbox.id}
                        onChange={(e) => setActiveSandboxId(e.target.value)}
                        className="px-2.5 py-1.5 bg-[#0c0e14] border border-neutral-800 rounded text-xs text-neutral-300 focus:outline-none"
                      >
                        {sandboxes.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.repoName} ({s.id}) - {s.status.toUpperCase()}
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => setDetailModalSandbox(activeSandbox)}
                        className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors"
                      >
                        Inspect Details
                      </button>

                      <button
                        onClick={() => handleRetrySandbox(activeSandbox)}
                        disabled={isBootstrapping}
                        className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <RotateCcw className={`w-3 h-3 ${isBootstrapping ? 'animate-spin' : ''}`} />
                        <span>Re-run</span>
                      </button>
                    </div>
                  </div>

                  {/* Execution Plan Approval Gate Card */}
                  {activeSandbox.status === 'awaiting_approval' && (
                    <div className="bg-[#11141c] border-2 border-violet-500/50 rounded-xl p-5 sm:p-6 shadow-[0_0_30px_rgba(139,92,246,0.15)] space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-800">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-violet-500/20 border border-violet-500/40 text-violet-300">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-sm font-bold text-neutral-100 tracking-tight">
                                Action Required: Review & Approve Execution Plan
                              </h3>
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold uppercase bg-violet-500/20 text-violet-300 border border-violet-500/30">
                                Approval Gate
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-0.5">
                              The agent analyzed the setup manifest and prepared the execution steps below. No commands run until you approve.
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleRejectPlan(activeSandbox.id)}
                            disabled={isBootstrapping}
                            className="px-3.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 border border-rose-700/50 text-rose-300 text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject Plan</span>
                          </button>

                          <button
                            onClick={() => handleApprovePlan(activeSandbox.id)}
                            disabled={isBootstrapping}
                            className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md shadow-emerald-950/50 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            {isBootstrapping ? (
                              <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Approve Plan & Boot Sandbox</span>
                          </button>
                        </div>
                      </div>

                      {/* Plan Fingerprint & Sandbox Isolation Notice */}
                      <div className="flex flex-wrap items-center justify-between text-xs text-neutral-400 bg-[#0c0e14] px-3.5 py-2 rounded-lg border border-neutral-800/80 gap-2 font-mono">
                        <div className="flex items-center gap-2">
                          <span className="text-neutral-500">Plan Fingerprint:</span>
                          <span className="text-violet-300 select-all">
                            {activeSandbox.planFingerprint || 'sha256:pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-emerald-400 text-[11px]">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Restricted Sandbox Executor Isolation</span>
                        </div>
                      </div>

                      {/* Steps List */}
                      <div className="space-y-2">
                        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                          Proposed Commands ({activeSandbox.proposedPlan?.length || 0} steps)
                        </div>
                        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                          {activeSandbox.proposedPlan && activeSandbox.proposedPlan.length > 0 ? (
                            activeSandbox.proposedPlan.map((step) => (
                              <div
                                key={step.step}
                                className="flex items-start justify-between gap-3 p-2.5 rounded-lg bg-[#0e1118] border border-neutral-800 text-xs"
                              >
                                <div className="flex items-start gap-2.5 min-w-0">
                                  <span className="px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 font-mono text-[11px] shrink-0">
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
                            ))
                          ) : (
                            <div className="p-3 text-xs text-neutral-500 font-mono italic text-center">
                              Standard setup commands configured from manifest.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rejection notice if status is rejected */}
                  {activeSandbox.status === 'rejected' && (
                    <div className="bg-rose-950/20 border border-rose-500/40 rounded-xl p-4 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded bg-rose-500/20 text-rose-300 shrink-0">
                          <XCircle className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-semibold text-rose-300">Execution Plan Rejected</div>
                          <div className="text-neutral-400 text-[11px] mt-0.5">
                            {activeSandbox.rejectionReason || 'Execution was halted at the approval gate without running commands.'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRetrySandbox(activeSandbox)}
                        className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors shrink-0"
                      >
                        Re-plan Setup
                      </button>
                    </div>
                  )}

                  {/* Environment Details (~45%) & Activity Console (~55%) */}
                  <div className="flex flex-col lg:flex-row gap-6 items-stretch">
                    {/* Environment Details Panel (approx. 45% width) */}
                    <div className="w-full lg:w-[45%] flex flex-col">
                      <EnvironmentDetails
                        env={activeSandbox.env}
                        status={activeSandbox.status}
                        repoName={activeSandbox.repoName}
                        branch={activeSandbox.branch}
                        healthStatus={activeSandbox.healthStatus}
                        previewUrl={activeSandbox.previewUrl}
                        onOpenPreview={() => setPreviewModalSandbox(activeSandbox)}
                        onRestart={() => handleRetrySandbox(activeSandbox)}
                        onViewDiagnostics={() => setDetailModalSandbox(activeSandbox)}
                        isRetrying={isBootstrapping}
                      />
                    </div>

                    {/* Activity Console Panel (approx. 55% width) */}
                    <div className="w-full lg:w-[55%] flex flex-col">
                      <ActivityPanel
                        logs={activeSandbox.logs}
                        activeStepFilter={selectedWorkflowStep}
                        isRunning={isBootstrapping}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center rounded-lg bg-[#11141c] border border-neutral-800 space-y-4">
                  <Terminal className="w-10 h-10 mx-auto text-neutral-500" />
                  <h3 className="text-sm font-semibold text-neutral-200">
                    No Active Sandbox
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-md mx-auto">
                    Connect a repository to automatically parse dependencies, launch an isolated environment, and verify health checks.
                  </p>
                  <button
                    onClick={() => setActiveTab('new-sandbox')}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-semibold cursor-pointer transition-colors shadow-sm shadow-violet-950/40"
                  >
                    Create Your First Sandbox
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: NEW SANDBOX */}
          {activeTab === 'new-sandbox' && (
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

          {/* TAB 3: SANDBOX HISTORY */}
          {activeTab === 'history' && (
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
                  className="px-3.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-md transition-colors cursor-pointer shadow-sm shadow-violet-950/40"
                >
                  New Sandbox
                </button>
              </div>

              <SandboxHistoryView
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

          {/* TAB 4: SETTINGS */}
          {activeTab === 'settings' && (
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
        </main>
      </div>

      {/* MODAL 1: DETAILED SANDBOX INSPECTION */}
      {detailModalSandbox && (
        <DetailedSandboxModal
          sandbox={detailModalSandbox}
          onClose={() => setDetailModalSandbox(null)}
          onRetry={(sbx, withFix) => handleRetrySandbox(sbx, withFix)}
          onOpenPreview={() => {
            const sbx = detailModalSandbox;
            setDetailModalSandbox(null);
            setPreviewModalSandbox(sbx);
          }}
        />
      )}

      {/* MODAL 2: MOCK BROWSER PREVIEW */}
      {previewModalSandbox && (
        <MockPreviewModal
          sandbox={previewModalSandbox}
          onClose={() => setPreviewModalSandbox(null)}
        />
      )}
    </div>
  );
}
