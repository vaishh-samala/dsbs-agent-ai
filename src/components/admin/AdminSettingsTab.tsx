import React, { useState } from 'react';
import {
  Sliders,
  ShieldCheck,
  Cpu,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Save,
  Lock,
  Layers,
  HardDrive,
  Network,
  Info,
} from 'lucide-react';

interface AdminSettingsTabProps {
  notify?: (msg: string) => void;
}

interface ClusterSettingsState {
  memoryLimit: string;
  cpuQuota: string;
  maxConcurrentPerDev: string;
  leaseDuration: string;
  inactiveTimeout: string;
  failedProbeTimeout: string;
  networkPolicy: string;
  approvalGatePolicy: string;
  strictManifestValidation: boolean;
}

const DEFAULT_SETTINGS: ClusterSettingsState = {
  memoryLimit: '2048',
  cpuQuota: '2',
  maxConcurrentPerDev: '2',
  leaseDuration: '60',
  inactiveTimeout: '30',
  failedProbeTimeout: '10',
  networkPolicy: 'strict_loopback',
  approvalGatePolicy: 'mandatory_all',
  strictManifestValidation: true,
};

export const AdminSettingsTab: React.FC<AdminSettingsTabProps> = ({ notify }) => {
  const [savedSettings, setSavedSettings] = useState<ClusterSettingsState>(DEFAULT_SETTINGS);
  const [currentSettings, setCurrentSettings] = useState<ClusterSettingsState>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const hasChanges = JSON.stringify(savedSettings) !== JSON.stringify(currentSettings);

  const handleChange = <K extends keyof ClusterSettingsState>(key: K, value: ClusterSettingsState[K]) => {
    setCurrentSettings((prev) => ({ ...prev, [key]: value }));
    setSavedSuccess(false);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setSavedSettings(currentSettings);
      setIsSaving(false);
      setSavedSuccess(true);
      if (notify) {
        notify('Cluster security policies & cgroups resource limits saved successfully.');
      }
      setTimeout(() => setSavedSuccess(false), 3000);
    }, 450);
  };

  const handleReset = () => {
    setCurrentSettings(DEFAULT_SETTINGS);
    setSavedSettings(DEFAULT_SETTINGS);
    setSavedSuccess(false);
    if (notify) {
      notify('Cluster policies reset to factory defaults.');
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#1e2433]">
        <div>
          <h2 className="text-base font-bold text-neutral-100 flex items-center gap-2">
            <Sliders className="w-4 h-4 text-violet-400" />
            <span>Cluster Policies & Security Quotas</span>
          </h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Configure global sandbox memory ceilings, approval gate strictness, and lease garbage collection rules.
          </p>
        </div>

        {hasChanges && (
          <span className="text-xs font-mono text-amber-300 bg-amber-950/60 px-2.5 py-1 rounded border border-amber-500/30 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Unsaved Changes</span>
          </span>
        )}
      </div>

      {savedSuccess && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Cluster configuration and policy limits updated across all worker nodes.</span>
        </div>
      )}

      {/* Section 1: Security & Gate Governance */}
      <div className="p-5 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#181f2c]">
          <ShieldCheck className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-bold text-neutral-100">Sandbox Security & Network Policies</h3>
            <p className="text-xs text-neutral-400">Control human approval checkpoints and loopback network boundaries.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Human Approval Gate Policy
            </label>
            <select
              value={currentSettings.approvalGatePolicy}
              onChange={(e) => handleChange('approvalGatePolicy', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="mandatory_all">Mandatory: Require explicit sign-off on all setup plans</option>
              <option value="auto_safe">Permissive: Auto-approve safe read-only commands</option>
            </select>
            <p className="text-[11px] text-neutral-500">
              Enforces a pause state in LangGraph before executing any setup commands.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Network Isolation Mode
            </label>
            <select
              value={currentSettings.networkPolicy}
              onChange={(e) => handleChange('networkPolicy', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="strict_loopback">Strict Loopback (127.0.0.1 rootless only)</option>
              <option value="bridge">Bridge Mode (internal container mesh only)</option>
            </select>
            <p className="text-[11px] text-neutral-500">
              Prevents unauthorized outbound network scanning or external socket listeners.
            </p>
          </div>
        </div>

        <div className="pt-2">
          <label className="flex items-center gap-2.5 cursor-pointer text-xs text-neutral-300">
            <input
              type="checkbox"
              checked={currentSettings.strictManifestValidation}
              onChange={(e) => handleChange('strictManifestValidation', e.target.checked)}
              className="w-4 h-4 rounded bg-[#090b10] border-[#1a2130] text-violet-600 focus:ring-0 cursor-pointer"
            />
            <span>
              Enforce strict Pydantic SetupManifest validation (<code>extra="forbid"</code>) on all repository setups
            </span>
          </label>
        </div>
      </div>

      {/* Section 2: Resource Quotas (cgroups v2) */}
      <div className="p-5 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#181f2c]">
          <Cpu className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-bold text-neutral-100">Container Resource Quotas (cgroups v2)</h3>
            <p className="text-xs text-neutral-400">Hard ceilings on memory and vCPU cores allocated per sandbox process.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Global Sandbox Memory Limit
            </label>
            <select
              value={currentSettings.memoryLimit}
              onChange={(e) => handleChange('memoryLimit', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="2048">2048 MB (Standard / Default)</option>
              <option value="4096">4096 MB (Elevated)</option>
              <option value="8192">8192 MB (Enterprise Quota)</option>
            </select>
            <p className="text-[11px] text-neutral-500">Trigger cgroup OOM-killer if exceeded.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              CPU Allocation per Sandbox
            </label>
            <select
              value={currentSettings.cpuQuota}
              onChange={(e) => handleChange('cpuQuota', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="1">1 Core (0.5 vCPU share)</option>
              <option value="2">2 Cores (1.0 vCPU share - Default)</option>
              <option value="4">4 Cores (2.0 vCPU share)</option>
            </select>
            <p className="text-[11px] text-neutral-500">cgroups cpu.max quota throttling.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Max Sandboxes per Developer
            </label>
            <select
              value={currentSettings.maxConcurrentPerDev}
              onChange={(e) => handleChange('maxConcurrentPerDev', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="1">1 Active Sandbox</option>
              <option value="2">2 Active Sandboxes (Default)</option>
              <option value="5">5 Active Sandboxes</option>
            </select>
            <p className="text-[11px] text-neutral-500">Prevents port exhaustion on host.</p>
          </div>
        </div>
      </div>

      {/* Section 3: Lease Durations & Lifecycle */}
      <div className="p-5 rounded-xl bg-[#0e121a] border border-[#1e2433] space-y-4">
        <div className="flex items-center gap-2.5 pb-3 border-b border-[#181f2c]">
          <Clock className="w-4 h-4 text-violet-400" />
          <div>
            <h3 className="text-sm font-bold text-neutral-100">Lease Durations & Automated Cleanup</h3>
            <p className="text-xs text-neutral-400">Garbage collection policies for expired, idle, or unresponsive sandboxes.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Default Sandbox Lease TTL
            </label>
            <select
              value={currentSettings.leaseDuration}
              onChange={(e) => handleChange('leaseDuration', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="30">30 Minutes</option>
              <option value="60">60 Minutes (Default)</option>
              <option value="120">120 Minutes (Extended)</option>
              <option value="240">240 Minutes (Long)</option>
            </select>
            <p className="text-[11px] text-neutral-500">Max runtime before automatic teardown.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Inactive Session Timeout
            </label>
            <select
              value={currentSettings.inactiveTimeout}
              onChange={(e) => handleChange('inactiveTimeout', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="15">15 Minutes</option>
              <option value="30">30 Minutes (Default)</option>
              <option value="60">60 Minutes</option>
            </select>
            <p className="text-[11px] text-neutral-500">Teardown if zero HTTP requests received.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium block">
              Failed Health Probe Auto-Stop
            </label>
            <select
              value={currentSettings.failedProbeTimeout}
              onChange={(e) => handleChange('failedProbeTimeout', e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1a2130] focus:border-violet-500/60 rounded-lg text-neutral-200 focus:outline-none cursor-pointer"
            >
              <option value="5">5 Minutes</option>
              <option value="10">10 Minutes (Default)</option>
              <option value="never">Never (Manual Stop Only)</option>
            </select>
            <p className="text-[11px] text-neutral-500">Release port after repeated probe failure.</p>
          </div>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex items-center justify-between pt-3 border-t border-[#1e2433]">
        <button
          type="button"
          onClick={handleReset}
          className="px-3.5 py-2 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-300 hover:text-neutral-100 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
          <span>Reset to Cluster Defaults</span>
        </button>

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold transition-colors flex items-center gap-2 cursor-pointer shadow-md shadow-violet-950/40 disabled:opacity-50"
        >
          {isSaving ? (
            <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Save className="w-3.5 h-3.5" />
          )}
          <span>{isSaving ? 'Applying Policies...' : 'Save Cluster Policies'}</span>
        </button>
      </div>
    </div>
  );
};
