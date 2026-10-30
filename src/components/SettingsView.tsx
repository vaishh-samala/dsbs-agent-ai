import React, { useState } from 'react';
import {
  Save,
  Shield,
  Cpu,
  Clock,
  Github,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Server,
  Trash2,
  Check,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [defaultRuntime, setDefaultRuntime] = useState('node');
  const [defaultNodeVersion, setDefaultNodeVersion] = useState('20.14.0');
  const [defaultPythonVersion, setDefaultPythonVersion] = useState('3.11.9');
  const [cpuLimit, setCpuLimit] = useState(2);
  const [ramLimit, setRamLimit] = useState(2048);
  const [leaseTimeoutMinutes, setLeaseTimeoutMinutes] = useState(60);
  const [autoCleanupFailed, setAutoCleanupFailed] = useState(false);
  const [savedNotification, setSavedNotification] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedNotification('Settings successfully saved to local preferences.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  const handleReset = () => {
    setDefaultRuntime('node');
    setDefaultNodeVersion('20.14.0');
    setDefaultPythonVersion('3.11.9');
    setCpuLimit(2);
    setRamLimit(2048);
    setLeaseTimeoutMinutes(60);
    setAutoCleanupFailed(false);
    setSavedNotification('Settings reset to platform defaults.');
    setTimeout(() => setSavedNotification(null), 3000);
  };

  return (
    <form onSubmit={handleSave} className="max-w-4xl mx-auto space-y-5">
      {/* Save Notification Toast */}
      {savedNotification && (
        <div className="bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-150">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{savedNotification}</span>
        </div>
      )}

      {/* Group 1: GitHub Connection & Authentication */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-[#141a26] border border-[#222a3a] text-neutral-200">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-bold text-neutral-100">
                GitHub Connection & Access Tokens
              </h2>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Authenticated session for repository tree cloning and manifest discovery.
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>@developer-session</span>
          </span>
        </div>

        <div className="text-[11px] text-neutral-400 border-t border-[#1c2230] pt-3 flex flex-wrap items-center justify-between gap-2">
          <span>GitHub Rate Limit: 4,920 / 5,000 requests remaining</span>
          <span className="font-mono text-neutral-500">Quota resets in 42m</span>
        </div>
      </div>

      {/* Group 2: Default Runtime Presets */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-violet-400" />
          <span>Default Runtime Presets</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Default Node.js Engine</label>
            <select
              value={defaultNodeVersion}
              onChange={(e) => setDefaultNodeVersion(e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="20.14.0">Node.js 20.14.0 LTS (Recommended)</option>
              <option value="22.2.0">Node.js 22.2.0 (Current)</option>
              <option value="18.20.2">Node.js 18.20.2 LTS</option>
            </select>
            <p className="text-[11px] text-neutral-500">Applied when no engine is pinned in package.json.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Default Python Engine</label>
            <select
              value={defaultPythonVersion}
              onChange={(e) => setDefaultPythonVersion(e.target.value)}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="3.11.9">Python 3.11.9 (Recommended)</option>
              <option value="3.12.3">Python 3.12.3 (Latest)</option>
              <option value="3.10.14">Python 3.10.14</option>
            </select>
            <p className="text-[11px] text-neutral-500">Applied when no pyproject.toml python constraint matches.</p>
          </div>
        </div>
      </div>

      {/* Group 3: Resource Limits & cgroups v2 */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <Cpu className="w-4 h-4 text-violet-400" />
          <span>Container Isolation & Resource Limits</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Per-Sandbox CPU Allocation</label>
            <select
              value={cpuLimit}
              onChange={(e) => setCpuLimit(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="1">1 Dedicated vCPU Core</option>
              <option value="2">2 Dedicated vCPU Cores (Standard)</option>
              <option value="4">4 Dedicated vCPU Cores (Elevated)</option>
            </select>
            <p className="text-[11px] text-neutral-500">cgroups v2 cpu.max quota limit.</p>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Per-Sandbox Memory Quota</label>
            <select
              value={ramLimit}
              onChange={(e) => setRamLimit(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="1024">1024 MB (Lightweight)</option>
              <option value="2048">2048 MB (Default)</option>
              <option value="4096">4096 MB (Memory-Intensive)</option>
            </select>
            <p className="text-[11px] text-neutral-500">cgroups v2 memory.max hard kill threshold.</p>
          </div>
        </div>
      </div>

      {/* Group 4: Lease Duration & Cleanup Policies */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-violet-400" />
          <span>Lease Durations & Automated Cleanup</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Sandbox Lease Duration</label>
            <select
              value={leaseTimeoutMinutes}
              onChange={(e) => setLeaseTimeoutMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#090b10] border border-[#1e2433] rounded-lg text-neutral-200 text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
            >
              <option value="30">30 Minutes</option>
              <option value="60">60 Minutes (Default)</option>
              <option value="120">120 Minutes (2 Hours)</option>
              <option value="240">240 Minutes (4 Hours)</option>
            </select>
            <p className="text-[11px] text-neutral-500">Container process stops automatically after lease expiration.</p>
          </div>

          <div className="space-y-2 pt-1">
            <label className="text-neutral-300 font-medium block">Automatic Cleanup Policy</label>
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={autoCleanupFailed}
                onChange={(e) => setAutoCleanupFailed(e.target.checked)}
                className="mt-0.5 rounded border-neutral-700 text-violet-600 focus:ring-0 cursor-pointer"
              />
              <span className="text-neutral-300 text-xs leading-relaxed">
                Automatically purge ephemeral container files when health verification checks fail.
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Save and Reset Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          className="px-4 py-2 rounded-lg bg-[#141a26] hover:bg-[#1a2233] border border-[#232c3d] text-neutral-300 text-xs font-medium flex items-center gap-1.5 cursor-pointer transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>

        <button
          type="submit"
          className="px-5 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-sm shadow-violet-900/30 transition-all"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save Preferences</span>
        </button>
      </div>
    </form>
  );
};
