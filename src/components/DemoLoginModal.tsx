import React from 'react';
import {
  ShieldAlert,
  Code2,
  ShieldCheck,
  Check,
  X,
  Lock,
  ArrowRight,
  Terminal,
  Server,
  KeyRound,
  Info,
} from 'lucide-react';
import { UserRole } from '../types/sandbox';

interface DemoLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const DemoLoginModal: React.FC<DemoLoginModalProps> = ({
  isOpen,
  onClose,
  currentRole,
  onSelectRole,
}) => {
  if (!isOpen) return null;

  const handleChoose = (role: UserRole) => {
    onSelectRole(role);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e121a] border border-[#232936] rounded-2xl max-w-lg w-full p-6 shadow-2xl relative text-neutral-200">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors cursor-pointer"
          aria-label="Close modal"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Header */}
        <div className="space-y-1 mb-5">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-md bg-violet-500/20 text-violet-400 border border-violet-500/30">
              <Lock className="w-4 h-4" />
            </span>
            <h2 className="text-base font-bold text-neutral-100 tracking-tight">
              Select Demo Workspace
            </h2>
          </div>
          <p className="text-xs text-neutral-400">
            Choose a workspace role to preview tailored developer and cluster administration experiences.
          </p>
        </div>

        {/* Disclaimer Notice: Demo vs Production */}
        <div className="p-3 rounded-lg bg-amber-950/25 border border-amber-500/30 mb-5 flex items-start gap-2.5 text-xs text-amber-200/90 leading-relaxed">
          <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-amber-300">Demo Authentication Notice:</span>{' '}
            This workspace selection simulates role-based views for demonstration. In a production deployment, enterprise SSO/OAuth and RBAC claims are strictly enforced.
          </div>
        </div>

        {/* Role Cards */}
        <div className="grid grid-cols-1 gap-3 mb-5">
          {/* Developer Role Card */}
          <div
            onClick={() => handleChoose('developer')}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              currentRole === 'developer'
                ? 'bg-violet-950/30 border-violet-500/60 ring-1 ring-violet-500/40 shadow-lg shadow-violet-950/40'
                : 'bg-[#121622] border-neutral-800 hover:border-neutral-700 hover:bg-[#151a28]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-600/20 text-violet-400 border border-violet-500/30">
                  <Code2 className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-100">
                      Developer Workspace
                    </span>
                    {currentRole === 'developer' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-semibold border border-violet-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Bootstrap repositories, review setup plans, run tests, and monitor container readiness.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0 mt-1" />
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-800/80 flex flex-wrap gap-2 text-[11px] font-mono text-neutral-400">
              <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Setup Workflows
              </span>
              <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Human Approval
              </span>
              <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Live Console
              </span>
            </div>
          </div>

          {/* Administrator Role Card */}
          <div
            onClick={() => handleChoose('admin')}
            className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
              currentRole === 'admin'
                ? 'bg-amber-950/30 border-amber-500/60 ring-1 ring-amber-500/40 shadow-lg shadow-amber-950/40'
                : 'bg-[#121622] border-neutral-800 hover:border-neutral-700 hover:bg-[#151a28]'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <Server className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-neutral-100">
                      Administrator Workspace
                    </span>
                    {currentRole === 'admin' && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Review access requests, manage developer sandboxes, monitor cluster resources, and inspect audit activity.
                  </p>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-neutral-500 shrink-0 mt-1" />
            </div>

            <div className="mt-3 pt-3 border-t border-neutral-800/80 flex flex-wrap gap-2 text-[11px] font-mono text-neutral-400">
              <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Access Requests
              </span>
              <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Cluster Health
              </span>
              <span className="px-1.5 py-0.5 rounded bg-neutral-900 border border-neutral-800">
                Audit Logs
              </span>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between text-xs text-neutral-500 border-t border-neutral-800/80 pt-3">
          <span>Session identity: <strong className="text-neutral-300 font-mono">@demo-user</strong></span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

