import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  ArrowDown,
  Filter,
} from 'lucide-react';
import { LogEntry, WorkflowStepId } from '../types/sandbox';

interface ActivityPanelProps {
  logs: LogEntry[];
  activeStepFilter?: WorkflowStepId | 'all';
  onClearLogs?: () => void;
  isRunning?: boolean;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  logs,
  activeStepFilter = 'all',
  onClearLogs,
  isRunning = false,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new logs arrive
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Filter logs
  const filteredLogs = logs.filter((log) => {
    if (activeStepFilter !== 'all' && log.stepId !== activeStepFilter) {
      return false;
    }
    if (levelFilter !== 'all' && log.level !== levelFilter) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.stepId.toLowerCase().includes(q) ||
        log.timestamp.includes(q)
      );
    }
    return true;
  });

  const handleCopyLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.stepId}] ${l.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadLogs = () => {
    const text = filteredLogs
      .map((l) => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.stepId}] ${l.message}`)
      .join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sandbox-setup-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getLevelBadge = (level: LogEntry['level']) => {
    switch (level) {
      case 'info':
        return <span className="text-blue-400 font-mono">[INFO]</span>;
      case 'warn':
        return <span className="text-amber-400 font-mono">[WARN]</span>;
      case 'error':
        return <span className="text-rose-400 font-mono font-bold">[ERR ]</span>;
      case 'success':
        return <span className="text-emerald-400 font-mono font-bold">[PASS]</span>;
      case 'stdout':
        return <span className="text-neutral-400 font-mono">[OUT ]</span>;
      default:
        return <span className="text-neutral-500 font-mono">[LOG ]</span>;
    }
  };

  return (
    <div className="bg-[#090b10] border border-neutral-800 rounded-lg overflow-hidden flex flex-col h-full min-h-[500px]">
      {/* Terminal Title Bar */}
      <div className="px-4 py-2.5 bg-[#0e1117] border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-neutral-400" />
          <span className="font-semibold text-neutral-200">Activity Console</span>
          <span className="text-neutral-600">·</span>
          <span className="text-[11px] font-mono text-neutral-400">
            {filteredLogs.length} events
          </span>
          {isRunning && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-ping"></span>
              Streaming
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Level Filter Tabs */}
          <div className="flex items-center p-0.5 bg-neutral-900 border border-neutral-800 rounded">
            {(['all', 'info', 'warn', 'error', 'success'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2 py-0.5 text-[10px] uppercase font-mono rounded transition-colors ${
                  levelFilter === lvl
                    ? 'bg-neutral-800 text-neutral-100 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-300'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3 h-3 absolute left-2 top-2 text-neutral-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 pr-2 py-1 bg-neutral-900 border border-neutral-800 rounded text-[11px] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500/60 w-28 sm:w-36"
            />
          </div>

          {/* Copy Button */}
          <button
            onClick={handleCopyLogs}
            title="Copy logs to clipboard"
            className="p-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Download Logs */}
          <button
            onClick={handleDownloadLogs}
            title="Download log file"
            className="p-1.5 rounded bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {/* Auto Scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
            className={`p-1.5 rounded border transition-colors ${
              autoScroll
                ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                : 'bg-neutral-900 border-neutral-800 text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div
        ref={logsContainerRef}
        className="flex-1 p-4 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex items-center justify-center text-neutral-600 italic">
            No matching log entries found
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2.5 hover:bg-white/[0.02] py-0.5 px-1 rounded transition-colors ${
                log.level === 'error'
                  ? 'bg-rose-950/20 text-rose-300'
                  : log.level === 'warn'
                  ? 'text-amber-300'
                  : log.level === 'success'
                  ? 'text-emerald-300'
                  : 'text-neutral-300'
              }`}
            >
              <span className="text-neutral-600 shrink-0 select-none">
                {log.timestamp}
              </span>
              <span className="shrink-0">{getLevelBadge(log.level)}</span>
              <span className="text-neutral-500 shrink-0 select-none">
                [{log.stepId}]
              </span>
              <span className="flex-1 whitespace-pre-wrap break-all">
                {log.message}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
