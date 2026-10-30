import React, { useState } from 'react';
import {
  Cpu,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  Terminal,
  Server,
  Lock,
} from 'lucide-react';

export const SupportedRuntimesView: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedManifest, setExpandedManifest] = useState<Record<number, boolean>>({});

  const handleCopy = (code: string, idx: number) => {
    navigator.clipboard.writeText(code);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const toggleExpand = (idx: number) => {
    setExpandedManifest((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const runtimes = [
    {
      name: 'Node.js Engine',
      tag: 'JavaScript & TypeScript',
      icon: Cpu,
      accentColor: 'text-emerald-400',
      badge: 'Tier 1 Supported',
      versions: ['Node.js 20.14.0 LTS (Default)', 'Node.js 22.2.0 (Current)', 'Node.js 18.20.2 LTS'],
      packageManagers: ['pnpm (Recommended)', 'npm', 'yarn', 'bun'],
      manifests: ['package.json', 'pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'bun.lockb'],
      defaultPort: 3000,
      resourceConstraints: '2 vCPUs · 2048 MB RAM · Loopback 127.0.0.1',
      sampleManifest: `{
  "name": "my-web-app",
  "version": "1.0.0",
  "scripts": {
    "dev": "pnpm run dev",
    "test": "pnpm test"
  },
  "dependencies": {
    "next": "^14.2.3",
    "react": "^18.3.1"
  }
}`,
    },
    {
      name: 'Python Engine',
      tag: 'Python Microservices & APIs',
      icon: Layers,
      accentColor: 'text-cyan-400',
      badge: 'Tier 1 Supported',
      versions: ['Python 3.11.9 (Default)', 'Python 3.12.3 (Latest)', 'Python 3.10.14'],
      packageManagers: ['poetry (Default)', 'pip', 'uv virtualenv'],
      manifests: ['pyproject.toml', 'poetry.lock', 'requirements.txt', 'Pipfile'],
      defaultPort: 8000,
      resourceConstraints: '2 vCPUs · 2048 MB RAM · Loopback 127.0.0.1',
      sampleManifest: `[tool.poetry]
name = "fastapi-service"
version = "0.1.0"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.111.0"
uvicorn = "^0.29.0"

[tool.poetry.group.dev.dependencies]
pytest = "^8.2.0"`,
    },
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Banner */}
      <div className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-1.5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-100">
          <Cpu className="w-4 h-4 text-violet-400" />
          <span>Supported Container Runtimes & Manifest Discovery</span>
        </div>
        <p className="text-xs text-neutral-400 leading-relaxed">
          The bootstrapper automatically inspects repository files, validates dependencies against strict schemas, and spawns rootless cgroups v2 isolated containers.
        </p>
      </div>

      {/* Runtime Engines Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {runtimes.map((rt, idx) => {
          const Icon = rt.icon;
          const isExpanded = !!expandedManifest[idx];
          return (
            <div
              key={rt.name}
              className="bg-[#0e121a] border border-[#1e2433] rounded-xl p-5 space-y-4 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#1c2230]">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-[#141a26] border border-[#222a3a] text-neutral-200">
                    <Icon className={`w-4 h-4 ${rt.accentColor}`} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-100">{rt.name}</h3>
                    <span className="text-[10px] text-neutral-400 font-mono">{rt.tag}</span>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
                  {rt.badge}
                </span>
              </div>

              {/* Supported Versions */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Engine Versions</span>
                <div className="flex flex-wrap gap-1.5">
                  {rt.versions.map((v, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded bg-[#141a26] border border-[#222a3a] text-[11px] font-mono text-neutral-300"
                    >
                      {v}
                    </span>
                  ))}
                </div>
              </div>

              {/* Package Managers */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Package Managers</span>
                <div className="flex flex-wrap gap-1.5">
                  {rt.packageManagers.map((pm, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 rounded bg-[#141a26] border border-[#222a3a] text-[11px] font-mono text-neutral-300"
                    >
                      {pm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Manifest Discovery Files */}
              <div className="space-y-1.5 text-xs">
                <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-wider">Discovered Manifests</span>
                <div className="flex flex-wrap gap-1.5">
                  {rt.manifests.map((mf, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded bg-[#090b10] border border-[#1e2433] text-[10px] font-mono text-violet-300"
                    >
                      {mf}
                    </span>
                  ))}
                </div>
              </div>

              {/* Security & Resource Constraints */}
              <div className="p-2.5 rounded-lg bg-[#090b10] border border-[#1e2433] text-[11px] flex items-center justify-between text-neutral-400 font-mono">
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>Isolation Limits:</span>
                </span>
                <span className="text-neutral-200">{rt.resourceConstraints}</span>
              </div>

              {/* Expandable Sample Manifest with Copy */}
              <div className="pt-2 border-t border-[#1c2230]">
                <button
                  onClick={() => toggleExpand(idx)}
                  className="w-full flex items-center justify-between text-xs font-mono text-neutral-400 hover:text-neutral-200 py-1 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-violet-400" />
                    <span>{isExpanded ? 'Hide Sample Manifest' : 'View Sample Setup Manifest'}</span>
                  </span>
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>

                {isExpanded && (
                  <div className="mt-2 space-y-2 animate-in fade-in duration-150">
                    <div className="flex items-center justify-end">
                      <button
                        onClick={() => handleCopy(rt.sampleManifest, idx)}
                        className="text-[11px] font-mono text-neutral-400 hover:text-neutral-200 flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        {copiedIndex === idx ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedIndex === idx ? 'Copied' : 'Copy Manifest'}</span>
                      </button>
                    </div>
                    <pre className="p-3 rounded-lg bg-[#07090e] border border-[#1e2433] text-[11px] font-mono text-neutral-300 overflow-x-auto max-h-48 overflow-y-auto">
                      {rt.sampleManifest}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
