import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Terminal,
  FileCode,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Sparkles,
  Download,
  Search,
  Filter,
  Layers,
  Cpu,
  GitBranch,
  Package,
  Code2,
  Loader2,
  CheckCheck,
} from 'lucide-react';
import { Sandbox, WorkflowStepId, LogEntry } from '../types/sandbox';

interface DetailedSandboxModalProps {
  sandbox: Sandbox;
  onClose: () => void;
  onRetry?: (sandbox: Sandbox, withSuggestedFix?: boolean) => void;
  onOpenPreview?: () => void;
}

export const DetailedSandboxModal: React.FC<DetailedSandboxModalProps> = ({
  sandbox,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'timeline' | 'manifest' | 'logs' | 'error'>('timeline');
  const [copiedFix, setCopiedFix] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedLogs, setCopiedLogs] = useState(false);

  // Expanded stage logs in Timeline view
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({
    inspection: false,
    dependencies: false,
    configuration: false,
    verification: false,
  });

  // Raw logs search and filtering
  const [logSearch, setLogSearch] = useState('');
  const [logLevelFilter, setLogLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success' | 'stdout'>('all');

  const isFailed = sandbox.status === 'failed';
  const isRunning = sandbox.status === 'running';
  const isCompleted = sandbox.status === 'success' || sandbox.status === 'running';

  // Toggle stage logs expansion
  const toggleStepLogs = (stepId: string) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  // Copy sandbox ID
  const handleCopyId = () => {
    navigator.clipboard.writeText(sandbox.id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Copy suggested fix
  const handleCopyFix = () => {
    if (sandbox.errorSummary?.suggestedFix) {
      navigator.clipboard.writeText(sandbox.errorSummary.suggestedFix);
      setCopiedFix(true);
      setTimeout(() => setCopiedFix(false), 2000);
    }
  };

  // Mock manifest generator based on active sandbox
  const manifestContent = useMemo(() => {
    if (sandbox.runtime === 'node') {
      return JSON.stringify(
        {
          name: sandbox.repoName,
          version: '1.0.0',
          private: true,
          description: `Isolated sandbox runtime for ${sandbox.repoName}`,
          scripts: {
            dev: sandbox.env?.startCommand || 'npm run dev',
            build: `${sandbox.packageManager} run build`,
            test: sandbox.env?.testCommand || 'npm test',
            lint: 'eslint . --ext .ts,.tsx',
            start: 'node .output/server/index.mjs',
          },
          dependencies: {
            next: '^14.2.3',
            react: '^18.3.1',
            'react-dom': '^18.3.1',
            tailwindcss: '^3.4.1',
            zod: '^3.23.8',
            'lucide-react': '^0.378.0',
          },
          devDependencies: {
            typescript: '^5.4.5',
            '@types/node': '^20.12.7',
            '@types/react': '^18.3.1',
            postcss: '^8.4.38',
            vitest: '^1.6.0',
          },
          engines: {
            node: '>=20.0.0',
            pnpm: '>=9.0.0',
          },
        },
        null,
        2
      );
    }

    return `[tool.poetry]
name = "${sandbox.repoName}"
version = "0.1.0"
description = "FastAPI backend containerized sandbox"
authors = ["Sandbox Runner <runner@sandbox-cluster.internal>"]
readme = "README.md"
packages = [{include = "app"}]

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.111.0"
uvicorn = {extras = ["standard"], version = "^0.29.0"}
pydantic = "^2.7.1"
sqlalchemy = "^2.0.30"
httpx = "^0.27.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.2.0"
pytest-asyncio = "^0.23.6"
ruff = "^0.4.4"
mypy = "^1.10.0"

[build-system]
requires = ["poetry-core"]
build-backend = "poetry.core.masonry.api"

[tool.pytest.ini_options]
minversion = "6.0"
addopts = "-ra -q"
testpaths = ["tests"]`;
  }, [sandbox]);

  // Copy manifest
  const handleCopyManifest = () => {
    navigator.clipboard.writeText(manifestContent);
    setCopiedManifest(true);
    setTimeout(() => setCopiedManifest(false), 2000);
  };

  // Filtered raw logs
  const filteredLogs = useMemo(() => {
    return sandbox.logs.filter((log) => {
      const matchesLevel = logLevelFilter === 'all' || log.level === logLevelFilter;
      const matchesSearch =
        !logSearch.trim() ||
        log.message.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.stepId.toLowerCase().includes(logSearch.toLowerCase()) ||
        log.level.toLowerCase().includes(logSearch.toLowerCase());
      return matchesLevel && matchesSearch;
    });
  }, [sandbox.logs, logLevelFilter, logSearch]);

  // Copy all/filtered logs
  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.stepId}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedLogs(true);
    setTimeout(() => setCopiedLogs(false), 2000);
  };

  // Download logs file
  const handleDownloadLogs = () => {
    const text = sandbox.logs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.stepId}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sandbox.id}-execution-trace.log`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Total execution duration
  const totalDurationSeconds = useMemo(() => {
    const totalMs = sandbox.steps.reduce((acc, step) => acc + (step.durationMs || 0), 0);
    return (totalMs / 1000).toFixed(2);
  }, [sandbox.steps]);

  // Get logs for a specific workflow step
  const getStepLogs = (stepId: WorkflowStepId) => {
    return sandbox.logs.filter((l) => l.stepId === stepId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e121a] border border-[#232936] rounded-xl max-w-5xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-neutral-200 font-sans">
        
        {/* ========================================================= */}
        {/* MODAL HEADER                                              */}
        {/* ========================================================= */}
        <div className="px-5 py-4 border-b border-[#1f2533] bg-[#0b0e14] flex flex-col md:flex-row md:items-center justify-between gap-3 shrink-0">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            {/* Status Icon with subtle border glow */}
            <div
              className={`p-2.5 rounded-lg shrink-0 ${
                isFailed
                  ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-[0_0_12px_rgba(244,63,94,0.15)]'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
              }`}
            >
              {isFailed ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-neutral-100 tracking-tight truncate">
                  {sandbox.repoName}
                </h2>
                <span className="text-neutral-600 font-mono text-xs">/</span>
                <div className="flex items-center gap-1 font-mono text-xs text-neutral-300 bg-[#161b26] px-2 py-0.5 rounded border border-[#2a3245]">
                  <GitBranch className="w-3 h-3 text-neutral-400" />
                  <span>{sandbox.branch}</span>
                </div>

                {/* Compact Status Badge */}
                <span
                  className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded font-semibold flex items-center gap-1.5 ${
                    sandbox.status === 'running'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : sandbox.status === 'failed'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                      : sandbox.status === 'success'
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                  }`}
                >
                  {sandbox.status === 'running' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                  )}
                  {sandbox.status === 'failed' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 inline-block" />
                  )}
                  {sandbox.status === 'success' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" />
                  )}
                  {sandbox.status}
                </span>
              </div>

              {/* Muted Metadata Row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-400 mt-1 font-mono">
                <button
                  onClick={handleCopyId}
                  className="flex items-center gap-1 text-neutral-400 hover:text-neutral-200 transition-colors group cursor-pointer"
                  title="Click to copy Sandbox ID"
                >
                  <span>ID: {sandbox.id}</span>
                  {copiedId ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3 text-neutral-500 group-hover:text-neutral-300" />
                  )}
                </button>
                <span className="text-neutral-600">·</span>
                <span>{sandbox.runtimeVersion}</span>
                <span className="text-neutral-600">·</span>
                <span className="capitalize">{sandbox.packageManager}</span>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-400 font-sans">Created {sandbox.createdAt}</span>
              </div>
            </div>
          </div>

          {/* Header Action Controls */}
          <div className="flex items-center gap-2 self-end md:self-center shrink-0">
            {/* Close Icon Button */}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-100 hover:bg-[#1a202e] border border-transparent hover:border-[#2a3346] transition-colors"
              aria-label="Close Diagnostics Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ========================================================= */}
        {/* NAVIGATION TABS (with Violet Underline Indicator)          */}
        {/* ========================================================= */}
        <div className="px-6 border-b border-[#1f2533] bg-[#0a0d13] flex items-center gap-6 text-xs font-medium shrink-0">
          <button
            onClick={() => setActiveTab('timeline')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'timeline'
                ? 'border-violet-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Setup Timeline</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activeTab === 'timeline'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {sandbox.steps.filter((s) => s.status === 'completed').length}/{sandbox.steps.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('manifest')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'manifest'
                ? 'border-violet-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>
              Detected Manifest ({sandbox.runtime === 'node' ? 'package.json' : 'pyproject.toml'})
            </span>
          </button>

          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3 border-b-2 flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'logs'
                ? 'border-violet-500 text-white font-semibold'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Raw Logs</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                activeTab === 'logs'
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'bg-neutral-800 text-neutral-400'
              }`}
            >
              {sandbox.logs.length}
            </span>
          </button>

          {isFailed && sandbox.errorSummary && (
            <button
              onClick={() => setActiveTab('error')}
              className={`py-3 border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ml-auto ${
                activeTab === 'error'
                  ? 'border-rose-500 text-rose-300 font-semibold'
                  : 'border-transparent text-rose-400/80 hover:text-rose-300'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
              <span>Error Diagnostics</span>
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* MODAL BODY (SCROLLABLE)                                   */}
        {/* ========================================================= */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 bg-[#0c0f16]">
          
          {/* TAB 1: SETUP TIMELINE */}
          {activeTab === 'timeline' && (
            <div className="space-y-6 max-w-4xl mx-auto">
              {/* Failure Highlight Banner if sandbox failed */}
              {isFailed && sandbox.errorSummary && (
                <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-800/40 space-y-3.5 shadow-lg">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-rose-400 font-semibold text-xs">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>{sandbox.errorSummary.title}</span>
                    </div>
                    <span className="text-[10px] font-mono text-rose-300 bg-rose-950/70 px-2 py-0.5 rounded border border-rose-800/60">
                      Exit Code {sandbox.errorSummary.exitCode || 1}
                    </span>
                  </div>

                  <p className="text-xs text-neutral-300 leading-relaxed font-sans">
                    {sandbox.errorSummary.message}
                  </p>

                  {/* Suggested Fix Container */}
                  <div className="p-3 bg-[#080b11] rounded-lg border border-rose-900/50 space-y-2">
                    <div className="text-[11px] font-medium text-neutral-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-violet-400 font-semibold">
                        <Sparkles className="w-3.5 h-3.5" />
                        Automated Remediation:
                      </span>
                      <button
                        onClick={handleCopyFix}
                        className="text-[10px] text-neutral-400 hover:text-neutral-200 flex items-center gap-1 font-mono transition-colors"
                      >
                        {copiedFix ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedFix ? 'Copied' : 'Copy Command'}</span>
                      </button>
                    </div>
                    <code className="text-xs font-mono text-emerald-400 block break-all bg-neutral-900/60 p-2 rounded border border-neutral-800">
                      {sandbox.errorSummary.suggestedFix}
                    </code>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-neutral-400">
                      Failed during step:{' '}
                      <span className="font-mono text-rose-300">{sandbox.errorSummary.step}</span>
                    </span>
                    <span className="text-[11px] font-mono text-neutral-400 bg-neutral-900/80 px-2 py-0.5 rounded border border-neutral-800">
                      Exit code: {sandbox.errorSummary.exitCode ?? 1}
                    </span>
                  </div>
                </div>
              )}

              {/* Diagnostic Flowchart Timeline */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs pb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-neutral-200 tracking-wider uppercase text-[11px]">
                      Workflow Diagnostic Pipeline
                    </span>
                    <span className="text-neutral-500 font-mono text-[11px]">
                      · {sandbox.steps.length} sequential stages
                    </span>
                  </div>
                  <span className="text-neutral-400 font-mono text-[11px]">
                    Total Duration: <strong className="text-neutral-200">{totalDurationSeconds}s</strong>
                  </span>
                </div>

                {/* Vertical Continuous Flowchart */}
                <div className="relative pl-1 sm:pl-2">
                  {sandbox.steps.map((step, idx) => {
                    const isLast = idx === sandbox.steps.length - 1;
                    const stepLogs = getStepLogs(step.id);
                    const isExpanded = !!expandedSteps[step.id];

                    // Status styling
                    const isStepCompleted = step.status === 'completed';
                    const isStepRunning = step.status === 'running';
                    const isStepFailed = step.status === 'failed';
                    const isStepPending = step.status === 'pending';

                    // Next step status for connector
                    const nextStep = !isLast ? sandbox.steps[idx + 1] : null;

                    return (
                      <div key={step.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
                        {/* Connecting Vertical Line */}
                        {!isLast && (
                          <div
                            className={`absolute left-[15px] sm:left-[19px] top-8 bottom-0 w-[2px] transition-colors ${
                              isStepCompleted && (nextStep?.status === 'completed' || nextStep?.status === 'running')
                                ? 'bg-emerald-500/50'
                                : isStepRunning
                                ? 'bg-gradient-to-b from-violet-500 to-neutral-800'
                                : isStepFailed
                                ? 'bg-rose-500/40'
                                : 'bg-[#1e2535]'
                            }`}
                          />
                        )}

                        {/* Circular Status Node */}
                        <div className="relative z-10 shrink-0 mt-0.5">
                          {isStepCompleted ? (
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.18)]">
                              <CheckCircle2 className="w-4 h-4" />
                            </div>
                          ) : isStepRunning ? (
                            <div className="w-8 h-8 rounded-full bg-violet-500/15 border border-violet-500/50 flex items-center justify-center text-violet-400 shadow-[0_0_12px_rgba(139,92,246,0.3)] animate-pulse">
                              <Loader2 className="w-4 h-4 animate-spin" />
                            </div>
                          ) : isStepFailed ? (
                            <div className="w-8 h-8 rounded-full bg-rose-500/15 border border-rose-500/40 flex items-center justify-center text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.2)]">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-[#141924] border border-[#232c3f] flex items-center justify-center text-neutral-500">
                              <Clock className="w-4 h-4" />
                            </div>
                          )}
                        </div>

                        {/* Stage Card */}
                        <div
                          className={`flex-1 min-w-0 rounded-xl p-4 border transition-all ${
                            isStepRunning
                              ? 'bg-[#121622] border-violet-500/40 shadow-md'
                              : isStepFailed
                              ? 'bg-[#161217] border-rose-800/40'
                              : isStepCompleted
                              ? 'bg-[#0f131c] border-[#1e2535] hover:border-[#2b354c]'
                              : 'bg-[#0d1016]/70 border-[#1a202c] opacity-80'
                          }`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-[#171d2b] border border-[#273248] text-neutral-400">
                                Phase 0{idx + 1}
                              </span>
                              <h4 className="text-xs font-bold text-neutral-100">{step.title}</h4>
                              <span
                                className={`text-[9px] font-mono uppercase px-2 py-0.5 rounded font-medium ${
                                  isStepCompleted
                                    ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                                    : isStepRunning
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                    : isStepFailed
                                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                    : 'bg-neutral-800 text-neutral-500'
                                }`}
                              >
                                {step.status}
                              </span>
                            </div>

                            {/* Duration */}
                            <div className="flex items-center gap-2">
                              {step.durationMs !== undefined && (
                                <span className="text-[11px] font-mono tabular-nums text-neutral-400 bg-neutral-900/60 px-2 py-0.5 rounded border border-neutral-800">
                                  {(step.durationMs / 1000).toFixed(2)}s
                                </span>
                              )}
                              {stepLogs.length > 0 && (
                                <button
                                  onClick={() => toggleStepLogs(step.id)}
                                  className="text-[11px] font-medium text-neutral-400 hover:text-neutral-200 flex items-center gap-1 transition-colors px-2 py-0.5 rounded hover:bg-neutral-800/80"
                                >
                                  <span>{stepLogs.length} logs</span>
                                  {isExpanded ? (
                                    <ChevronDown className="w-3 h-3 text-neutral-400" />
                                  ) : (
                                    <ChevronRight className="w-3 h-3 text-neutral-400" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>

                          <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-sans">
                            {step.description}
                          </p>

                          {/* Failure callout if step failed */}
                          {step.error && (
                            <div className="mt-2.5 text-xs font-mono text-rose-300 bg-rose-950/40 p-2.5 rounded-lg border border-rose-900/50 flex items-start gap-2">
                              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                              <div className="space-y-1">
                                <div className="font-semibold text-rose-400">Step Failure:</div>
                                <div className="text-neutral-300">{step.error}</div>
                              </div>
                            </div>
                          )}

                          {/* Expandable Stage Log Stream */}
                          {isExpanded && stepLogs.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[#1e2535] space-y-1 font-mono text-[11px]">
                              <div className="text-[10px] text-neutral-500 uppercase tracking-wider mb-1">
                                Step Execution Stream:
                              </div>
                              <div className="bg-[#090b10] border border-[#1b212f] rounded-lg p-3 max-h-48 overflow-y-auto space-y-1">
                                {stepLogs.map((log) => (
                                  <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                                    <span className="text-neutral-600 select-none shrink-0 font-mono">
                                      {log.timestamp}
                                    </span>
                                    <span
                                      className={`text-[9px] uppercase px-1 rounded select-none shrink-0 font-mono ${
                                        log.level === 'error'
                                          ? 'bg-rose-500/20 text-rose-400'
                                          : log.level === 'warn'
                                          ? 'bg-amber-500/20 text-amber-400'
                                          : log.level === 'success'
                                          ? 'bg-emerald-500/20 text-emerald-400'
                                          : 'bg-neutral-800 text-neutral-400'
                                      }`}
                                    >
                                      {log.level}
                                    </span>
                                    <span className="text-neutral-300 font-mono whitespace-pre-wrap break-all">
                                      {log.message}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DETECTED MANIFEST */}
          {activeTab === 'manifest' && (
            <div className="space-y-5 max-w-4xl mx-auto">
              {/* Manifest Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="p-3 bg-[#0f131c] border border-[#1f2637] rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-neutral-500">Runtime</div>
                  <div className="text-xs font-semibold text-neutral-200 mt-1 truncate">
                    {sandbox.runtime === 'node' ? 'Node.js' : 'Python'}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">{sandbox.runtimeVersion}</div>
                </div>

                <div className="p-3 bg-[#0f131c] border border-[#1f2637] rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-neutral-500">Package Manager</div>
                  <div className="text-xs font-semibold text-neutral-200 mt-1 capitalize">
                    {sandbox.packageManager}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">Lockfile verified</div>
                </div>

                <div className="p-3 bg-[#0f131c] border border-[#1f2637] rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-neutral-500">Framework</div>
                  <div className="text-xs font-semibold text-neutral-200 mt-1 truncate">
                    {sandbox.runtime === 'node' ? 'Next.js 14.2' : 'FastAPI 0.111'}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">Auto-detected</div>
                </div>

                <div className="p-3 bg-[#0f131c] border border-[#1f2637] rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-neutral-500">Dependencies</div>
                  <div className="text-xs font-semibold text-neutral-200 mt-1 font-mono">
                    {sandbox.env?.detectedDependencies || 42} direct
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400">0 vulnerabilities</div>
                </div>

                <div className="p-3 bg-[#0f131c] border border-[#1f2637] rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-neutral-500">HTTP Target</div>
                  <div className="text-xs font-semibold text-neutral-200 mt-1 font-mono">
                    Port {sandbox.env?.port || 3000}
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">127.0.0.1 bound</div>
                </div>

                <div className="p-3 bg-[#0f131c] border border-[#1f2637] rounded-lg">
                  <div className="text-[10px] uppercase font-mono text-neutral-500">Cgroup Quota</div>
                  <div className="text-xs font-semibold text-neutral-200 mt-1 font-mono">
                    {sandbox.env?.cpuCores || 2} CPU · {sandbox.env?.memoryMb || 2048}MB
                  </div>
                  <div className="text-[11px] font-mono text-neutral-400">Isolated namespace</div>
                </div>
              </div>

              {/* Detected Scripts Badges */}
              <div className="p-3.5 bg-[#0e121a] border border-[#1f2637] rounded-lg space-y-2">
                <div className="text-xs font-semibold text-neutral-300 flex items-center justify-between">
                  <span>Detected Lifecycle Scripts</span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    Parsed from {sandbox.runtime === 'node' ? 'package.json' : 'pyproject.toml'}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <div className="px-2.5 py-1 rounded bg-[#151a24] border border-[#263147] text-neutral-300">
                    <span className="text-violet-400">dev:</span> {sandbox.env?.startCommand || 'npm run dev'}
                  </div>
                  <div className="px-2.5 py-1 rounded bg-[#151a24] border border-[#263147] text-neutral-300">
                    <span className="text-violet-400">test:</span> {sandbox.env?.testCommand || 'npm test'}
                  </div>
                  <div className="px-2.5 py-1 rounded bg-[#151a24] border border-[#263147] text-neutral-300">
                    <span className="text-violet-400">build:</span> {sandbox.packageManager} run build
                  </div>
                  <div className="px-2.5 py-1 rounded bg-[#151a24] border border-[#263147] text-neutral-300">
                    <span className="text-violet-400">probe:</span> GET /
                  </div>
                </div>
              </div>

              {/* Manifest Code Viewer with Line Numbers */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-neutral-400" />
                    <span className="font-semibold text-neutral-200 font-mono">
                      {sandbox.runtime === 'node' ? 'package.json' : 'pyproject.toml'}
                    </span>
                    <span className="text-neutral-500 font-mono text-[11px]">
                      (Git commit head snapshot)
                    </span>
                  </div>
                  <button
                    onClick={handleCopyManifest}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#181d28] hover:bg-[#202738] border border-[#293245] text-neutral-300 text-xs font-medium transition-colors cursor-pointer"
                  >
                    {copiedManifest ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-300">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Copy File</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative bg-[#090b10] border border-[#1e2535] rounded-xl overflow-hidden font-mono text-xs">
                  <div className="max-h-[380px] overflow-y-auto p-4 leading-relaxed text-neutral-300">
                    <pre className="whitespace-pre overflow-x-auto text-[11.5px] font-mono selection:bg-violet-900/50">
                      {manifestContent}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RAW LOGS (TERMINAL VIEWER) */}
          {activeTab === 'logs' && (
            <div className="space-y-3 max-w-4xl mx-auto">
              {/* Terminal Toolbar: Search & Filter Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[#0a0d14] p-3 rounded-xl border border-[#1e2535]">
                {/* Search Filter */}
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={logSearch}
                    onChange={(e) => setLogSearch(e.target.value)}
                    placeholder="Search logs by keyword, phase, or level..."
                    className="w-full bg-[#11151f] border border-[#232a3b] rounded-lg pl-9 pr-8 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500 transition-colors font-sans"
                  />
                  {logSearch && (
                    <button
                      onClick={() => setLogSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Level Filter Buttons */}
                <div className="flex items-center gap-1 text-[11px] font-mono shrink-0">
                  <span className="text-neutral-500 text-xs mr-1 hidden md:inline">Level:</span>
                  {(['all', 'info', 'warn', 'error', 'success', 'stdout'] as const).map((lvl) => (
                    <button
                      key={lvl}
                      onClick={() => setLogLevelFilter(lvl)}
                      className={`px-2 py-1 rounded transition-colors uppercase font-medium ${
                        logLevelFilter === lvl
                          ? 'bg-violet-600 text-white font-semibold'
                          : 'bg-[#151924] text-neutral-400 hover:text-neutral-200 hover:bg-[#1a2130]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                {/* Actions: Copy & Download */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyLogs}
                    className="p-1.5 rounded-lg bg-[#141822] hover:bg-[#1d2332] border border-[#252d3f] text-neutral-300 transition-colors text-xs flex items-center gap-1.5 px-2.5"
                    title="Copy displayed logs"
                  >
                    {copiedLogs ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-neutral-400" />
                    )}
                    <span className="text-[11px] font-medium">{copiedLogs ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    onClick={handleDownloadLogs}
                    className="p-1.5 rounded-lg bg-[#141822] hover:bg-[#1d2332] border border-[#252d3f] text-neutral-300 transition-colors text-xs flex items-center gap-1.5 px-2.5"
                    title="Download complete execution trace"
                  >
                    <Download className="w-3.5 h-3.5 text-neutral-400" />
                    <span className="text-[11px] font-medium">Export</span>
                  </button>
                </div>
              </div>

              {/* Log Stream Terminal Container */}
              <div className="bg-[#080a0f] border border-[#1e2535] rounded-xl overflow-hidden shadow-inner">
                {/* Terminal Window Header Bar */}
                <div className="px-4 py-2 border-b border-[#181d28] bg-[#0c0f16] flex items-center justify-between text-[11px] text-neutral-400 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
                    <span className="text-neutral-500 ml-2">stdout / stderr stream</span>
                  </div>
                  <div>
                    Showing {filteredLogs.length} of {sandbox.logs.length} events
                  </div>
                </div>

                {/* Log Lines */}
                <div className="p-4 font-mono text-xs max-h-[460px] overflow-y-auto space-y-1.5 select-text">
                  {filteredLogs.length === 0 ? (
                    <div className="py-12 text-center text-neutral-500 space-y-2">
                      <Terminal className="w-6 h-6 mx-auto text-neutral-600" />
                      <p>No log records match the current search or filter criteria.</p>
                      <button
                        onClick={() => {
                          setLogSearch('');
                          setLogLevelFilter('all');
                        }}
                        className="text-violet-400 text-xs underline cursor-pointer"
                      >
                        Reset filters
                      </button>
                    </div>
                  ) : (
                    filteredLogs.map((log) => {
                      const isErr = log.level === 'error';
                      const isWarn = log.level === 'warn';
                      const isSucc = log.level === 'success';
                      const isStdout = log.level === 'stdout';

                      return (
                        <div
                          key={log.id}
                          className={`flex items-start gap-2.5 py-0.5 px-1.5 rounded transition-colors ${
                            isErr
                              ? 'bg-rose-950/20 text-rose-300'
                              : isWarn
                              ? 'bg-amber-950/15 text-amber-200'
                              : 'hover:bg-neutral-900/50 text-neutral-300'
                          }`}
                        >
                          {/* Timestamp */}
                          <span className="text-neutral-500 font-mono text-[11px] shrink-0 select-none">
                            {log.timestamp}
                          </span>

                          {/* Level Badge */}
                          <span
                            className={`text-[9px] font-mono uppercase px-1.5 py-0.5 rounded shrink-0 select-none font-semibold ${
                              isErr
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : isWarn
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : isSucc
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : isStdout
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/40'
                                : 'bg-neutral-800 text-neutral-400 border border-neutral-700'
                            }`}
                          >
                            {log.level}
                          </span>

                          {/* Step Badge */}
                          <span className="text-neutral-500 font-mono text-[10px] shrink-0 select-none">
                            [{log.stepId}]
                          </span>

                          {/* Log Message */}
                          <span
                            className={`flex-1 break-all whitespace-pre-wrap leading-relaxed ${
                              isErr
                                ? 'text-rose-300 font-semibold'
                                : isSucc
                                ? 'text-emerald-300'
                                : isWarn
                                ? 'text-amber-300'
                                : isStdout
                                ? 'text-neutral-300'
                                : 'text-neutral-200'
                            }`}
                          >
                            {log.message}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ERROR DIAGNOSTICS (IF FAILED) */}
          {activeTab === 'error' && sandbox.errorSummary && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="p-5 rounded-xl bg-[#0f121a] border border-rose-900/40 space-y-4 shadow-xl">
                <div className="flex items-center justify-between pb-3 border-b border-[#1f2535]">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-rose-400" />
                    <span className="text-sm font-bold text-neutral-100">
                      {sandbox.errorSummary.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-rose-400 bg-rose-950/60 px-2.5 py-1 rounded border border-rose-800/50">
                    Failed at: {sandbox.errorSummary.step}
                  </span>
                </div>

                <div className="text-xs text-neutral-300 leading-relaxed font-sans">
                  {sandbox.errorSummary.message}
                </div>

                {/* Stack Trace */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-neutral-400 font-mono flex items-center justify-between">
                    <span>Captured Stack Trace:</span>
                    <span className="text-[11px] text-neutral-500">Node/Python stdlib frames</span>
                  </div>
                  <pre className="p-4 bg-[#080a0f] rounded-lg border border-[#1e2535] font-mono text-xs text-rose-300/90 overflow-x-auto leading-relaxed max-h-60 overflow-y-auto">
                    {sandbox.errorSummary.stackTrace ||
                      `Error: Command failed with exit code 1
    at SandboxWorker.executeStep (/cluster/agents/sandbox_runner.js:142:19)
    at async Orchestrator.runPipeline (/cluster/core/orchestrator.js:88:12)
    at async processTicksAndRejections (node:internal/process/task_queues:95:5)`}
                  </pre>
                </div>

                {/* Remediation & Action */}
                <div className="p-4 rounded-lg bg-[#0a0d13] border border-[#1f2637] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-neutral-300 flex items-center gap-1.5 text-violet-400">
                      <Sparkles className="w-3.5 h-3.5" />
                      Recommended Fix:
                    </div>
                    <code className="text-xs font-mono text-emerald-400 mt-1 block break-all">
                      {sandbox.errorSummary.suggestedFix}
                    </code>
                  </div>

                  <button
                    onClick={handleCopyFix}
                    className="px-3.5 py-1.5 bg-[#161c28] hover:bg-[#1f2738] border border-[#2b3345] text-neutral-200 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5 shrink-0 active:scale-95"
                  >
                    {copiedFix ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-neutral-400" />
                        <span>Copy Fix</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* MODAL FOOTER                                              */}
        {/* ========================================================= */}
        <div className="px-6 py-3.5 border-t border-[#1f2533] bg-[#0b0e14] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-400 shrink-0">
          <div className="flex items-center gap-3 font-mono text-[11px]">
            <button
              onClick={handleCopyId}
              className="flex items-center gap-1.5 text-neutral-400 hover:text-neutral-200 transition-colors"
            >
              <span>Sandbox ID: {sandbox.id}</span>
              {copiedId ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3 text-neutral-500" />
              )}
            </button>
            <span className="text-neutral-600 hidden sm:inline">·</span>
            <span className="text-neutral-400 hidden sm:inline">
              Elapsed: <span className="text-neutral-200">{totalDurationSeconds}s</span>
            </span>
            <span className="text-neutral-600 hidden sm:inline">·</span>
            <span className="text-neutral-400 hidden sm:inline">
              Host: <span className="text-neutral-300">us-east-cluster-01</span>
            </span>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-md bg-[#181d28] hover:bg-[#202738] border border-[#2b3345] text-neutral-200 text-xs font-medium transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
