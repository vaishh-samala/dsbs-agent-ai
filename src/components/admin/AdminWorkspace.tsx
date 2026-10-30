import React, { useState } from 'react';
import {
  CheckCircle2,
  ShieldCheck,
  Info,
} from 'lucide-react';
import {
  AdminNavTab,
  Sandbox,
  AccessRequest,
  DeveloperUser,
  AuditActivityEvent,
} from '../../types/sandbox';
import { AdminOverviewTab } from './AdminOverviewTab';
import { AdminSandboxesTab } from './AdminSandboxesTab';
import { AdminRequestsTab } from './AdminRequestsTab';
import { AdminDevelopersTab } from './AdminDevelopersTab';
import { AdminMonitoringTab } from './AdminMonitoringTab';
import { AdminAuditTab } from './AdminAuditTab';
import { AdminSettingsTab } from './AdminSettingsTab';

interface AdminWorkspaceProps {
  activeTab: AdminNavTab;
  sandboxes: Sandbox[];
  accessRequests: AccessRequest[];
  onApproveRequest: (id: string, workflowId?: string, fingerprint?: string) => Promise<void> | void;
  onRejectRequest: (id: string, workflowId?: string, reason?: string) => Promise<void> | void;
  developers: DeveloperUser[];
  auditLogs: AuditActivityEvent[];
  onSelectSandbox: (sandbox: Sandbox) => void;
  onStopSandbox: (id: string) => void;
  isProcessingAction?: boolean;
  onNavigateTab?: (tab: AdminNavTab) => void;
}

export const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({
  activeTab,
  sandboxes,
  accessRequests,
  onApproveRequest,
  onRejectRequest,
  developers,
  auditLogs,
  onSelectSandbox,
  onStopSandbox,
  isProcessingAction = false,
  onNavigateTab,
}) => {
  const [adminNotification, setAdminNotification] = useState<string | null>(null);

  const notify = (msg: string) => {
    setAdminNotification(msg);
    setTimeout(() => setAdminNotification(null), 3500);
  };

  return (
    <div className="space-y-5 max-w-7xl mx-auto font-sans">
      {/* Compact Administrator RBAC Context Strip */}
      <div className="bg-[#10141f] border border-amber-500/25 rounded-lg px-3.5 py-2 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-amber-300/90 min-w-0">
          <ShieldCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="truncate">
            <strong className="font-semibold text-amber-200">Administrator Console:</strong> Enforcing RBAC security gates, LangGraph checkpoints, and cgroups v2 quotas.
          </span>
        </div>
        <span className="font-mono text-[10px] text-amber-300 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-500/30 shrink-0 font-semibold">
          Role: cluster-admin
        </span>
      </div>

      {/* Global Admin Feedback Toast */}
      {adminNotification && (
        <div className="bg-emerald-950/50 border border-emerald-500/40 text-emerald-300 px-4 py-2.5 rounded-xl text-xs flex items-center gap-2 animate-in fade-in duration-150 shadow-lg">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{adminNotification}</span>
        </div>
      )}

      {/* 1. Admin Overview Tab */}
      {activeTab === 'admin-overview' && (
        <AdminOverviewTab
          sandboxes={sandboxes}
          accessRequests={accessRequests}
          auditLogs={auditLogs}
          onSelectSandbox={onSelectSandbox}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* 2. Sandbox Management Tab */}
      {activeTab === 'admin-sandboxes' && (
        <AdminSandboxesTab
          sandboxes={sandboxes}
          onSelectSandbox={onSelectSandbox}
          onStopSandbox={onStopSandbox}
          notify={notify}
        />
      )}

      {/* 3. Access Requests Tab */}
      {activeTab === 'admin-requests' && (
        <AdminRequestsTab
          accessRequests={accessRequests}
          sandboxes={sandboxes}
          onApproveRequest={onApproveRequest}
          onRejectRequest={onRejectRequest}
          isProcessingAction={isProcessingAction}
          notify={notify}
        />
      )}

      {/* 4. Developer Directory Tab */}
      {activeTab === 'admin-developers' && (
        <AdminDevelopersTab
          developers={developers}
        />
      )}

      {/* 5. Environment Health & Probe Tab */}
      {activeTab === 'admin-monitoring' && (
        <AdminMonitoringTab
          sandboxes={sandboxes}
          onSelectSandbox={onSelectSandbox}
        />
      )}

      {/* 6. Audit Activity Tab */}
      {activeTab === 'admin-audit' && (
        <AdminAuditTab
          auditLogs={auditLogs}
        />
      )}

      {/* 7. Admin Settings & Policies Tab */}
      {activeTab === 'admin-settings' && (
        <AdminSettingsTab
          notify={notify}
        />
      )}
    </div>
  );
};