import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CalendarDays, RefreshCw } from 'lucide-react';

interface HeatmapDay {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface GitHubActivityData {
  username: string;
  totalContributions: number;
  activeDays: number;
  longestStreak: number;
  weeks: Array<{ weekStart: string; days: HeatmapDay[] }>;
  fetchedAt: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const LEVEL_STYLES: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: 'bg-[#0A0D12] border-white/10',
  1: 'bg-[#0E4429] border-[#0E4429]',
  2: 'bg-[#006D32] border-[#006D32]',
  3: 'bg-[#26A641] border-[#26A641]',
  4: 'bg-[#00FF66] border-[#00FF66]',
};

export function GitHubActivityHeatmap() {
  const [activity, setActivity] = useState<GitHubActivityData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  const fetchActivity = async (forceRefresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/github/activity${forceRefresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not load GitHub commit activity.');
      } else {
        setActivity(data as GitHubActivityData);
      }
    } catch {
      setError('Unable to reach GitHub activity service.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivity(false);
  }, []);

  const monthLabels = useMemo(() => {
    if (!activity) return [];
    const labels: Array<{ weekIndex: number; label: string }> = [];
    let lastMonth = -1;
    activity.weeks.forEach((week, idx) => {
      const month = new Date(`${week.weekStart}T00:00:00Z`).getUTCMonth();
      if (month !== lastMonth) {
        labels.push({ weekIndex: idx, label: MONTH_NAMES[month] });
        lastMonth = month;
      }
    });
    return labels;
  }, [activity]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="p-6 rounded-lg border border-white/10 bg-[#0F141C] space-y-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-mono text-[#00E5FF]">
            <CalendarDays className="w-4 h-4" />
            <span>GitHub Activity Heatmap · Last 52 Weeks</span>
          </div>
          <h3 className="font-display text-lg font-semibold text-white">
            @hunter-zen-RU Contribution Frequency
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          {activity && (
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-[#8B98A9]">
              <span>
                <strong className="text-white">{activity.totalContributions}</strong> contributions
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-[#00FF66]">{activity.activeDays}</strong> active days
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-[#00E5FF]">{activity.longestStreak}d</strong> best streak
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => fetchActivity(true)}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#C4CEDB] hover:text-white bg-[#0A0D12] border border-white/12 hover:border-white/25 rounded-md transition-colors disabled:opacity-60 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {loading && !activity ? (
        <div className="h-32 rounded bg-[#0A0D12] border border-white/8 animate-pulse" />
      ) : error && !activity ? (
        <div className="p-4 rounded border border-white/10 bg-[#0A0D12] flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-mono text-[#94A3B8]">
            {error} Contribution heatmap for @hunter-zen-RU could not be loaded right now.
          </p>
          <button
            type="button"
            onClick={() => fetchActivity(true)}
            className="px-3 py-1.5 text-xs font-mono text-[#00FF66] border border-[#00FF66]/35 rounded hover:bg-[#00FF66]/10 cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : activity ? (
        <div className="space-y-3">
          <div className="overflow-x-auto pb-1">
            <div className="inline-block min-w-full">
              {/* Month Header Track */}
              <div className="flex items-center gap-1 pl-8 mb-1.5 relative h-4">
                {monthLabels.map((m) => (
                  <span
                    key={`${m.label}-${m.weekIndex}`}
                    style={{ left: `calc(2rem + ${m.weekIndex} * 14px)` }}
                    className="absolute text-[10px] font-mono text-[#8B98A9] whitespace-nowrap"
                  >
                    {m.label}
                  </span>
                ))}
              </div>

              {/* 7-Row Weekday Labels + 52-Week Cell Matrix */}
              <div className="flex items-start gap-2">
                <div className="grid grid-rows-7 gap-[3px] text-[10px] font-mono text-[#64748B] w-6 shrink-0 pt-[1px]">
                  <span className="h-[11px] leading-[11px]" />
                  <span className="h-[11px] leading-[11px]">Mon</span>
                  <span className="h-[11px] leading-[11px]" />
                  <span className="h-[11px] leading-[11px]">Wed</span>
                  <span className="h-[11px] leading-[11px]" />
                  <span className="h-[11px] leading-[11px]">Fri</span>
                  <span className="h-[11px] leading-[11px]" />
                </div>

                <div
                  className="grid grid-flow-col gap-[3px]"
                  role="grid"
                  aria-label="52-week GitHub contribution grid"
                >
                  {activity.weeks.map((week) => (
                    <div key={week.weekStart} className="grid grid-rows-7 gap-[3px]">
                      {week.days.map((day) => (
                        <button
                          key={day.date}
                          type="button"
                          onMouseEnter={() => setHoveredDay(day)}
                          onFocus={() => setHoveredDay(day)}
                          onMouseLeave={() => setHoveredDay(null)}
                          aria-label={`${day.date}: ${day.count} contributions`}
                          title={`${day.date}: ${day.count} contribution${day.count === 1 ? '' : 's'}`}
                          className={`w-[11px] h-[11px] rounded-[2px] border transition-transform duration-100 hover:scale-125 focus:outline-none focus:ring-1 focus:ring-[#00E5FF] cursor-pointer ${LEVEL_STYLES[day.level]}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Interactive Readout + Intensity Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1 text-[11px] font-mono">
            <span className="text-[#94A3B8] tabular-nums">
              {hoveredDay
                ? `${hoveredDay.date}: ${hoveredDay.count} contribution${hoveredDay.count === 1 ? '' : 's'}`
                : 'Hover any cell to inspect daily GitHub commit & event frequency.'}
            </span>

            <div className="flex items-center gap-1.5 text-[#8B98A9]">
              <span>Less</span>
              {([0, 1, 2, 3, 4] as const).map((lvl) => (
                <span
                  key={lvl}
                  className={`w-[11px] h-[11px] rounded-[2px] border inline-block ${LEVEL_STYLES[lvl]}`}
                  aria-hidden="true"
                />
              ))}
              <span>More</span>
            </div>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
}
