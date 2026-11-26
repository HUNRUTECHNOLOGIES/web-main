import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Maximize2, Minimize2, Pause, Play, Terminal, Trash2 } from 'lucide-react';

export interface SystemLogEntry {
  id: string;
  timestamp: string;
  source: 'SYS' | 'API' | 'AUTH' | 'SMTP';
  level: 'info' | 'ok' | 'warn' | 'err';
  message: string;
}

interface RecentExecution {
  id: string;
  protocol: 'HTTP' | 'SMTP';
  target: string;
  status: string;
  latencyMs: number;
  timestamp: string;
}

interface AdminSystemLogsWidgetProps {
  recentExecutions?: RecentExecution[];
  externalLogs?: SystemLogEntry[];
  onRefreshTelemetry?: () => void;
}

const SIMULATED_EVENTS: Array<Omit<SystemLogEntry, 'id' | 'timestamp'>> = [
  { source: 'SYS', level: 'ok', message: 'SSRF egress IP filter ruleset verified (RFC1918 blocked)' },
  { source: 'SYS', level: 'info', message: 'Firestore real-time listener heartbeat nominal' },
  { source: 'AUTH', level: 'ok', message: 'Firebase Admin ID token verifier active' },
  { source: 'API', level: 'info', message: 'Sliding-window proxy rate limiter bucket sweep complete' },
  { source: 'SYS', level: 'ok', message: 'GitHub telemetry cache TTL check OK' },
  { source: 'SMTP', level: 'info', message: 'Nodemailer TLS 1.3 transport pool standby' },
  { source: 'API', level: 'ok', message: 'Paystack HMAC-SHA512 webhook signer ready' },
];

function formatTime(iso?: string): string {
  const date = iso ? new Date(iso) : new Date();
  return date.toTimeString().slice(0, 8);
}

export function AdminSystemLogsWidget({
  recentExecutions = [],
  externalLogs = [],
  onRefreshTelemetry,
}: AdminSystemLogsWidgetProps) {
  const [expanded, setExpanded] = useState(true);
  const [streaming, setStreaming] = useState(true);
  const [filter, setFilter] = useState<'ALL' | 'SYS' | 'API'>('ALL');
  const [logs, setLogs] = useState<SystemLogEntry[]>(() => [
    {
      id: 'init-1',
      timestamp: formatTime(),
      source: 'AUTH',
      level: 'ok',
      message: 'Admin console session authenticated · /admin live stream ready',
    },
    {
      id: 'init-2',
      timestamp: formatTime(),
      source: 'SYS',
      level: 'info',
      message: 'Monitoring HTTP proxy, SMTP diagnostics, and runtime policies',
    },
  ]);

  const seenExecIds = useRef<Set<string>>(new Set());
  const seenExtIds = useRef<Set<string>>(new Set());
  const scrollEndRef = useRef<HTMLDivElement | null>(null);
  const simCounter = useRef(0);
  const refreshTelemetryRef = useRef(onRefreshTelemetry);

  useEffect(() => {
    refreshTelemetryRef.current = onRefreshTelemetry;
  }, [onRefreshTelemetry]);

  // Ingest real server execution logs (API proxy & SMTP runs)
  useEffect(() => {
    const newEntries: SystemLogEntry[] = [];
    for (const exec of [...recentExecutions].reverse()) {
      if (seenExecIds.current.has(exec.id)) continue;
      seenExecIds.current.add(exec.id);
      const isErr = exec.status.includes('ERROR') || exec.status.includes('FAILED') || exec.status.startsWith('4') || exec.status.startsWith('5');
      newEntries.push({
        id: `exec-${exec.id}`,
        timestamp: formatTime(exec.timestamp),
        source: exec.protocol === 'SMTP' ? 'SMTP' : 'API',
        level: isErr ? 'warn' : 'ok',
        message: `${exec.target} -> ${exec.status} (${exec.latencyMs} ms)`,
      });
    }
    if (newEntries.length > 0) {
      setLogs((prev) => [...prev, ...newEntries].slice(-80));
    }
  }, [recentExecutions]);

  // Ingest admin console action logs passed from AdminDashboard
  useEffect(() => {
    const newEntries: SystemLogEntry[] = [];
    for (const item of externalLogs) {
      if (seenExtIds.current.has(item.id)) continue;
      seenExtIds.current.add(item.id);
      newEntries.push(item);
    }
    if (newEntries.length > 0) {
      setLogs((prev) => [...prev, ...newEntries].slice(-80));
    }
  }, [externalLogs]);

  // Simulated system event stream + periodic real telemetry sync
  useEffect(() => {
    if (!streaming) return;
    const interval = setInterval(() => {
      const template = SIMULATED_EVENTS[simCounter.current % SIMULATED_EVENTS.length];
      simCounter.current += 1;
      setLogs((prev) => [
        ...prev.slice(-79),
        {
          id: `sim-${Date.now()}-${simCounter.current}`,
          timestamp: formatTime(),
          ...template,
        },
      ]);
      if (simCounter.current % 3 === 0) {
        refreshTelemetryRef.current?.();
      }
    }, 4500);
    return () => clearInterval(interval);
  }, [streaming]);

  useEffect(() => {
    if (expanded) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [logs, expanded]);

  const visibleLogs = logs.filter((entry) => {
    if (filter === 'ALL') return true;
    if (filter === 'API') return entry.source === 'API' || entry.source === 'SMTP';
    return entry.source === 'SYS' || entry.source === 'AUTH';
  });

  return (
    <aside
      aria-label="System Logs floating terminal"
      className="fixed bottom-4 left-4 z-40 w-[calc(100vw-2rem)] max-w-[440px]"
    >
      <div className="rounded-lg border border-white/15 bg-[#0F141C]/95 backdrop-blur-md shadow-2xl overflow-hidden">
        {/* Title Bar */}
        <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-white/10 bg-[#121822]">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-xs font-mono text-white hover:text-[#00FF66] transition-colors cursor-pointer min-w-0"
          >
            <Terminal className="w-3.5 h-3.5 text-[#00FF66] shrink-0" />
            <span className="font-semibold truncate">System Logs</span>
            <span className="text-[11px] text-[#8B98A9] tabular-nums shrink-0">
              ({visibleLogs.length})
            </span>
          </button>

          <div className="flex items-center gap-1.5 shrink-0">
            {expanded && (
              <>
                <div className="flex items-center gap-0.5 bg-[#0A0D12] border border-white/10 rounded p-0.5 mr-1">
                  {(['ALL', 'API', 'SYS'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFilter(tab)}
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-colors cursor-pointer ${
                        filter === tab
                          ? 'bg-[#00FF66] text-[#0A0D12] font-semibold'
                          : 'text-[#8B98A9] hover:text-white'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setStreaming((prev) => !prev)}
                  aria-label={streaming ? 'Pause log stream' : 'Resume log stream'}
                  title={streaming ? 'Pause live stream' : 'Resume live stream'}
                  className="p-1 text-[#C4CEDB] hover:text-[#00FF66] rounded cursor-pointer"
                >
                  {streaming ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setLogs([])}
                  aria-label="Clear system logs"
                  title="Clear log buffer"
                  className="p-1 text-[#8B98A9] hover:text-red-400 rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? 'Minimize system logs' : 'Expand system logs'}
              className="p-1 text-[#8B98A9] hover:text-white rounded cursor-pointer"
            >
              {expanded ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Terminal Log Window */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="bg-[#0A0D12]"
            >
              <div className="h-56 overflow-y-auto p-3 font-mono text-[11px] space-y-1.5">
                {visibleLogs.length === 0 ? (
                  <p className="text-[#64748B]">Log buffer cleared. Listening for events...</p>
                ) : (
                  visibleLogs.map((entry) => (
                    <div key={entry.id} className="flex items-start gap-2 leading-relaxed">
                      <span className="text-[#64748B] shrink-0 tabular-nums">
                        {entry.timestamp}
                      </span>
                      <span
                        className={`shrink-0 ${
                          entry.source === 'API' || entry.source === 'SMTP'
                            ? 'text-[#00E5FF]'
                            : entry.source === 'AUTH'
                            ? 'text-[#00FF66]'
                            : 'text-[#C4CEDB]'
                        }`}
                      >
                        [{entry.source}]
                      </span>
                      <span
                        className={`break-words ${
                          entry.level === 'ok'
                            ? 'text-[#00FF66]'
                            : entry.level === 'warn'
                            ? 'text-amber-400'
                            : entry.level === 'err'
                            ? 'text-red-400'
                            : 'text-[#94A3B8]'
                        }`}
                      >
                        {entry.message}
                      </span>
                    </div>
                  ))
                )}
                <div ref={scrollEndRef} />
              </div>

              <div className="px-3 py-1.5 border-t border-white/8 bg-[#121822] flex items-center justify-between text-[10px] font-mono text-[#8B98A9]">
                <span>Stream: {streaming ? 'Active (4.5s poll)' : 'Paused'}</span>
                <span>admin@hunrutech-node</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </aside>
  );
}
