import React, { useState } from 'react';
import {
  X,
  RotateCw,
  ExternalLink,
  Laptop,
  Smartphone,
  Tablet,
  CheckCircle2,
  Lock,
  Search,
  Code2,
} from 'lucide-react';
import { Sandbox } from '../types/sandbox';

interface MockPreviewModalProps {
  sandbox: Sandbox;
  onClose: () => void;
}

export const MockPreviewModal: React.FC<MockPreviewModalProps> = ({
  sandbox,
  onClose,
}) => {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const isPython = sandbox.runtime === 'python';
  const port = sandbox.env.port || 3000;
  const mockUrl = `http://localhost:${port}${isPython ? '/docs' : '/'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#11141c] border border-neutral-800 rounded-xl max-w-5xl w-full h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Browser Top Chrome */}
        <div className="px-4 py-2.5 bg-[#0e1117] border-b border-neutral-800 flex items-center justify-between gap-4">
          {/* Traffic lights & controls */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-neutral-700"></span>
              <span className="w-3 h-3 rounded-full bg-neutral-700"></span>
              <span className="w-3 h-3 rounded-full bg-neutral-700"></span>
            </div>
            <button
              onClick={handleRefresh}
              className="p-1 rounded text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
              title="Reload preview"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* URL Address Bar */}
          <div className="flex-1 max-w-xl flex items-center gap-2 px-3 py-1 bg-[#090b10] border border-neutral-800 rounded-md font-mono text-xs text-neutral-300">
            <Lock className="w-3 h-3 text-emerald-400 shrink-0" />
            <span className="truncate">{mockUrl}</span>
            <span className="ml-auto text-[10px] text-emerald-400 shrink-0 font-sans">
              200 OK · 38ms
            </span>
          </div>

          {/* Viewport switcher & Close */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center p-0.5 bg-neutral-900 border border-neutral-800 rounded">
              <button
                onClick={() => setDevice('desktop')}
                className={`p-1 rounded ${device === 'desktop' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400'}`}
                title="Desktop View"
              >
                <Laptop className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('tablet')}
                className={`p-1 rounded ${device === 'tablet' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400'}`}
                title="Tablet View"
              >
                <Tablet className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setDevice('mobile')}
                className={`p-1 rounded ${device === 'mobile' ? 'bg-neutral-800 text-neutral-100' : 'text-neutral-400'}`}
                title="Mobile View"
              >
                <Smartphone className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Browser Viewport */}
        <div className="flex-1 bg-[#090b10] p-4 flex items-center justify-center overflow-auto">
          <div
            className={`h-full bg-white text-slate-900 transition-all rounded-lg overflow-y-auto shadow-lg flex flex-col ${
              device === 'desktop'
                ? 'w-full'
                : device === 'tablet'
                ? 'w-[720px]'
                : 'w-[375px]'
            }`}
          >
            {isPython ? (
              // FastAPI Swagger UI Mock
              <div className="p-6 font-sans space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <div className="flex items-center gap-3">
                    <span className="px-2.5 py-1 bg-emerald-700 text-white font-mono text-xs font-bold rounded">
                      FASTAPI
                    </span>
                    <h1 className="text-xl font-bold text-slate-900">
                      {sandbox.repoName} API Documentation
                    </h1>
                    <span className="text-xs text-slate-500 font-mono">v0.1.0</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">
                    OpenAPI 3.1.0 specification · Live Sandbox Host localhost:{port}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="p-3 border border-emerald-300 bg-emerald-50/50 rounded-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono font-bold text-xs rounded">
                        GET
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        /api/v1/health
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">Readiness probe (200 OK)</span>
                  </div>

                  <div className="p-3 border border-blue-300 bg-blue-50/50 rounded-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-blue-600 text-white font-mono font-bold text-xs rounded">
                        GET
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        /api/v1/items
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">Query paginated entities</span>
                  </div>

                  <div className="p-3 border border-emerald-300 bg-emerald-50/50 rounded-md flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 bg-emerald-600 text-white font-mono font-bold text-xs rounded">
                        POST
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-800">
                        /api/v1/items
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">Create new resource</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded border border-slate-200 text-xs font-mono text-slate-700">
                  <span className="text-emerald-600 font-bold">INFO:</span> Uvicorn running on http://0.0.0.0:{port} (Press CTRL+C to quit)
                </div>
              </div>
            ) : (
              // Next.js / Node App Mock
              <div className="min-h-full flex flex-col justify-between">
                <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                      ▲
                    </div>
                    <span className="font-bold text-slate-900 text-sm">
                      {sandbox.repoName}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                    <span>Docs</span>
                    <span>Dashboard</span>
                    <span>API</span>
                  </div>
                </div>

                <div className="p-8 max-w-xl mx-auto text-center space-y-4 my-auto">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sandbox Running on Node.js {sandbox.runtimeVersion}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    {sandbox.repoName} is live and ready
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Repository verified with {sandbox.packageManager}. 
                    All route modules loaded in memory under isolated cgroups sandbox.
                  </p>
                  <div className="p-3 bg-slate-100 rounded text-left font-mono text-xs text-slate-700 space-y-1">
                    <div>$ {sandbox.env.startCommand}</div>
                    <div className="text-emerald-700">✔ Ready in 410ms on port {port}</div>
                  </div>
                </div>

                <div className="border-t border-slate-200 px-6 py-3 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Sandbox Engine · localhost:{port}</span>
                  <span className="font-mono">Ref: {sandbox.branch}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
