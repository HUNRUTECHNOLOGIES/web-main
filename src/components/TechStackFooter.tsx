import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ExternalLink, GitFork, Github, Heart, RefreshCw, Settings, Star } from 'lucide-react';
import {
  SOCIAL_ECOSYSTEM_LINKS,
  SUPPORT_LINKS,
  TECH_STACK_MATRIX,
} from '../data/seedCatalog.ts';
import type { AppTheme } from './SettingsModal.tsx';
import { GitHubActivityHeatmap } from './GitHubActivityHeatmap.tsx';

interface GitHubStatsData {
  username: string;
  profileUrl: string;
  repoCount: number;
  starCount: number;
  followers: number;
  languages: Array<{ name: string; count: number; percentage: number }>;
  fetchedAt: string;
}

interface TechStackFooterProps {
  onOpenAdmin: () => void;
  onOpenSettings?: () => void;
  currentTheme?: AppTheme;
}

const LANG_COLORS = [
  '#00FF66',
  '#00E5FF',
  '#38BDF8',
  '#A3E635',
  '#FBBF24',
  '#94A3B8',
];

export function TechStackFooter({
  onOpenAdmin,
  onOpenSettings,
  currentTheme = 'obsidian',
}: TechStackFooterProps) {
  const [ghStats, setGhStats] = useState<GitHubStatsData | null>(null);
  const [ghLoading, setGhLoading] = useState(true);
  const [ghError, setGhError] = useState<string | null>(null);

  const loadGithubStats = async (forceRefresh = false) => {
    setGhLoading(true);
    setGhError(null);
    try {
      const res = await fetch(`/api/github/stats${forceRefresh ? '?refresh=1' : ''}`);
      const data = await res.json();
      if (!res.ok) {
        setGhError(data.error || 'Could not load GitHub telemetry.');
      } else {
        setGhStats(data as GitHubStatsData);
      }
    } catch {
      setGhError('Unable to reach GitHub stats service.');
    } finally {
      setGhLoading(false);
    }
  };

  useEffect(() => {
    loadGithubStats(false);
  }, []);

  return (
    <>
      <section id="stack" className="border-b border-white/8 bg-[#0A0D12]">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 space-y-12">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-2 max-w-2xl"
          >
            <p className="font-mono text-xs text-[#00FF66]">04. Technology Matrix &amp; Community</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              Core Engineering Stack
            </h2>
            <p className="text-sm sm:text-base text-[#94A3B8]">
              Production languages, runtime frameworks, database engines, and creative suites used
              across HUNRUTECH projects.
            </p>
          </motion.div>

          {/* 4-Column Categorized Tech Matrix */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {TECH_STACK_MATRIX.map((category, index) => (
              <motion.div
                key={category.group}
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.1 }}
                transition={{
                  duration: 0.22,
                  delay: index * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="p-5 rounded-lg border border-white/10 hover:border-white/20 bg-[#0F141C] space-y-4 transition-colors duration-150"
              >
                <h3 className="font-display text-sm font-semibold text-[#00E5FF] pb-2 border-b border-white/8">
                  {category.group}
                </h3>
                <ul className="space-y-2">
                  {category.items.map((tech) => (
                    <li
                      key={tech}
                      className="font-mono text-xs text-[#E6EDF3] flex items-center justify-between"
                    >
                      <span>{tech}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
            ))}
          </div>

          {/* Ecosystem Socials & Open-Source Support */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6 border-t border-white/8">
            <div className="lg:col-span-7 space-y-4">
              <h3 className="font-display text-lg font-semibold text-white">
                HUNRUTECH Ecosystem Channels
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {SOCIAL_ECOSYSTEM_LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-2.5 rounded-md border border-white/10 bg-[#0F141C] hover:border-[#00FF66]/40 text-xs font-mono text-[#C4CEDB] hover:text-white transition-colors"
                  >
                    <span>{link.label}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-[#8B98A9]" />
                  </a>
                ))}
              </div>
            </div>

            <div className="lg:col-span-5 p-6 rounded-lg border border-white/10 bg-[#0F141C] flex flex-col justify-between space-y-5">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-mono text-[#00FF66]">
                  <Heart className="w-4 h-4" />
                  <span>Open-Source Sponsorship</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  Support Independent Tooling
                </h3>
                <p className="text-xs text-[#94A3B8] leading-relaxed">
                  Back ongoing development of Konsole-OS, Zero One security utilities, and
                  open-source developer infrastructure.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {SUPPORT_LINKS.map((sup) => (
                  <a
                    key={sup.label}
                    href={sup.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-white/12 bg-[#0A0D12] hover:border-[#00FF66] text-xs font-medium text-white transition-colors"
                  >
                    <span>{sup.label}</span>
                    <ExternalLink className="w-3 h-3 text-[#00FF66]" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Developer Stats Section (Live GitHub API for @hunter-zen-RU) */}
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="p-6 rounded-lg border border-white/10 bg-[#0F141C] space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/8 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs font-mono text-[#00FF66]">
                  <Github className="w-4 h-4" />
                  <span>Developer Stats · GitHub Live Telemetry</span>
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  @hunter-zen-RU Open-Source Profile
                </h3>
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => loadGithubStats(true)}
                  disabled={ghLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#C4CEDB] hover:text-white bg-[#0A0D12] border border-white/12 hover:border-white/25 rounded-md transition-colors disabled:opacity-60 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${ghLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <a
                  href={ghStats?.profileUrl || 'https://github.com/hunter-zen-RU'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#00E5FF] hover:text-white bg-[#0A0D12] border border-[#00E5FF]/25 hover:border-[#00E5FF]/60 rounded-md transition-colors"
                >
                  <span>View GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>

            {ghLoading && !ghStats ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
                <div className="md:col-span-4 h-20 rounded bg-[#0A0D12] border border-white/8 animate-pulse" />
                <div className="md:col-span-8 h-20 rounded bg-[#0A0D12] border border-white/8 animate-pulse" />
              </div>
            ) : ghError && !ghStats ? (
              <div className="p-4 rounded border border-white/10 bg-[#0A0D12] flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs font-mono text-[#94A3B8]">
                  {ghError} Live stats for @hunter-zen-RU could not be retrieved right now.
                </p>
                <button
                  type="button"
                  onClick={() => loadGithubStats(true)}
                  className="px-3 py-1.5 text-xs font-mono text-[#00FF66] border border-[#00FF66]/35 rounded hover:bg-[#00FF66]/10 cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : ghStats ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                {/* Numeric Counters */}
                <div className="md:col-span-5 grid grid-cols-3 gap-4">
                  <div className="p-3.5 rounded border border-white/10 bg-[#0A0D12] space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8B98A9]">
                      <GitFork className="w-3.5 h-3.5 text-[#00FF66]" />
                      <span>Repos</span>
                    </div>
                    <p className="font-mono text-2xl font-bold text-white tabular-nums">
                      {ghStats.repoCount}
                    </p>
                  </div>

                  <div className="p-3.5 rounded border border-white/10 bg-[#0A0D12] space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8B98A9]">
                      <Star className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Stars</span>
                    </div>
                    <p className="font-mono text-2xl font-bold text-white tabular-nums">
                      {ghStats.starCount}
                    </p>
                  </div>

                  <div className="p-3.5 rounded border border-white/10 bg-[#0A0D12] space-y-1">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#8B98A9]">
                      <Github className="w-3.5 h-3.5 text-[#C4CEDB]" />
                      <span>Followers</span>
                    </div>
                    <p className="font-mono text-2xl font-bold text-white tabular-nums">
                      {ghStats.followers}
                    </p>
                  </div>
                </div>

                {/* Language Distribution */}
                <div className="md:col-span-7 space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#C4CEDB]">Language Distribution</span>
                    <span className="text-[#8B98A9] text-[11px]">
                      {ghStats.languages.length > 0
                        ? `Top ${ghStats.languages.length} primary languages`
                        : 'No language metadata reported'}
                    </span>
                  </div>

                  {ghStats.languages.length > 0 && (
                    <>
                      <div
                        className="h-2.5 w-full rounded-sm overflow-hidden bg-[#0A0D12] border border-white/10 flex"
                        aria-label="GitHub repository language distribution bar"
                      >
                        {ghStats.languages.map((lang, idx) => (
                          <div
                            key={lang.name}
                            style={{
                              width: `${Math.max(lang.percentage, 3)}%`,
                              backgroundColor: LANG_COLORS[idx % LANG_COLORS.length],
                            }}
                            title={`${lang.name}: ${lang.percentage}% (${lang.count} repos)`}
                            className="h-full transition-all duration-300"
                          />
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs font-mono tabular-nums">
                        {ghStats.languages.map((lang, idx) => (
                          <div key={lang.name} className="inline-flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-xs shrink-0"
                              style={{ backgroundColor: LANG_COLORS[idx % LANG_COLORS.length] }}
                              aria-hidden="true"
                            />
                            <span className="text-white">{lang.name}</span>
                            <span className="text-[#8B98A9]">{lang.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </motion.div>

          {/* GitHub Activity Heatmap (Live @hunter-zen-RU 52-week commit grid) */}
          <GitHubActivityHeatmap />
        </div>
      </section>

      {/* Quiet Footer */}
      <footer className="bg-[#0A0D12] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8B98A9]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-display font-semibold text-white">HUNRUTECH</span>
            <span aria-hidden="true">·</span>
            <span>Made with Curiosity at HUNRUTECH</span>
            <span aria-hidden="true">·</span>
            <span>© {new Date().getFullYear()} Johnmark (HUNTER ZEN RU)</span>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <a href="#catalog" className="hover:text-white transition-colors">
              Catalog
            </a>
            <a href="#devtools" className="hover:text-white transition-colors">
              DevTools
            </a>
            <a href="#collaborate" className="hover:text-white transition-colors">
              Collaborate
            </a>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="inline-flex items-center gap-1.5 text-[#C4CEDB] hover:text-[#00FF66] transition-colors cursor-pointer"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>
                  Settings ({currentTheme === 'matrix' ? 'Matrix' : 'Obsidian'})
                </span>
              </button>
            )}
            <button
              type="button"
              onClick={onOpenAdmin}
              className="text-[#00E5FF] hover:underline cursor-pointer"
            >
              Admin Console
            </button>
          </div>
        </div>
      </footer>
    </>
  );
}
