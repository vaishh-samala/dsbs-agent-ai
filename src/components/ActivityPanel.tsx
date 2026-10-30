import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Search,
  Copy,
  Check,
  Download,
  GripHorizontal,
  ArrowDown,
  RotateCcw,
} from 'lucide-react';
import { LogEntry, WorkflowStepId } from '../types/sandbox';

interface ActivityPanelProps {
  logs: LogEntry[];
  activeStepFilter?: WorkflowStepId | 'all';
  onClearLogs?: () => void;
  isRunning?: boolean;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
}

export const ActivityPanel: React.FC<ActivityPanelProps> = ({
  logs,
  activeStepFilter = 'all',
  onClearLogs,
  isRunning = false,
  defaultHeight = 520,
  minHeight = 320,
  maxHeight = 850,
}) => {
  const [consoleHeight, setConsoleHeight] = useState<number>(defaultHeight);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartYRef = useRef<number>(0);
  const dragStartHeightRef = useRef<number>(defaultHeight);

  const [searchQuery, setSearchQuery] = useState('');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error' | 'success'>('all');
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom when new logs arrive if autoScroll is enabled
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  // Handle Resize Mouse Events
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartYRef.current = e.clientY;
    dragStartHeightRef.current = consoleHeight;
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      // Dragging upward (negative deltaY) increases console height; downward decreases it
      const deltaY = dragStartYRef.current - e.clientY;
      const newHeight = Math.min(
        maxHeight,
        Math.max(minHeight, dragStartHeightRef.current + deltaY)
      );
      setConsoleHeight(newHeight);
    },
    [isDragging, minHeight, maxHeight]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'row-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Reset to default height on double click
  const handleDoubleClickHandle = () => {
    setConsoleHeight(defaultHeight);
  };

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
    a.download = `sandbox-logs-${Date.now()}.log`;
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
    <div
      style={{ height: `${consoleHeight}px` }}
      className={`bg-[#090b10] border border-neutral-800 rounded-xl overflow-hidden flex flex-col shadow-sm transition-[border-color] relative ${
        isDragging ? 'border-violet-500 ring-1 ring-violet-500/30' : ''
      }`}
    >
      {/* Subtle Vertical Resize Handle along Top Edge */}
      <div
        onMouseDown={handleMouseDown}
        onDoubleClick={handleDoubleClickHandle}
        className="w-full h-3 bg-[#0d1017] hover:bg-neutral-800/80 border-b border-neutral-800/60 cursor-row-resize flex items-center justify-center transition-colors group select-none shrink-0"
        title="Drag up or down to resize console height (Double click to reset to 520px)"
        aria-label="Resize console handle"
      >
        <div className="w-12 h-1 rounded-full bg-neutral-700 group-hover:bg-violet-400 transition-colors flex items-center justify-center">
          <GripHorizontal className="w-3 h-3 text-neutral-400 group-hover:text-white" />
        </div>
      </div>

      {/* Terminal Header Bar */}
      <div className="px-4 py-2.5 bg-[#0e1117] border-b border-neutral-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-violet-400" />
          <span className="font-bold text-neutral-100 tracking-tight">
            Activity Console
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-[11px] font-mono text-neutral-400">
            {filteredLogs.length} events
          </span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-[11px] font-mono text-violet-400">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-ping" />
              <span>Live Streaming</span>
            </span>
          )}
        </div>

        {/* Action Controls: Filters & Search */}
        <div className="flex items-center gap-2">
          {/* Level Filter Tabs */}
          <div className="flex items-center p-0.5 bg-neutral-900 border border-neutral-800 rounded-md">
            {(['all', 'info', 'warn', 'error', 'success'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setLevelFilter(lvl)}
                className={`px-2 py-0.5 text-[10px] uppercase font-mono rounded transition-colors cursor-pointer ${
                  levelFilter === lvl
                    ? 'bg-neutral-800 text-neutral-100 font-semibold'
                    : 'text-neutral-400 hover:text-neutral-200'
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
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-6 pr-2 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-[11px] text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-violet-500/80 w-24 sm:w-32"
            />
          </div>

          {/* Auto-scroll Toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`p-1 rounded-md border text-[11px] font-mono transition-colors cursor-pointer ${
              autoScroll
                ? 'bg-violet-950/40 text-violet-300 border-violet-500/40'
                : 'bg-neutral-900 text-neutral-400 border-neutral-800 hover:text-neutral-200'
            }`}
            title={autoScroll ? 'Auto-scroll enabled' : 'Auto-scroll disabled'}
          >
            <ArrowDown className="w-3 h-3" />
          </button>

          {/* Copy Logs */}
          <button
            onClick={handleCopyLogs}
            className="p-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Copy filtered logs"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          </button>

          {/* Download Logs */}
          <button
            onClick={handleDownloadLogs}
            className="p-1 rounded-md bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-400 hover:text-neutral-200 transition-colors cursor-pointer"
            title="Download logs file"
          >
            <Download className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Independently Scrollable Terminal Logs Area */}
      <div
        ref={logsContainerRef}
        className="flex-1 p-4 font-mono text-[11px] overflow-y-auto space-y-1 bg-[#07090e] select-text"
      >
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className={`flex items-start gap-2.5 leading-relaxed hover:bg-neutral-900/40 px-1 rounded transition-colors ${
                log.level === 'error'
                  ? 'bg-rose-950/15 text-rose-300'
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
              <span className="shrink-0 select-none">{getLevelBadge(log.level)}</span>
              <span className="text-neutral-500 shrink-0 select-none">
                [{log.stepId}]
              </span>
              <span className="break-all whitespace-pre-wrap">{log.message}</span>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-neutral-600 italic">
            No console events match the current filter criteria.
          </div>
        )}
      </div>

      {/* Terminal Footer Bar */}
      <div className="px-3 py-1.5 bg-[#0e1117] border-t border-neutral-800/80 flex items-center justify-between text-[10px] text-neutral-500 font-mono select-none shrink-0">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>cgroup-pty-0 (isolated)</span>
        </span>
        <span>Height: {consoleHeight}px · Double-click top bar to reset</span>
      </div>
    </div>
  );
};
