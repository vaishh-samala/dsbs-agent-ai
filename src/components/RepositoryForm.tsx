import React, { useState, useEffect } from 'react';
import {
  Github,
  GitBranch,
  Cpu,
  Layers,
  Plus,
  Trash2,
  Play,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Settings2,
  CheckCircle2,
  ShieldCheck,
  Check,
} from 'lucide-react';
import { PackageManager, RuntimeType } from '../types/sandbox';
import { REPO_PRESETS, RepoPreset } from '../data/repoPresets';
import {
  sandboxApi,
  buildSetupManifestPayload,
  ValidationResult,
  ApiError,
} from '../services/api';

interface RepositoryFormProps {
  onSubmit: (formData: {
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
  }) => void;
  isLoading?: boolean;
}

export const RepositoryForm: React.FC<RepositoryFormProps> = ({
  onSubmit,
  isLoading = false,
}) => {
  const [repoUrl, setRepoUrl] = useState('https://github.com/shadcn/taxonomy');
  const [branch, setBranch] = useState('main');
  const [runtime, setRuntime] = useState<RuntimeType>('node');
  const [runtimeVersion, setRuntimeVersion] = useState('Node.js 20.14.0 LTS');
  const [packageManager, setPackageManager] = useState<PackageManager>('pnpm');
  const [port, setPort] = useState(3000);
  const [startCommand, setStartCommand] = useState('pnpm dev');
  const [testCommand, setTestCommand] = useState('pnpm test');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([
    { key: 'PORT', value: '3000' },
    { key: 'NODE_ENV', value: 'development' },
  ]);
  const [simulateFailure, setSimulateFailure] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Form errors
  const [errors, setErrors] = useState<{ repoUrl?: string; branch?: string; port?: string }>({});

  // Backend manifest validation state
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [validationApiError, setValidationApiError] = useState<string | null>(null);

  const handleValidateManifest = async () => {
    if (!validate()) return;
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
      simulateFailure,
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

  // Sync default versions when runtime changes
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

  // Quick preset loader
  const handleApplyPreset = (preset: RepoPreset) => {
    setRepoUrl(preset.repoUrl);
    setBranch(preset.branch);
    setRuntime(preset.runtime);
    setRuntimeVersion(preset.runtimeVersion);
    setPackageManager(preset.packageManager);
    setPort(preset.port);
    setStartCommand(preset.startCommand);
    setTestCommand(preset.testCommand);
    setSimulateFailure(preset.expectedOutcome === 'failure');
    setErrors({});
  };

  // Add env var row
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

  // Validation
  const validate = () => {
    const newErrors: { repoUrl?: string; branch?: string; port?: string } = {};

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

    if (!port || port < 1024 || port > 65535) {
      newErrors.port = 'Port must be between 1024 and 65535';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

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
      simulateFailure,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Preset Quick-Selector */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-neutral-400 flex items-center justify-between">
          <span>QUICK LOAD VERIFIED TEMPLATES</span>
          <span className="text-[11px] text-neutral-400">Click to autofill configuration</span>
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {REPO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleApplyPreset(preset)}
              className={`p-2.5 rounded-lg border text-left transition-all ${
                repoUrl === preset.repoUrl
                  ? 'bg-indigo-600/10 border-indigo-500/50'
                  : 'bg-[#11141c] border-neutral-800 hover:border-neutral-700 hover:bg-[#151923]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-200 truncate">
                  {preset.name}
                </span>
                <span
                  className={`text-[10px] font-mono ${
                    preset.expectedOutcome === 'failure'
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}
                >
                  {preset.expectedOutcome === 'failure' ? 'Faulty' : 'Passing'}
                </span>
              </div>
              <p className="text-[11px] text-neutral-400 truncate mt-1">
                {preset.description}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-5 space-y-5">
        {/* Repo URL & Branch Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1.5">
            <label className="block text-xs font-medium text-neutral-300">
              GitHub Repository URL <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
                <Github className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => {
                  setRepoUrl(e.target.value);
                  if (errors.repoUrl) setErrors({ ...errors, repoUrl: undefined });
                }}
                placeholder="https://github.com/owner/repository"
                className={`w-full pl-9 pr-3 py-2 bg-[#0c0e14] border rounded-md text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 transition-colors ${
                  errors.repoUrl
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-neutral-800 focus:border-indigo-500 focus:ring-indigo-500'
                }`}
              />
            </div>
            {errors.repoUrl && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.repoUrl}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-300">
              Branch Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neutral-400">
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
                className={`w-full pl-9 pr-3 py-2 bg-[#0c0e14] border rounded-md text-xs text-neutral-100 placeholder-neutral-600 focus:outline-none focus:ring-1 transition-colors ${
                  errors.branch
                    ? 'border-rose-500 focus:border-rose-500 focus:ring-rose-500'
                    : 'border-neutral-800 focus:border-violet-500 focus:ring-violet-500'
                }`}
              />
            </div>
            {errors.branch && (
              <p className="text-[11px] text-rose-400 flex items-center gap-1 mt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                {errors.branch}
              </p>
            )}
          </div>
        </div>

        {/* Runtime Selection */}
        <div className="space-y-2 pt-2 border-t border-neutral-800/80">
          <label className="block text-xs font-medium text-neutral-300">
            Runtime Engine <span className="text-rose-400">*</span>
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Node.js Card */}
            <button
              type="button"
              onClick={() => handleRuntimeChange('node')}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                runtime === 'node'
                  ? 'bg-violet-600/15 border-violet-500/70 shadow-sm shadow-violet-950/30'
                  : 'bg-[#0c0e14] border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Node.js Environment
                </span>
                <span className="text-[11px] font-mono text-neutral-400">V8 LTS</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Optimized for Next.js, Vite, Express, Nest, and Nuxt apps
              </p>
            </button>

            {/* Python Card */}
            <button
              type="button"
              onClick={() => handleRuntimeChange('python')}
              className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                runtime === 'python'
                  ? 'bg-violet-600/15 border-violet-500/70 shadow-sm shadow-violet-950/30'
                  : 'bg-[#0c0e14] border-neutral-800 hover:border-neutral-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-100 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  Python Environment
                </span>
                <span className="text-[11px] font-mono text-neutral-400">CPython 3</span>
              </div>
              <p className="text-[11px] text-neutral-400 mt-1">
                Optimized for FastAPI, Django, Flask, Pytest, and AI APIs
              </p>
            </button>
          </div>
        </div>

        {/* Versions and Package Managers */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-300">
              Engine Version
            </label>
            <select
              value={runtimeVersion}
              onChange={(e) => setRuntimeVersion(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
            >
              {runtime === 'node' ? (
                <>
                  <option value="Node.js 20.14.0 LTS">Node.js 20.14.0 LTS (Iron - Recommended)</option>
                  <option value="Node.js 22.2.0">Node.js 22.2.0 (Current)</option>
                  <option value="Node.js 18.20.2 LTS">Node.js 18.20.2 LTS (Hydrogen)</option>
                </>
              ) : (
                <>
                  <option value="Python 3.11.9">Python 3.11.9 (Recommended)</option>
                  <option value="Python 3.12.3">Python 3.12.3 (Latest)</option>
                  <option value="Python 3.10.14">Python 3.10.14</option>
                </>
              )}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-neutral-300">
              Package Manager
            </label>
            <select
              value={packageManager}
              onChange={(e) => setPackageManager(e.target.value as PackageManager)}
              className="w-full px-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-xs text-neutral-200 focus:outline-none focus:border-indigo-500"
            >
              {runtime === 'node' ? (
                <>
                  <option value="pnpm">pnpm (Hardlinked content-addressable cache)</option>
                  <option value="npm">npm (Standard registry client)</option>
                  <option value="yarn">yarn (v1 Classic / Berry)</option>
                  <option value="bun">bun (Ultra-fast native runtime)</option>
                </>
              ) : (
                <>
                  <option value="poetry">poetry (Deterministic dependency resolver)</option>
                  <option value="pip">pip (Standard requirements.txt)</option>
                  <option value="uv">uv (Astral high-speed pip replacement)</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Collapsible Advanced Configuration */}
        <div className="pt-2 border-t border-neutral-800/80">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            <span>Advanced Configuration (Port, Commands, Env Vars)</span>
            {showAdvanced ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 bg-[#0a0c12] p-4 rounded-lg border border-neutral-800/60">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-neutral-400">
                    Host Port
                  </label>
                  <input
                    type="number"
                    value={port}
                    onChange={(e) => setPort(Number(e.target.value))}
                    className="w-full px-3 py-1.5 bg-[#0e1117] border border-neutral-800 rounded text-xs text-neutral-200 font-mono"
                  />
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-medium text-neutral-400">
                    Custom Start Command
                  </label>
                  <input
                    type="text"
                    value={startCommand}
                    onChange={(e) => setStartCommand(e.target.value)}
                    placeholder="e.g. npm run dev"
                    className="w-full px-3 py-1.5 bg-[#0e1117] border border-neutral-800 rounded text-xs text-neutral-200 font-mono"
                  />
                </div>
              </div>

              {/* Environment Variables Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-neutral-400">
                    Environment Variables
                  </span>
                  <button
                    type="button"
                    onClick={addEnvVar}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-medium"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Variable</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {envVars.map((env, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="KEY"
                        value={env.key}
                        onChange={(e) => updateEnvVar(idx, 'key', e.target.value)}
                        className="w-1/3 px-2.5 py-1.5 bg-[#0e1117] border border-neutral-800 rounded text-xs text-neutral-200 font-mono uppercase"
                      />
                      <input
                        type="text"
                        placeholder="VALUE"
                        value={env.value}
                        onChange={(e) => updateEnvVar(idx, 'value', e.target.value)}
                        className="flex-1 px-2.5 py-1.5 bg-[#0e1117] border border-neutral-800 rounded text-xs text-neutral-200 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => removeEnvVar(idx)}
                        className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800 rounded"
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

        {/* Failure Simulation Switch */}
        <div className="pt-2 flex items-center justify-between p-3 rounded-lg bg-neutral-900/50 border border-neutral-800 text-xs">
          <div>
            <div className="font-medium text-neutral-200 flex items-center gap-2">
              <span>Simulate Verification Failure</span>
              <span className="text-[10px] font-mono text-neutral-300">
                Demo Diagnostic Flow
              </span>
            </div>
            <p className="text-[11px] text-neutral-400 mt-0.5">
              Simulates a container health probe failure to test error summaries and retry actions.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSimulateFailure(!simulateFailure)}
            className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors ${
              simulateFailure ? 'bg-rose-600' : 'bg-neutral-800'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                simulateFailure ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Manifest Validation Feedback Panel */}
        {isValidating && (
          <div className="p-3.5 rounded-lg bg-[#0e121a] border border-violet-500/30 text-xs text-neutral-300 flex items-center gap-2.5 animate-pulse">
            <div className="w-3.5 h-3.5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin shrink-0" />
            <span>Validating manifest schema and runtime compatibility against FastAPI backend...</span>
          </div>
        )}

        {validationResult && validationResult.is_valid && (
          <div className="p-3.5 rounded-lg bg-emerald-950/20 border border-emerald-500/40 text-xs space-y-2">
            <div className="flex items-center gap-2 text-emerald-400 font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Manifest Validated Successfully (POST /api/v1/sandbox/validate)</span>
            </div>
            <div className="text-[11px] text-neutral-300 font-mono flex flex-wrap gap-x-3 gap-y-1">
              <span>Archetype: <strong className="text-neutral-100">{validationResult.normalized_manifest?.project_type}</strong></span>
              <span className="text-neutral-600">·</span>
              <span>Port: <strong className="text-neutral-100">{validationResult.normalized_manifest?.port}</strong></span>
              <span className="text-neutral-600">·</span>
              <span>Env Var Keys: <strong className="text-neutral-100">[{validationResult.normalized_manifest?.env_var_names?.join(', ') || 'PORT'}]</strong></span>
            </div>
            {validationResult.warnings && validationResult.warnings.length > 0 && (
              <div className="mt-1 pt-1.5 border-t border-emerald-900/40 text-[11px] text-amber-300 space-y-0.5">
                {validationResult.warnings.map((w, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <span className="text-amber-400 font-bold">!</span>
                    <span>{w}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {validationResult && !validationResult.is_valid && (
          <div className="p-3.5 rounded-lg bg-rose-950/25 border border-rose-500/40 text-xs space-y-2">
            <div className="flex items-center gap-2 text-rose-400 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>Manifest Validation Failed ({validationResult.errors.length} errors)</span>
            </div>
            <div className="space-y-1 pl-6 text-[11px] font-mono text-rose-300">
              {validationResult.errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <span className="text-rose-400 font-bold">•</span>
                  <span>
                    <strong className="text-rose-200">[{err.field}]</strong>: {err.message}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {validationApiError && (
          <div className="p-3 rounded-lg bg-rose-950/20 border border-rose-800/40 text-xs text-rose-300 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-semibold text-rose-300">Validation API Request Error</div>
              <div className="text-[11px] text-neutral-300 font-mono">{validationApiError}</div>
            </div>
          </div>
        )}

        {/* Submit Action */}
        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-[11px] text-neutral-400">
            Isolated Sandbox · 2 vCPU · 2048 MB RAM
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={handleValidateManifest}
              disabled={isValidating || isLoading}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-medium text-neutral-200 bg-neutral-800 hover:bg-neutral-700 active:bg-neutral-600 transition-colors cursor-pointer border border-neutral-700/60 disabled:opacity-50"
            >
              {isValidating ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-white rounded-full animate-spin" />
                  <span>Validating...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-neutral-400" />
                  <span>Validate Manifest</span>
                </>
              )}
            </button>

            <button
              type="submit"
              disabled={isLoading || isValidating}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-xs font-semibold text-white transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 cursor-pointer ${
                isLoading
                  ? 'bg-violet-600/50 cursor-not-allowed'
                  : 'bg-violet-600 hover:bg-violet-500 active:bg-violet-700 shadow-sm shadow-violet-950/40'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Bootstrapping Environment...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>Create Sandbox</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
};
