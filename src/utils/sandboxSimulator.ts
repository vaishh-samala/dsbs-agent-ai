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
  const now = new Date();
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
    }, 1100)
  );

  // STEP 2: Dependency Installation (1200ms - 2800ms)
  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      updateStep('dependencies', 'running', { startedAt: 'Just now' });
      addLog('info', 'dependencies', `Running package installation: ${options.packageManager} install`);
      addLog('stdout', 'dependencies', `Fetching package metadata from registry mirror...\nResolving dependencies tree...`);
    }, 1300)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      if (options.runtime === 'node') {
        addLog('stdout', 'dependencies', `Lockfile up to date. Downloaded 36 tarballs in 1.1s. Verified checksums with SHA-512.`);
      } else {
        addLog('stdout', 'dependencies', `Collecting wheel cache: fastapi (0.111.0), uvicorn (0.29.0), pydantic (2.7.1). Installed 22 packages.`);
      }
      addLog('success', 'dependencies', `Dependencies installed cleanly with 0 security advisories.`);
      updateStep('dependencies', 'completed', { durationMs: 1650, completedAt: 'Just now' });
    }, 2800)
  );

  // STEP 3: Environment Configuration (3000ms - 4200ms)
  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      updateStep('configuration', 'running', { startedAt: 'Just now' });
      addLog('info', 'configuration', `Configuring virtual cgroups container (2 Cores, 2048 MB RAM)`);
      addLog('info', 'configuration', `Injecting ${options.envVars.length || 2} environment variables: ${options.envVars.map(v => v.key).join(', ') || 'PORT, NODE_ENV'}`);
      addLog('info', 'configuration', `Allocated port ${currentSandbox.env.port} on virtual bridge tap0`);
    }, 3000)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      addLog('success', 'configuration', `Environment configuration successfully provisioned.`);
      updateStep('configuration', 'completed', { durationMs: 1180, completedAt: 'Just now' });
    }, 4200)
  );

  // STEP 4: Verification (4400ms - 6000ms)
  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;
      updateStep('verification', 'running', { startedAt: 'Just now' });
      addLog('info', 'verification', `Executing start command: ${currentSandbox.env.startCommand}`);
      addLog('stdout', 'verification', `Starting process in PID namespace 4821...\nReady on http://localhost:${currentSandbox.env.port}`);
      addLog('info', 'verification', `Sending HTTP probe GET ${currentSandbox.env.healthEndpoint}`);
    }, 4400)
  );

  timeouts.push(
    setTimeout(() => {
      if (isCancelled) return;

      if (options.simulateFailure) {
        // SIMULATED FAILURE
        addLog('error', 'verification', `Health probe timeout: Connection refused on port ${currentSandbox.env.port}`);
        addLog('error', 'verification', `Worker process terminated with non-zero exit code 1`);
        addLog('error', 'verification', `Error: Missing required database socket connection at 127.0.0.1:5432`);

        const errorSummary: ErrorSummary = {
          title: 'Verification Health Check Failed',
          message: `The sandbox process started but failed readiness probes on port ${currentSandbox.env.port}. The service requires an external backing service that was not configured.`,
          step: 'verification',
          exitCode: 1,
          suggestedFix: 'Add MOCK_DATABASE=true or use a local SQLite connection string in the Environment Variables section.',
          stackTrace: `Error: connect ECONNREFUSED 127.0.0.1:5432
    at TCPConnectWrap.afterConnect [as oncomplete] (node:net:1494:16)
    at verifyReadinessProbe (/sandbox/runner.js:84:12)
    at async bootstrapSandbox (/sandbox/runner.js:142:5)`,
        };

        updateStep('verification', 'failed', {
          durationMs: 2400,
          completedAt: 'Just now',
          error: errorSummary.message,
        });

        currentSandbox = {
          ...currentSandbox,
          status: 'failed',
          errorSummary,
        };
      } else {
        // SIMULATED SUCCESS
        addLog('success', 'verification', `HTTP probe response 200 OK received in 42ms`);
        addLog('success', 'verification', `Running automated smoke tests: 4/4 assertions passed`);
        addLog('success', 'verification', `Sandbox verified and live! Ready for developer testing.`);

        updateStep('verification', 'completed', {
          durationMs: 1850,
          completedAt: 'Just now',
        });

        currentSandbox = {
          ...currentSandbox,
          status: 'running',
          previewUrl: `http://localhost:${currentSandbox.env.port}`,
          healthStatus: {
            healthy: true,
            latencyMs: 42,
            statusCode: 200,
            checkedAt: 'Just now',
          },
        };
      }

      options.onUpdate({ ...currentSandbox });
      if (options.onFinish) {
        options.onFinish({ ...currentSandbox });
      }
    }, 6200)
  );

  return () => {
    isCancelled = true;
    timeouts.forEach(clearTimeout);
  };
}
