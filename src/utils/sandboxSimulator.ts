import {
  ErrorSummary,
  LogEntry,
  PackageManager,
  RuntimeType,
  Sandbox,
  StepStatus,
  WorkflowStep,
  WorkflowStepId,
} from '../types/sandbox';

interface SimulateOptions {
  sandboxId: string;
  name: string;
  repoUrl: string;
  branch: string;
  runtime: RuntimeType;
  runtimeVersion: string;
  packageManager: PackageManager;
  startCommand?: string;
  testCommand?: string;
  port?: number;
  envVars: { key: string; value: string }[];
  simulateFailure?: boolean;
  onUpdate: (updated: Sandbox) => void;
  onFinish?: (final: Sandbox) => void;
}

export function parseRepoDetails(url: string) {
  let clean = url.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '');
  const parts = clean.split('/');
  if (parts.length >= 2) {
    return { owner: parts[0], name: parts[1] };
  }
  return { owner: 'developer', name: clean || 'sample-repo' };
}

export function startSandboxSimulation(options: SimulateOptions): () => void {
  const { owner, name } = parseRepoDetails(options.repoUrl);
  const formatTime = () => {
    const d = new Date();
    return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  const initialSteps: WorkflowStep[] = [
    {
      id: 'inspection',
      title: 'Repository Inspection',
      description: 'Cloning git ref, analyzing directory tree, detecting runtime manifests',
      status: 'pending',
    },
    {
      id: 'dependencies',
      title: 'Dependency Installation',
      description: `Resolving lockfiles and downloading isolated dependencies via ${options.packageManager}`,
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

  let currentSandbox: Sandbox = {
    id: options.sandboxId,
    workflowId: options.sandboxId,
    name: options.name || `${name}-${options.branch}`,
    repoUrl: options.repoUrl,
    repoOwner: owner,
    repoName: name,
    branch: options.branch,
    runtime: options.runtime,
    runtimeVersion: options.runtimeVersion,
    packageManager: options.packageManager,
    createdAt: 'Just now',
    status: 'running',
    currentStage: 'inspection',
    currentMessage: 'Agent is inspecting your repository...',
    progressPercentage: 15,
    currentStepId: 'inspection',
    steps: initialSteps,
    logs: [
      {
        id: `log-${Date.now()}-0`,
        timestamp: formatTime(),
        level: 'info',
        stepId: 'inspection',
        message: `Bootstrapping sandbox worker for ${options.repoUrl} @ refs/heads/${options.branch}`,
      },
    ],
    env: {
      detectedRuntime: options.runtimeVersion,
      runtimeVersion: options.runtimeVersion.replace(/[^0-9.]/g, ''),
      packageManager: options.packageManager,
      detectedDependencies: options.runtime === 'node' ? 36 : 22,
      dependenciesList:
        options.runtime === 'node'
          ? ['react', 'next', 'tailwindcss', 'typescript', 'vite', 'zod', 'dotenv']
          : ['fastapi', 'uvicorn', 'pydantic', 'pytest', 'alembic', 'requests'],
      port: options.port || (options.runtime === 'node' ? 3000 : 8000),
      startCommand:
        options.startCommand ||
        (options.runtime === 'node'
          ? `${options.packageManager} run dev`
          : `${options.packageManager} run uvicorn main:app`),
      testCommand:
        options.testCommand ||
        (options.runtime === 'node' ? `${options.packageManager} test` : 'pytest -v'),
      healthEndpoint: `http://127.0.0.1:${options.port || (options.runtime === 'node' ? 3000 : 8000)}/health`,
      memoryMb: 2048,
      cpuCores: 2,
      leaseExpiresAt: 'In 60 minutes',
    },
    envVars: options.envVars.length > 0 ? options.envVars : [
      { key: 'PORT', value: String(options.port || (options.runtime === 'node' ? 3000 : 8000)) },
      { key: 'NODE_ENV', value: 'development' },
    ],
  };

  options.onUpdate({ ...currentSandbox });

  let isCancelled = false;
  const timeouts: NodeJS.Timeout[] = [];

  const updateStep = (stepId: WorkflowStepId, status: StepStatus, extra?: Partial<WorkflowStep>) => {
    if (isCancelled) return;
    currentSandbox = {
      ...currentSandbox,
      currentStepId: status === 'running' ? stepId : currentSandbox.currentStepId,
      steps: currentSandbox.steps.map((s) => (s.id === stepId ? { ...s, status, ...extra } : s)),
    };
    options.onUpdate({ ...currentSandbox });
  };

  const addLog = (level: LogEntry['level'], stepId: WorkflowStepId, message: string) => {
    if (isCancelled) return;
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formatTime(),
      level,
      stepId,
      message,
    };
    currentSandbox = {
      ...currentSandbox,
      logs: [...currentSandbox.logs, newLog],
    };
    options.onUpdate({ ...currentSandbox });
  };

  // STEP 1: Repository Inspection (0ms - 900ms)
  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      updateStep('inspection', 'running', { startedAt: 'Just now' });
      addLog('info', 'inspection', `Cloning shallow git tree for ref: refs/heads/${options.branch}...`);
    }, 200)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      addLog('stdout', 'inspection', `Enumerating objects: 148, done.\nCounting objects: 100% (148/148), done.`);
      addLog('info', 'inspection', `Detected manifest: ${options.runtime === 'node' ? 'package.json, lockfile' : 'pyproject.toml, requirements.txt'}`);
      addLog('success', 'inspection', `Repository inspection complete. Target: ${options.runtimeVersion} (${options.packageManager})`);
      updateStep('inspection', 'completed', { durationMs: 920, completedAt: 'Just now' });

      // STEP 2: PAUSE AT HUMAN APPROVAL GATE
      const proposedPlan = [
        {
          step: 1,
          phase: 'environment_provisioning',
          command: `init-container --runtime ${options.runtime} --version ${options.runtimeVersion}`,
          description: `Allocate isolated virtual container and configure ${options.runtime} ${options.runtimeVersion}`,
          is_safe: true,
        },
        {
          step: 2,
          phase: 'dependency_resolution',
          command: options.runtime === 'node' ? `${options.packageManager} install` : `${options.packageManager} install --no-root`,
          description: `Resolve package lockfiles and cache dependencies using ${options.packageManager}`,
          is_safe: true,
        },
      ];
      const planFingerprint = 'sha256:' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      currentSandbox = {
        ...currentSandbox,
        status: 'awaiting_approval',
        approvalStatus: 'awaiting_approval',
        approvalRequired: true,
        planFingerprint,
        proposedPlan,
        currentStage: 'approval',
        currentMessage: 'Agent prepared execution plan. Awaiting human approval.',
        progressPercentage: 50,
        stages: [
          {
            id: 'inspection',
            number: 1,
            title: 'Repository Inspection',
            description: 'Discover project files, identify the project type, inspect dependency manifests, and validate configuration.',
            status: 'completed',
            message: 'Repository inspection completed.',
          },
          {
            id: 'planning',
            number: 2,
            title: 'Setup Planning',
            description: 'Generate the ordered setup plan and proposed commands.',
            status: 'completed',
            message: 'Setup plan generated successfully.',
          },
          {
            id: 'approval',
            number: 3,
            title: 'Human Approval',
            description: 'Display the proposed commands, plan summary, and plan fingerprint.',
            status: 'waiting_for_approval',
            message: 'Waiting for your approval.',
            details: {
              plan_fingerprint: planFingerprint,
              is_awaiting: true,
            },
          },
          {
            id: 'execution',
            number: 4,
            title: 'Sandbox Execution',
            description: 'Execute approved setup commands inside simulated sandbox boundaries.',
            status: 'pending',
            message: 'Pending user approval.',
          },
          {
            id: 'verification',
            number: 5,
            title: 'Environment Verification',
            description: 'Probe service readiness and execute smoke assertions.',
            status: 'pending',
            message: 'Pending container execution.',
          },
          {
            id: 'final_result',
            number: 6,
            title: 'Final Result',
            description: 'Final container bootstrap status and diagnostics summary.',
            status: 'pending',
            message: 'Awaiting operator authorization.',
          },
        ],
        evaluationResult: {
          decision: 'APPROVE_FOR_REVIEW',
          request_summary: `Bootstrap ${options.runtime} sandbox for ${options.repoUrl} @ ${options.branch}`,
          repository_findings: [
            `Detected runtime manifest for ${options.runtime}`,
            `Package manager ${options.packageManager} validated against sandbox cluster rules`,
          ],
          compatibility_issues: [],
          security_findings: [
            'Standard container isolation enforced; zero host privileges',
            'No prohibited commands detected in proposed sequence',
          ],
          validation_errors: [],
          warnings: [],
          proposed_commands: proposedPlan.map((p) => p.command),
          permission_justification: 'Standard sandbox execution permissions: isolated rootless cgroups namespace',
          verification_plan: [options.testCommand || (options.runtime === 'node' ? `${options.packageManager} test` : 'pytest')],
          reasoning_summary: `Request validated and APPROVED FOR HUMAN REVIEW. Runtime ${options.runtime} ${options.runtimeVersion} is compatible, package manager ${options.packageManager} aligned with environment, and security policies passed. Setup commands are prepared for explicit reviewer sign-off. [Deterministic Rule-Based Evaluation]`,
          clarification_questions: [],
        },
      };

      addLog('info', 'inspection', `Execution plan prepared (${proposedPlan.length} steps). Paused at approval gate awaiting human approval.`);
      options.onUpdate({ ...currentSandbox });
      if (options.onFinish) {
        options.onFinish({ ...currentSandbox });
      }
    }, 1100)
  );

  return () => {
    isCancelled = true;
    timeouts.forEach(clearTimeout);
  };
}

export function resumeSandboxSimulation(
  sandbox: Sandbox,
  approved: boolean,
  reason: string | undefined,
  onUpdate: (updated: Sandbox) => void,
  onFinish?: (final: Sandbox) => void
): () => void {
  const formatTime = () => {
    const d = new Date();
    return d.toTimeString().split(' ')[0] + '.' + String(d.getMilliseconds()).padStart(3, '0');
  };

  let currentSandbox = { ...sandbox };
  let isCancelled = false;
  const timeouts: NodeJS.Timeout[] = [];

  const addLog = (level: LogEntry['level'], stepId: WorkflowStepId, message: string) => {
    if (isCancelled) return;
    const newLog: LogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: formatTime(),
      level,
      stepId,
      message,
    };
    currentSandbox = {
      ...currentSandbox,
      logs: [...currentSandbox.logs, newLog],
    };
    onUpdate({ ...currentSandbox });
  };

  const updateStep = (stepId: WorkflowStepId, status: StepStatus, extra?: Partial<WorkflowStep>) => {
    if (isCancelled) return;
    currentSandbox = {
      ...currentSandbox,
      currentStepId: status === 'running' ? stepId : currentSandbox.currentStepId,
      steps: currentSandbox.steps.map((s) => (s.id === stepId ? { ...s, status, ...extra } : s)),
    };
    onUpdate({ ...currentSandbox });
  };

  if (!approved) {
    // REJECTION
    currentSandbox = {
      ...currentSandbox,
      status: 'rejected',
      approvalStatus: 'rejected',
      rejectionReason: reason || 'Operator rejected setup plan.',
      currentStage: 'approval',
      currentMessage: 'Setup plan rejected. Execution halted.',
      stages: (currentSandbox.stages || []).map((st) => {
        if (st.id === 'approval') return { ...st, status: 'rejected' as const, message: reason || 'Plan rejected by user.' };
        if (st.id === 'execution' || st.id === 'verification') return { ...st, status: 'skipped' as const, message: 'Skipped due to rejection.' };
        if (st.id === 'final_result') return { ...st, status: 'rejected' as const, message: 'Setup rejected.' };
        return st;
      }),
    };
    addLog('warn', 'inspection', `Execution plan rejected: ${reason || 'User rejected execution plan.'}. Execution cancelled.`);
    onUpdate({ ...currentSandbox });
    if (onFinish) onFinish({ ...currentSandbox });
    return () => {};
  }

  // APPROVED: RESUME EXECUTION
  currentSandbox = {
    ...currentSandbox,
    status: 'running',
    approvalStatus: 'approved',
    currentStage: 'execution',
    currentMessage: 'Agent is executing approved setup commands...',
    progressPercentage: 65,
    stages: (currentSandbox.stages || []).map((st) => {
      if (st.id === 'approval') return { ...st, status: 'completed' as const, message: 'Plan authorized by user.' };
      if (st.id === 'execution') return { ...st, status: 'running' as const, message: 'Agent is executing the approved setup plan...' };
      return st;
    }),
  };
  addLog('success', 'dependencies', 'Setup plan authorized. Resuming container execution.');
  onUpdate({ ...currentSandbox });

  // Execution Step 2: Dependencies
  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      updateStep('dependencies', 'running', { startedAt: 'Just now' });
      addLog('info', 'dependencies', `Running package installation: ${currentSandbox.packageManager} install`);
      addLog('stdout', 'dependencies', `Resolving lockfiles and downloading isolated dependencies...`);
    }, 300)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      addLog('success', 'dependencies', `Dependencies installed cleanly with 0 security advisories.`);
      updateStep('dependencies', 'completed', { durationMs: 950, completedAt: 'Just now' });

      // Step 3: Configuration
      updateStep('configuration', 'running', { startedAt: 'Just now' });
      addLog('info', 'configuration', `Configuring virtual cgroups container (2 Cores, 2048 MB RAM)`);
      addLog('info', 'configuration', `Allocated port ${currentSandbox.env.port} on virtual bridge tap0`);
    }, 1100)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      addLog('success', 'configuration', `Environment configuration successfully provisioned.`);
      updateStep('configuration', 'completed', { durationMs: 780, completedAt: 'Just now' });

      // Step 4: Verification
      currentSandbox = {
        ...currentSandbox,
        currentStage: 'verification',
        currentMessage: 'Agent is verifying the environment...',
        progressPercentage: 85,
        stages: (currentSandbox.stages || []).map((st) => {
          if (st.id === 'execution') return { ...st, status: 'completed' as const, message: 'Approved setup commands executed.' };
          if (st.id === 'verification') return { ...st, status: 'running' as const, message: 'Probing readiness and health...' };
          return st;
        }),
      };
      updateStep('verification', 'running', { startedAt: 'Just now' });
      addLog('info', 'verification', `Executing start command: ${currentSandbox.env.startCommand}`);
      addLog('info', 'verification', `Sending HTTP probe GET ${currentSandbox.env.healthEndpoint}`);
      onUpdate({ ...currentSandbox });
    }, 1900)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      addLog('success', 'verification', `HTTP probe response 200 OK received in 38ms`);
      addLog('success', 'verification', `Sandbox verified and live! Ready for developer testing.`);

      updateStep('verification', 'completed', { durationMs: 820, completedAt: 'Just now' });

      currentSandbox = {
        ...currentSandbox,
        status: 'running',
        currentStage: 'completed',
        currentMessage: 'Setup completed successfully',
        progressPercentage: 100,
        previewUrl: `http://localhost:${currentSandbox.env.port}`,
        healthStatus: {
          healthy: true,
          latencyMs: 38,
          statusCode: 200,
          checkedAt: 'Just now',
        },
        stages: (currentSandbox.stages || []).map((st) => {
          if (st.id === 'verification') return { ...st, status: 'completed' as const, message: 'Readiness check passed.' };
          if (st.id === 'final_result') return { ...st, status: 'completed' as const, message: 'Setup completed successfully.' };
          return st;
        }),
      };

      onUpdate({ ...currentSandbox });
      if (onFinish) onFinish({ ...currentSandbox });
    }, 2800)
  );

  return () => {
    isCancelled = true;
    timeouts.forEach(clearTimeout);
  };
}
