import React, { useState } from 'react';
import {
  Github,
  GitBranch,
  Cpu,
  Plus,
  Trash2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ShieldCheck,
  Check,
  Loader2,
  Sparkles,
  KeyRound,
  ArrowRight,
  ArrowLeft,
  Server,
  Layers,
  HelpCircle,
  FileCode,
  Lock,
} from 'lucide-react';
import {
  AccessScope,
  PackageManager,
  RuntimeType,
} from '../types/sandbox';
import { REPO_PRESETS, RepoPreset } from '../data/repoPresets';
import {
  sandboxApi,
  buildSetupManifestPayload,
  ValidationResult,
  ApiError,
} from '../services/api';

export interface SandboxFormData {
  repoUrl: string;
  branch: string;
  runtime: RuntimeType;
  runtimeVersion: string;
  packageManager: PackageManager;
  port: number;
  startCommand?: string;
  testCommand?: string;
  envVars: { key: string; value: string }[];
  requestedScope: AccessScope;
  accessReason: string;
  simulateFailure: boolean;
}

interface RepositoryFormProps {
  onSubmit: (formData: SandboxFormData) => void;
  isLoading?: boolean;
}

export const RepositoryForm: React.FC<RepositoryFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  // Stepper state (1: Connect Repo, 2: Configure Env, 3: Permissions, 4: Review & Create)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form inputs
  const [repoUrl, setRepoUrl] = useState('https://github.com/shadcn/taxonomy');
  const [branch, setBranch] = useState('main');
  const [runtime, setRuntime] = useState<RuntimeType>('node');
  const [runtimeVersion, setRuntimeVersion] = useState('Node.js 20.14.0 LTS');
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm');
  const [port, setPort] = useState(3000);
  const [startCommand, setStartCommand] = useState('pnpm dev');
  const [testCommand, setTestCommand] = useState('pnpm test');
  const [requestedScope, setRequestedScope] = useState<AccessScope>('sandbox_debug');
  const [accessReason, setAccessReason] = useState('Feature development and local readiness testing');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: 'PORT', value: '3000' },
    { key: 'NODE_ENV', value: 'development' },
  ]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Validation state
  const [errors, setErrors] = useState<{
    repoUrl?: string;
    branch?: string;
    port?: string;
    accessReason?: string;
  }>({});

  // Backend manifest validation
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationApiError, setValidationApiError] = useState<string | null>(null);

  const handleValidateManifest = async () => {
    if (!validateStep1()) return;
    setIsValidating(true);
    setValidationResult(null);
    setValidationApiError(null);

    const payload = buildSetupManifestPayload({
      repoUrl,
      branch,
      runtime,
      runtimeVersion,
      packageManager,
      port,
      startCommand: startCommand.trim() || undefined,
      testCommand: testCommand.trim() || undefined,
      envVars: envVars.filter((v) => v.key.trim() !== ''),
      simulateFailure: false,
    });

    try {
      const res = await sandboxApi.validateManifest(payload);
      setValidationResult(res);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setValidationApiError(err.message);
        if (err.errors && err.errors.length > 0) {
          setValidationResult({
            is_valid: false,
            errors: err.errors,
            warnings: [],
          });
        }
      } else {
        setValidationApiError((err as Error)?.message || 'Failed to connect to backend.');
      }
    } finally {
      setIsValidating(false);
    }
  };

  const handleRuntimeChange = (newRuntime: RuntimeType) => {
    setRuntime(newRuntime);
    if (newRuntime === 'node') {
      setRuntimeVersion('Node.js 20.14.0 LTS');
      setPackageManager('pnpm');
      setPort(3000);
      setStartCommand('pnpm dev');
      setTestCommand('pnpm test');
    } else {
      setRuntimeVersion('Python 3.11.9');
      setPackageManager('poetry');
      setPort(8000);
      setStartCommand('poetry run uvicorn app.main:app --port 8000');
      setTestCommand('poetry run pytest');
    }
  };

  const handleApplyPreset = (preset: RepoPreset) => {
    setRepoUrl(preset.repoUrl);
    setBranch(preset.branch);
    setRuntime(preset.runtime);
    setRuntimeVersion(preset.runtimeVersion);
    setPackageManager(preset.packageManager);
    setPort(preset.port);
    setStartCommand(preset.startCommand);
    setTestCommand(preset.testCommand);
    setErrors({});
    setValidationResult(null);
  };

  const addEnvVar = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...envVars];
    updated[index][field] = value;
    setEnvVars(updated);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const validateStep1 = () => {
    const newErrors: { repoUrl?: string; branch?: string } = {};
    if (!repoUrl.trim()) {
      newErrors.repoUrl = 'Repository URL is required';
    } else if (
      !repoUrl.includes('github.com/') &&
      !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repoUrl.trim())
    ) {
      newErrors.repoUrl = 'Enter a valid GitHub URL (e.g., https://github.com/owner/repo or owner/repo)';
    }

    if (!branch.trim()) {
      newErrors.branch = 'Branch name is required';
    }

    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors: { port?: string } = {};
    if (!port || port < 1024 || port > 65535) {
      newErrors.port = 'Port must be between 1024 and 65535';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const validateStep3 = () => {
    const newErrors: { accessReason?: string } = {};
    if (!accessReason.trim()) {
      newErrors.accessReason = 'Access justification is required for audit logs';
    }
    setErrors((prev) => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (currentStep === 1 && validateStep1()) setCurrentStep(2);
    else if (currentStep === 2 && validateStep2()) setCurrentStep(3);
    else if (currentStep === 3 && validateStep3()) setCurrentStep(4);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2() || !validateStep3()) return;

    onSubmit({
      repoUrl,
      branch,
      runtime,
      runtimeVersion,
      packageManager,
      port,
      startCommand: startCommand.trim() || undefined,
      testCommand: testCommand.trim() || undefined,
      envVars: envVars.filter((v) => v.key.trim() !== ''),
      requestedScope,
      accessReason,
      simulateFailure: false,
    });
  };

  const steps = [
    { num: 1, label: 'Repository', desc: 'Connect GitHub repo' },
    { num: 2, label: 'Environment', desc: 'Runtime & settings' },
    { num: 3, label: 'Permissions', desc: 'Sandbox access scope' },
    { num: 4, label: 'Review', desc: 'Verify & launch' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* 4-Step Stepper Navigation */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-3 shadow-sm">
        <div className="grid grid-cols-4 gap-2">
          {steps.map((st) => {
            const isCompleted = currentStep > st.num;
            const isCurrent = currentStep === st.num;
            return (
              <button
                key={st.num}
                type="button"
                onClick={() => {
                  if (st.num < currentStep) setCurrentStep(st.num as any);
                }}
                disabled={st.num > currentStep}
                className={`p-2.5 rounded-lg text-left transition-all flex items-center gap-2.5 cursor-pointer disabled:cursor-not-allowed ${
                  isCurrent
                    ? 'bg-violet-600/15 border border-violet-500/40 text-neutral-100'
                    : isCompleted
                    ? 'hover:bg-[#141a26] text-neutral-300'
                    : 'text-neutral-500 opacity-60'
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : isCurrent
                      ? 'bg-violet-600 text-white'
                      : 'bg-neutral-800 text-neutral-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-3.5 h-3.5" /> : st.num}
                </div>
                <div className="hidden sm:block min-w-0">
                  <div className="text-xs font-semibold truncate">{st.label}</div>
                  <div className="text-[10px] text-neutral-400 truncate">{st.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ========================================================= */}
        {/* STEP 1: CONNECT REPOSITORY                                 */}
        {/* ========================================================= */}
        {currentStep === 1 && (
          <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 sm:p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-neutral-100">Step 1: Connect Repository</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Specify the public or authorized GitHub repository and branch to bootstrap.
              </p>
            </div>

            {/* Quick Presets Pills */}
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                <span>Quick Presets</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {REPO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPreset(preset)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      repoUrl === preset.repoUrl
                        ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40 font-semibold'
                        : 'bg-[#141a26] text-neutral-400 hover:text-neutral-200 border border-[#232c3d]'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Repository URL Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-300">
                GitHub Repository URL <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <Github className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => {
                    setRepoUrl(e.target.value);
                    if (errors.repoUrl) setErrors({ ...errors, repoUrl: undefined });
                  }}
                  placeholder="https://github.com/shadcn/taxonomy"
                  className={`w-full pl-9 pr-3 py-2 bg-[#090b10] border rounded-lg text-xs font-mono text-neutral-200 focus:outline-none transition-colors ${
                    errors.repoUrl
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[#1e2433] focus:border-violet-500'
                  }`}
                />
              </div>
              {errors.repoUrl && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.repoUrl}</span>
                </p>
              )}
            </div>

            {/* Branch Name Input */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-300">
                Git Branch <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-500">
                  <GitBranch className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => {
                    setBranch(e.target.value);
                    if (errors.branch) setErrors({ ...errors, branch: undefined });
                  }}
                  placeholder="main"
                  className={`w-full pl-9 pr-3 py-2 bg-[#090b10] border rounded-lg text-xs font-mono text-neutral-200 focus:outline-none transition-colors ${
                    errors.branch
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[#1e2433] focus:border-violet-500'
                  }`}
                />
              </div>
              {errors.branch && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.branch}</span>
                </p>
              )}
            </div>

            {/* Manifest Validation Feedback */}
            <div className="pt-2 border-t border-[#1b2130] flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleValidateManifest}
                disabled={isValidating}
                className="px-3 py-1.5 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isValidating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-violet-400" />
                ) : (
                  <FileCode className="w-3.5 h-3.5 text-violet-400" />
                )}
                <span>{isValidating ? 'Validating Manifest...' : 'Verify Manifest with Backend'}</span>
              </button>

              {validationResult && validationResult.is_valid && (
                <span className="text-xs font-mono text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Manifest Validated ({validationResult.normalized_manifest?.project_type || 'archetype'})</span>
                </span>
              )}

              {validationApiError && (
                <span className="text-xs font-mono text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{validationApiError}</span>
                </span>
              )}
            </div>

            {/* Step 1 Actions */}
            <div className="flex items-center justify-end pt-4 border-t border-[#1b2130]">
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-violet-900/30 transition-all"
              >
                <span>Continue: Configure Environment</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 2: CONFIGURE ENVIRONMENT                              */}
        {/* ========================================================= */}
        {currentStep === 2 && (
          <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 sm:p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-neutral-100">Step 2: Configure Environment</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Select target engine, package manager, and network configuration.
              </p>
            </div>

            {/* Runtime Selection Cards */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-300">
                Target Language Runtime <span className="text-rose-400">*</span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleRuntimeChange('node')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    runtime === 'node'
                      ? 'bg-violet-600/15 border-violet-500/40 shadow-sm'
                      : 'bg-[#141a26] border-[#232c3d] hover:border-[#2f3b52] opacity-75'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-emerald-500/15 text-emerald-400 shrink-0">
                    <Cpu className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-100">Node.js Engine</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      Next.js, React, Express, Vite applications.
                    </div>
                    <div className="font-mono text-[10px] text-emerald-400 mt-2">
                      pnpm · npm · yarn · bun
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleRuntimeChange('python')}
                  className={`p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3 ${
                    runtime === 'python'
                      ? 'bg-violet-600/15 border-violet-500/40 shadow-sm'
                      : 'bg-[#141a26] border-[#232c3d] hover:border-[#2f3b52] opacity-75'
                  }`}
                >
                  <div className="p-2 rounded-lg bg-cyan-500/15 text-cyan-400 shrink-0">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-neutral-100">Python Engine</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">
                      FastAPI, Flask, Django microservices.
                    </div>
                    <div className="font-mono text-[10px] text-cyan-400 mt-2">
                      poetry · pip · uv virtualenv
                    </div>
                  </div>
                </button>
              </div>
            </div>

            {/* Version & Package Manager */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-300">Runtime Version</label>
                <select
                  value={runtimeVersion}
                  onChange={(e) => setRuntimeVersion(e.target.value)}
                  className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-xs text-neutral-200 focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  {runtime === 'node' ? (
                    <>
                      <option value="Node.js 20.14.0 LTS">Node.js 20.14.0 LTS (Iron)</option>
                      <option value="Node.js 22.2.0">Node.js 22.2.0 (Current)</option>
                      <option value="Node.js 18.20.2 LTS">Node.js 18.20.2 LTS (Hydrogen)</option>
                    </>
                  ) : (
                    <>
                      <option value="Python 3.11.9">Python 3.11.9 (Recommended)</option>
                      <option value="Python 3.12.3">Python 3.12.3 (Latest)</option>
                      <option value="Python 3.10.14">Python 3.10.14 (Legacy)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-neutral-300">Package Manager</label>
                <select
                  value={packageManager}
                  onChange={(e) => setPackageManager(e.target.value as PackageManager)}
                  className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-xs font-mono text-neutral-200 focus:outline-none focus:border-violet-500 cursor-pointer"
                >
                  {runtime === 'node' ? (
                    <>
                      <option value="pnpm">pnpm (Deterministic lockfile)</option>
                      <option value="npm">npm</option>
                      <option value="yarn">yarn</option>
                      <option value="bun">bun</option>
                    </>
                  ) : (
                    <>
                      <option value="poetry">poetry (Default)</option>
                      <option value="pip">pip</option>
                      <option value="uv">uv (Fast virtualenv)</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            {/* Port Binding */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-neutral-300">
                Application Port <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  value={port}
                  onChange={(e) => {
                    setPort(parseInt(e.target.value, 10) || 3000);
                    if (errors.port) setErrors({ ...errors, port: undefined });
                  }}
                  className={`w-full px-3 py-2 bg-[#090b10] border rounded-lg text-xs font-mono text-neutral-200 focus:outline-none transition-colors ${
                    errors.port
                      ? 'border-rose-500/80 focus:border-rose-500'
                      : 'border-[#1e2433] focus:border-violet-500'
                  }`}
                />
              </div>
              <p className="text-[11px] text-neutral-500">
                Will bind to isolated 127.0.0.1:{port} inside container sandbox.
              </p>
            </div>

            {/* Advanced Settings Accordion */}
            <div className="pt-2 border-t border-[#1b2130]">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center justify-between w-full text-xs font-medium text-neutral-400 hover:text-neutral-200 py-1 transition-colors cursor-pointer"
              >
                <span>Optional Advanced Configuration</span>
                {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showAdvanced && (
                <div className="mt-3 p-4 rounded-xl bg-[#090b10] border border-[#1e2433] space-y-4 text-xs animate-in fade-in duration-150">
                  <div className="space-y-1.5">
                    <label className="text-neutral-300 font-medium">Custom Start Command</label>
                    <input
                      type="text"
                      value={startCommand}
                      onChange={(e) => setStartCommand(e.target.value)}
                      placeholder={runtime === 'node' ? 'pnpm dev' : 'poetry run uvicorn app:app'}
                      className="w-full px-3 py-1.5 bg-[#0e121a] border border-[#1e2433] rounded-lg text-xs font-mono text-neutral-200 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-neutral-300 font-medium">Custom Test / Verification Command</label>
                    <input
                      type="text"
                      value={testCommand}
                      onChange={(e) => setTestCommand(e.target.value)}
                      placeholder={runtime === 'node' ? 'pnpm test' : 'pytest'}
                      className="w-full px-3 py-1.5 bg-[#0e121a] border border-[#1e2433] rounded-lg text-xs font-mono text-neutral-200 focus:outline-none"
                    />
                  </div>

                  {/* Environment Variables */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-300 font-medium">Environment Variables</span>
                      <button
                        type="button"
                        onClick={addEnvVar}
                        className="text-[11px] text-violet-400 hover:text-violet-300 font-medium flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Variable</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {envVars.map((env, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="text"
                            placeholder="KEY"
                            value={env.key}
                            onChange={(e) => updateEnvVar(i, 'key', e.target.value)}
                            className="w-1/2 px-2.5 py-1 bg-[#0e121a] border border-[#1e2433] rounded text-xs font-mono text-neutral-200"
                          />
                          <input
                            type="text"
                            placeholder="VALUE"
                            value={env.value}
                            onChange={(e) => updateEnvVar(i, 'value', e.target.value)}
                            className="w-1/2 px-2.5 py-1 bg-[#0e121a] border border-[#1e2433] rounded text-xs font-mono text-neutral-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeEnvVar(i)}
                            className="p-1 text-neutral-500 hover:text-rose-400 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1b2130]">
              <button
                type="button"
                onClick={() => setCurrentStep(1)}
                className="px-3.5 py-2 rounded-lg text-neutral-400 hover:text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-violet-900/30 transition-all"
              >
                <span>Continue: Request Permissions</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 3: REQUEST PERMISSIONS & ACCESS SCOPE                 */}
        {/* ========================================================= */}
        {currentStep === 3 && (
          <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 sm:p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-neutral-100">Step 3: Request Permissions & Scope</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Define the security boundaries and access permissions the container sandbox requires.
              </p>
            </div>

            {/* 3 Plain English Scope Cards */}
            <div className="space-y-3">
              {[
                {
                  id: 'read_only' as const,
                  title: 'Read-Only Inspection',
                  badge: 'Safest',
                  badgeColor: 'text-neutral-300 bg-neutral-800',
                  description:
                    'Inspects repository files and validates the setup manifest. No container processes or commands will be executed.',
                },
                {
                  id: 'sandbox_debug' as const,
                  title: 'Sandbox Execution (Recommended)',
                  badge: 'Standard Development',
                  badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                  description:
                    'Runs approved setup commands inside a cgroups v2 isolated container with rootless namespace, 2 vCPUs, 2048 MB RAM limit, and local loopback port binding.',
                },
                {
                  id: 'full_ports' as const,
                  title: 'Full Network & Port Forwarding',
                  badge: 'Elevated Access',
                  badgeColor: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
                  description:
                    'Permits binding additional container ports and enables external network connectivity for end-to-end integration tests.',
                },
              ].map((scope) => (
                <button
                  key={scope.id}
                  type="button"
                  onClick={() => setRequestedScope(scope.id)}
                  className={`w-full p-4 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                    requestedScope === scope.id
                      ? 'bg-violet-600/15 border-violet-500/40 shadow-sm'
                      : 'bg-[#141a26] border-[#232c3d] hover:border-[#2f3b52] opacity-75'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full border mt-0.5 flex items-center justify-center shrink-0 ${
                      requestedScope === scope.id
                        ? 'border-violet-500 bg-violet-600'
                        : 'border-neutral-600'
                    }`}
                  >
                    {requestedScope === scope.id && (
                      <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-neutral-100">{scope.title}</span>
                      <span className={`text-[10px] font-mono px-2 py-0.2 rounded border ${scope.badgeColor}`}>
                        {scope.badge}
                      </span>
                    </div>
                    <p className="text-xs text-neutral-400 leading-relaxed">
                      {scope.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/* Access Justification */}
            <div className="space-y-1.5 pt-2 border-t border-[#1b2130]">
              <label className="block text-xs font-medium text-neutral-300">
                Access Justification / Reason <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={2}
                value={accessReason}
                onChange={(e) => {
                  setAccessReason(e.target.value);
                  if (errors.accessReason) setErrors({ ...errors, accessReason: undefined });
                }}
                placeholder="e.g. Feature development, local verification tests, and smoke testing"
                className={`w-full px-3 py-2 bg-[#090b10] border rounded-lg text-xs text-neutral-200 focus:outline-none transition-colors ${
                  errors.accessReason
                    ? 'border-rose-500/80 focus:border-rose-500'
                    : 'border-[#1e2433] focus:border-violet-500'
                }`}
              />
              {errors.accessReason && (
                <p className="text-[11px] text-rose-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  <span>{errors.accessReason}</span>
                </p>
              )}
            </div>

            {/* Step 3 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1b2130]">
              <button
                type="button"
                onClick={() => setCurrentStep(2)}
                className="px-3.5 py-2 rounded-lg text-neutral-400 hover:text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-violet-900/30 transition-all"
              >
                <span>Continue: Review Configuration</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* STEP 4: REVIEW AND CREATE                                  */}
        {/* ========================================================= */}
        {currentStep === 4 && (
          <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 sm:p-6 space-y-5 shadow-sm">
            <div>
              <h2 className="text-sm font-bold text-neutral-100">Step 4: Review and Launch</h2>
              <p className="text-xs text-neutral-400 mt-0.5">
                Verify sandbox parameters before orchestrating the LangGraph agent setup workflow.
              </p>
            </div>

            {/* Configuration Summary Grid */}
            <div className="bg-[#090b10] border border-[#1e2433] rounded-xl p-4 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-[#1b2130]">
                <span className="text-neutral-400">Target Repository:</span>
                <span className="font-bold text-neutral-100">{repoUrl}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1b2130]">
                <span className="text-neutral-400">Git Branch:</span>
                <span className="text-violet-300 font-bold">{branch}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1b2130]">
                <span className="text-neutral-400">Runtime Engine:</span>
                <span className="text-neutral-200">{runtimeVersion} ({packageManager})</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-[#1b2130]">
                <span className="text-neutral-400">Loopback Port:</span>
                <span className="text-emerald-400 font-bold">:{port}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-neutral-400">Security Scope:</span>
                <span className="uppercase text-neutral-200 font-bold">{requestedScope}</span>
              </div>
            </div>

            {/* What Happens Next Explanation Card */}
            <div className="p-4 rounded-xl bg-violet-950/20 border border-violet-500/30 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-violet-300 font-bold">
                <ShieldCheck className="w-4 h-4 text-violet-400" />
                <span>What Happens After Creation:</span>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-neutral-300 leading-relaxed font-sans pl-1">
                <li>The LangGraph agent clones your repository reference in an isolated directory.</li>
                <li>It inspects dependencies and validates the project setup manifest.</li>
                <li>An execution plan is generated and presented for your explicit approval.</li>
                <li>Once approved, commands run inside rootless cgroups v2 sandbox container.</li>
                <li>Readiness probes verify port :{port} before marking the environment ready.</li>
              </ol>
            </div>

            {/* Step 4 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#1b2130]">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-3.5 py-2 rounded-lg text-neutral-400 hover:text-neutral-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back</span>
              </button>

              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-md shadow-violet-900/40 transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Bootstrapping Agent...</span>
                  </>
                ) : (
                  <>
                    <Server className="w-4 h-4" />
                    <span>Create Sandbox & Boot Agent</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
};
