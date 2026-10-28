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
  Zap,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const [defaultRuntime, setDefaultRuntime] = useState('node');
  const [defaultNodeVersion, setDefaultNodeVersion] = useState('20.14.0');
  const [defaultPythonVersion, setDefaultPythonVersion] = useState('3.11.9');
  const [cpuLimit, setCpuLimit] = useState(2);
  const [ramLimit, setRamLimit] = useState(2048);
  const [leaseTimeoutMinutes, setLeaseTimeoutMinutes] = useState(60);
  const [autoCleanupFailed, setAutoCleanupFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleReset = () => {
    setDefaultRuntime('node');
    setDefaultNodeVersion('20.14.0');
    setDefaultPythonVersion('3.11.9');
    setCpuLimit(2);
    setRamLimit(2048);
    setLeaseTimeoutMinutes(60);
    setAutoCleanupFailed(false);
  };

  return (
    <form onSubmit={handleSave} className="max-w-4xl space-y-6">
      {/* GitHub Integration Status Card */}
      <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-200">
              <Github className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xs font-semibold text-neutral-200">
                GitHub Authentication
              </h2>
              <p className="text-[11px] text-neutral-400 mt-0.5">
                Connected via personal developer token with read permissions
              </p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-xs font-mono text-emerald-400 bg-emerald-950/20 px-2.5 py-1 rounded border border-emerald-800/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>@developer-session</span>
          </span>
        </div>

        <div className="text-[11px] text-neutral-400 border-t border-neutral-800/80 pt-3 flex items-center justify-between">
          <span>API Rate Limit: 4,920 / 5,000 requests remaining</span>
          <span className="font-mono text-neutral-300">Resets in 42m</span>
        </div>
      </div>

      {/* Default Runtime Preferences */}
      <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-5 space-y-4">
        <h2 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-violet-400" />
          <span>Default Runtime Presets</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Default Node.js Engine</label>
            <select
              value={defaultNodeVersion}
              onChange={(e) => setDefaultNodeVersion(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-neutral-200 text-xs focus:outline-none focus:border-violet-500/80 cursor-pointer"
            >
              <option value="20.14.0">Node.js 20.14.0 LTS (Iron)</option>
              <option value="22.2.0">Node.js 22.2.0 (Current)</option>
              <option value="18.20.2">Node.js 18.20.2 LTS (Hydrogen)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium">Default Python Engine</label>
            <select
              value={defaultPythonVersion}
              onChange={(e) => setDefaultPythonVersion(e.target.value)}
              className="w-full px-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-neutral-200 text-xs focus:outline-none focus:border-violet-500/80 cursor-pointer"
            >
              <option value="3.11.9">Python 3.11.9 (Recommended)</option>
              <option value="3.12.3">Python 3.12.3 (Latest)</option>
              <option value="3.10.14">Python 3.10.14</option>
            </select>
          </div>
        </div>
      </div>

      {/* Resource Allocation */}
      <div className="bg-[#11141c] border border-neutral-800 rounded-lg p-5 space-y-5">
        <h2 className="text-xs font-semibold text-neutral-200 uppercase tracking-wider flex items-center gap-2">
          <Server className="w-3.5 h-3.5 text-violet-400" />
          <span>Isolated Resource Boundaries (Per Sandbox)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-300 font-medium">CPU Limit</span>
              <span className="font-mono text-violet-400">{cpuLimit} vCPUs</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={cpuLimit}
              onChange={(e) => setCpuLimit(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>1 vCPU</span>
              <span>2 vCPUs</span>
              <span>4 vCPUs</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-neutral-300 font-medium">RAM Allocation</span>
              <span className="font-mono text-violet-400">{ramLimit} MB</span>
            </div>
            <input
              type="range"
              min="1024"
              max="4096"
              step="512"
              value={ramLimit}
              onChange={(e) => setRamLimit(Number(e.target.value))}
              className="w-full accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-500 font-mono">
              <span>1024 MB</span>
              <span>2048 MB</span>
              <span>4096 MB</span>
            </div>
          </div>
        </div>

        {/* Timeout */}
        <div className="pt-2 border-t border-neutral-800/80 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-neutral-300 font-medium text-xs">
              Default Sandbox Lease Duration
            </label>
            <select
              value={leaseTimeoutMinutes}
              onChange={(e) => setLeaseTimeoutMinutes(Number(e.target.value))}
              className="w-full px-3 py-2 bg-[#0c0e14] border border-neutral-800 rounded-md text-neutral-200 text-xs focus:outline-none focus:border-violet-500/80 cursor-pointer"
            >
              <option value="30">30 minutes</option>
              <option value="60">60 minutes (1 hour - default)</option>
              <option value="120">120 minutes (2 hours)</option>
              <option value="240">240 minutes (4 hours)</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 bg-[#0c0e14] rounded-md border border-neutral-800">
            <div>
              <span className="text-xs font-medium text-neutral-200 block">
                Auto-cleanup Failed Sandboxes
              </span>
              <span className="text-[11px] text-neutral-400 block mt-0.5">
                Prune stopped containers after 24h
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoCleanupFailed}
              onChange={(e) => setAutoCleanupFailed(e.target.checked)}
              className="w-4 h-4 accent-violet-500 rounded cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={handleReset}
          className="px-3.5 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Defaults</span>
        </button>

        <button
          type="submit"
          className="px-5 py-2 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 active:bg-violet-700 rounded-md transition-colors shadow-sm shadow-violet-950/40 flex items-center gap-1.5 cursor-pointer"
        >
          {saved ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
              <span>Saved!</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Save Configuration</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
};
