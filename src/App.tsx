import React, { useState, useEffect, useRef } from 'react';
import {
  ActiveNavTab,
  PackageManager,
  RuntimeType,
  Sandbox,
  WorkflowStepId,
} from './types/sandbox';
import { INITIAL_MOCK_SANDBOXES } from './data/mockSandboxes';
import { startSandboxSimulation } from './utils/sandboxSimulator';
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
import { Github, RotateCcw, Terminal } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveNavTab>('overview');
  const [sandboxes, setSandboxes] = useState<Sandbox[]>(INITIAL_MOCK_SANDBOXES);
  const [activeSandboxId, setActiveSandboxId] = useState<string>(INITIAL_MOCK_SANDBOXES[0].id);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<string>('all');

  // Modals
  const [detailModalSandbox, setDetailModalSandbox] = useState<Sandbox | null>(null);
  const [previewModalSandbox, setPreviewModalSandbox] = useState<Sandbox | null>(null);

  // Active step filter for logs in Overview
  const [selectedWorkflowStep, setSelectedWorkflowStep] = useState<WorkflowStepId | 'all'>('all');

  // Cancel ref for simulator
  const cancelSimulationRef = useRef<(() => void) | null>(null);

  // Active Sandbox
  const activeSandbox =
    sandboxes.find((s) => s.id === activeSandboxId) || sandboxes[0] || null;

  // Cleanup simulation on unmount
  useEffect(() => {
    return () => {
      if (cancelSimulationRef.current) {
        cancelSimulationRef.current();
      }
    };
  }, []);

  // Handle Form Submission / Start Simulation
  const handleCreateSandbox = (formData: {
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
    const newId = `sbx-${Math.floor(1000 + Math.random() * 9000)}`;

    // Cancel any ongoing simulation
    if (cancelSimulationRef.current) {
      cancelSimulationRef.current();
    }

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
  };

  // Handle Retry Sandbox
  const handleRetrySandbox = (targetSandbox: Sandbox, withSuggestedFix = false) => {
    if (detailModalSandbox) {
      setDetailModalSandbox(null);
    }

    setIsBootstrapping(true);
    setActiveTab('overview');

    if (cancelSimulationRef.current) {
      cancelSimulationRef.current();
    }

    const retryId = `sbx-${Math.floor(1000 + Math.random() * 9000)}`;

    const cancel = startSandboxSimulation({
      sandboxId: retryId,
      name: `${targetSandbox.repoName}-retry`,
      repoUrl: targetSandbox.repoUrl,
      branch: targetSandbox.branch,
      runtime: targetSandbox.runtime,
      runtimeVersion: targetSandbox.runtimeVersion,
      packageManager: targetSandbox.packageManager,
      startCommand: targetSandbox.env.startCommand,
      testCommand: targetSandbox.env.testCommand,
      port: targetSandbox.env.port,
      envVars: withSuggestedFix
        ? [
            ...targetSandbox.envVars,
            { key: 'MOCK_DATABASE', value: 'true' },
            { key: 'DATABASE_URL', value: 'sqlite:///local_test.db' },
          ]
        : targetSandbox.envVars,
      simulateFailure: withSuggestedFix ? false : targetSandbox.status === 'failed',
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
    setActiveSandboxId(retryId);
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
          onCreateSandboxClick={() => setActiveTab('new-sandbox')}
          onRefresh={() => {
            // refresh trigger
          }}
        />

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
