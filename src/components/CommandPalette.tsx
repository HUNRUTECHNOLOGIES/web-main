import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  Code2,
  FolderGit2,
  Keyboard,
  Monitor,
  Search,
  Settings,
  ShieldCheck,
  Terminal,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { DEFAULT_SITE_SETTINGS, TECH_STACK_MATRIX } from '../data/seedCatalog.ts';
import { getDynamicDevToolShortcuts } from '../lib/devToolsConfig.ts';
import type { ApiPreset, DevToolId, ProjectItem } from '../types/hunrutech.ts';
import type { AppTheme } from './SettingsModal.tsx';

export type PaletteGroup =
  | 'Shortcuts'
  | 'Navigation'
  | 'DevTools'
  | 'Projects'
  | 'Docs'
  | 'Settings';
type FilterScope = 'All' | 'Shortcuts' | 'Projects' | 'Docs' | 'DevTools' | 'Settings';

export interface PaletteAction {
  id: string;
  label: string;
  subtitle?: string;
  keywords?: string;
  group: PaletteGroup;
  hint?: string;
  shortcut?: string;
  isActiveTool?: boolean;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  projects: ProjectItem[];
  apiPresets?: ApiPreset[];
  enabledTools?: DevToolId[];
  activeDevTool?: DevToolId;
  onNavigate: (route: 'home' | 'admin', sectionId?: string) => void;
  onSelectDevTool: (tool: DevToolId) => void;
  onOpenSettings?: () => void;
  onToggleTheme?: () => void;
  currentTheme?: AppTheme;
  matrixRain?: boolean;
  onToggleMatrixRain?: () => void;
}

const SCOPE_TABS: Array<{ id: FilterScope; label: string }> = [
  { id: 'All', label: 'All' },
  { id: 'Shortcuts', label: 'Shortcuts' },
  { id: 'Projects', label: 'Catalog' },
  { id: 'Docs', label: 'Docs & Presets' },
  { id: 'DevTools', label: 'Tools' },
  { id: 'Settings', label: 'Settings' },
];

export function CommandPalette({
  open,
  onClose,
  projects,
  apiPresets = [],
  enabledTools = DEFAULT_SITE_SETTINGS.enabledDevTools,
  activeDevTool,
  onNavigate,
  onSelectDevTool,
  onOpenSettings,
  onToggleTheme,
  currentTheme = 'obsidian',
  matrixRain = false,
  onToggleMatrixRain,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<FilterScope>('All');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setScope('All');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const dynamicShortcuts = useMemo(
    () => getDynamicDevToolShortcuts(enabledTools),
    [enabledTools]
  );

  const shortcutByToolId = useMemo(() => {
    const map = new Map<DevToolId, string>();
    for (const entry of dynamicShortcuts) {
      map.set(entry.id, entry.shortcutLabel);
    }
    return map;
  }, [dynamicShortcuts]);

  const filteredDynamicShortcuts = useMemo(() => {
    const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return dynamicShortcuts;
    return dynamicShortcuts.filter((entry) => {
      const haystack = `${entry.label} ${entry.shortLabel} ${entry.description} ${entry.keywords} ${entry.shortcutLabel} shortcut keybind devtools`.toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [dynamicShortcuts, query]);

  const actions = useMemo<PaletteAction[]>(() => {
    const dynamicShortcutActions: PaletteAction[] = dynamicShortcuts.map((entry) => ({
      id: `shortcut-tool-${entry.id}`,
      label: `Jump to ${entry.label}`,
      subtitle: entry.description,
      keywords: `shortcut keybind hotkey alt+${entry.digit} ${entry.digit} ${entry.keywords} ${entry.shortLabel}`,
      group: 'Shortcuts',
      shortcut: entry.shortcutLabel,
      hint: activeDevTool === entry.id ? 'Active' : entry.hint,
      isActiveTool: activeDevTool === entry.id,
      run: () => {
        onSelectDevTool(entry.id);
        onNavigate('home', 'devtools');
      },
    }));

    const dynamicToolActions: PaletteAction[] = dynamicShortcuts.map((entry) => ({
      id: `tool-${entry.id}`,
      label: entry.label,
      subtitle: entry.description,
      keywords: `${entry.keywords} alt+${entry.digit}`,
      group: 'DevTools',
      shortcut: entry.shortcutLabel,
      hint: entry.hint,
      isActiveTool: activeDevTool === entry.id,
      run: () => {
        onSelectDevTool(entry.id);
        onNavigate('home', 'devtools');
      },
    }));

    const base: PaletteAction[] = [
      {
        id: 'nav-catalog',
        label: 'Tools, Scripts & Software Showcase',
        subtitle: 'Filterable catalog across Software, CLI & Automation, and Web Apps',
        keywords: 'catalog showcase software scripts konsole-os projects',
        group: 'Navigation',
        hint: '#catalog',
        run: () => onNavigate('home', 'catalog'),
      },
      {
        id: 'nav-devtools',
        label: 'Interactive DevTools Hub',
        subtitle:
          'API Tester, SMTP diagnostics, JWT Decoder, Hashes, Password Gen, QR Scanner & Syntax Visualizer',
        keywords: 'devtools workbench tools api smtp jwt json hash qr password yaml bash syntax',
        group: 'Navigation',
        hint: '#devtools',
        run: () => onNavigate('home', 'devtools'),
      },
      {
        id: 'nav-collab',
        label: 'Developer Collaboration Portal',
        subtitle: 'Submit project pitches, security research, or check HNRT Reference ID status',
        keywords: 'collaboration portal submit pitch tracker reference id hnr',
        group: 'Navigation',
        hint: '#collaborate',
        run: () => onNavigate('home', 'collaborate'),
      },
      {
        id: 'nav-stack',
        label: 'Core Engineering Tech Stack & GitHub Activity',
        subtitle: 'Languages, frameworks, databases, @hunter-zen-RU stats & contribution heatmap',
        keywords: 'stack matrix github stats heatmap community socials support',
        group: 'Navigation',
        hint: '#stack',
        run: () => onNavigate('home', 'stack'),
      },
      {
        id: 'nav-admin',
        label: 'Protected Admin Console',
        subtitle: 'Manage catalog releases, collaboration inbox, API presets, and live system logs',
        keywords: 'admin dashboard protected route login settings rate limits',
        group: 'Navigation',
        hint: '/admin',
        run: () => onNavigate('admin'),
      },
      ...dynamicToolActions,
    ];

    const settingsActions: PaletteAction[] = [];
    if (onOpenSettings) {
      settingsActions.push({
        id: 'pref-settings',
        label: 'Open Display & Terminal Settings Menu',
        subtitle: 'Configure Obsidian vs Matrix theme, Matrix Rain canvas & keystroke audio',
        keywords: 'settings preferences theme matrix rain audio sound',
        group: 'Settings',
        hint: 'Preferences',
        run: onOpenSettings,
      });
    }
    if (onToggleTheme) {
      settingsActions.push({
        id: 'pref-theme',
        label:
          currentTheme === 'obsidian'
            ? 'Switch Theme to Matrix / Terminal (Neon Green)'
            : 'Switch Theme to Default Obsidian',
        subtitle: 'Toggle high-contrast phosphor green on pure black or default obsidian',
        keywords: 'theme dark obsidian matrix terminal neon green contrast',
        group: 'Settings',
        hint: currentTheme === 'obsidian' ? 'Obsidian' : 'Matrix',
        run: onToggleTheme,
      });
    }
    if (onToggleMatrixRain) {
      settingsActions.push({
        id: 'pref-matrix-rain',
        label: matrixRain
          ? 'Disable Matrix Rain Canvas Background'
          : 'Enable Matrix Rain Canvas Background',
        subtitle: 'Toggle animated falling glyph canvas integrated with Matrix/Terminal mode',
        keywords: 'matrix rain canvas background animation glyphs toggle',
        group: 'Settings',
        hint: matrixRain ? 'On' : 'Off',
        run: onToggleMatrixRain,
      });
    }

    const projActions: PaletteAction[] = projects.map((p) => ({
      id: `proj-${p.id}`,
      label: p.title,
      subtitle: `${p.category} · ${p.techStack.join(', ')} — ${p.summary}`,
      keywords: `${p.slug} ${p.category} ${p.version} ${p.techStack.join(' ')} ${p.cloneCommand} ${p.repoUrl}`,
      group: 'Projects',
      hint: p.version,
      run: () => onNavigate('home', 'catalog'),
    }));

    const presetDocActions: PaletteAction[] = apiPresets.map((preset) => ({
      id: `doc-preset-${preset.id}`,
      label: `${preset.name} API Template`,
      subtitle: preset.description,
      keywords: `docs documentation api template ${preset.category} ${preset.method} ${preset.url}`,
      group: 'Docs',
      hint: `${preset.category} · ${preset.method}`,
      run: () => {
        onSelectDevTool('api-tester');
        onNavigate('home', 'devtools');
      },
    }));

    const guideDocs: PaletteAction[] = [
      {
        id: 'doc-syntax-visualizer',
        label: 'Interactive Syntax Visualizer (YAML, JSON & Bash)',
        subtitle:
          'Highlight API presets, K8s NetworkPolicies, Falco rules, and Bash TLS audit scripts live',
        keywords: 'docs documentation syntax visualizer yaml json bash security config falco networkpolicy',
        group: 'Docs',
        shortcut: shortcutByToolId.get('syntax-visualizer'),
        hint: 'Security Docs',
        run: () => {
          onSelectDevTool(
            enabledTools.includes('syntax-visualizer') ? 'syntax-visualizer' : 'api-tester'
          );
          onNavigate('home', 'devtools');
        },
      },
      {
        id: 'doc-terminal-commands',
        label: 'Hero Terminal CLI Commands & History Guide',
        subtitle: 'Commands: help, whoami, projects, tools, keygen, qr, rain, theme, history -c',
        keywords: 'docs documentation cli terminal commands arrow history help ascii banner',
        group: 'Docs',
        hint: 'Terminal Docs',
        run: () => onNavigate('home', 'top'),
      },
      {
        id: 'doc-ssrf-proxy',
        label: 'SSRF-Hardened Proxy & Webhook Signing Docs',
        subtitle: 'Server-side egress validation blocks RFC1918 private IPs and signs Paystack HMAC',
        keywords: 'docs documentation security ssrf proxy paystack hmac sha512 webhook',
        group: 'Docs',
        hint: 'Security Docs',
        run: () => {
          onSelectDevTool('api-tester');
          onNavigate('home', 'devtools');
        },
      },
      {
        id: 'doc-collab-tracker',
        label: 'Collaboration Workflow & HNRT Reference Tracking',
        subtitle: 'Submissions generate an HNRT-XXXXXXXX code to track Pending/In Review/Approved status',
        keywords: 'docs documentation collaboration reference id status tracker privacy',
        group: 'Docs',
        hint: 'Portal Docs',
        run: () => onNavigate('home', 'collaborate'),
      },
      ...TECH_STACK_MATRIX.map((cat) => ({
        id: `doc-stack-${cat.group.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        label: `Tech Matrix: ${cat.group}`,
        subtitle: cat.items.join(' · '),
        keywords: `docs documentation stack technology ${cat.group} ${cat.items.join(' ')}`,
        group: 'Docs' as const,
        hint: 'Tech Matrix',
        run: () => onNavigate('home', 'stack'),
      })),
    ];

    return [
      ...dynamicShortcutActions,
      ...base,
      ...projActions,
      ...guideDocs,
      ...presetDocActions,
      ...settingsActions,
    ];
  }, [
    dynamicShortcuts,
    activeDevTool,
    shortcutByToolId,
    enabledTools,
    projects,
    apiPresets,
    onNavigate,
    onSelectDevTool,
    onOpenSettings,
    onToggleTheme,
    currentTheme,
    matrixRain,
    onToggleMatrixRain,
  ]);

  const filtered = useMemo(() => {
    const tokens = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    return actions.filter((item) => {
      if (scope === 'All') {
        // Avoid showing duplicate Shortcut rows in the All list since the dedicated Shortcuts section sits above
        if (item.group === 'Shortcuts') return false;
      } else if (item.group !== scope) {
        return false;
      }
      if (tokens.length === 0) return true;
      const haystack = [
        item.label,
        item.subtitle,
        item.keywords,
        item.group,
        item.hint,
        item.shortcut,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return tokens.every((tok) => haystack.includes(tok));
    });
  }, [actions, query, scope]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, scope]);

  const executeItem = (action?: PaletteAction) => {
    if (!action) return;
    onClose();
    action.run();
  };

  const executeShortcut = (toolId: DevToolId) => {
    onClose();
    onSelectDevTool(toolId);
    onNavigate('home', 'devtools');
  };

  const showShortcutStrip =
    (scope === 'All' || scope === 'DevTools') && filteredDynamicShortcuts.length > 0;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[8vh] px-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Global search and command palette"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-lg border border-white/15 bg-[#0F141C] shadow-2xl overflow-hidden"
          >
            {/* Global Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#0A0D12]">
              <Search className="w-4 h-4 text-[#00FF66] shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    onClose();
                  } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setActiveIndex((prev) => (filtered.length ? (prev + 1) % filtered.length : 0));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setActiveIndex((prev) =>
                      filtered.length ? (prev - 1 + filtered.length) % filtered.length : 0
                    );
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    executeItem(filtered[activeIndex]);
                  }
                }}
                placeholder="Global search: catalog, documentation, DevTools tabs, or Alt+1..8 shortcuts..."
                aria-label="Global keyword search across catalog, documentation, and tools"
                className="w-full bg-transparent text-sm text-white placeholder-[#64748B] focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery('');
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search query"
                  className="p-1 text-[#8B98A9] hover:text-white rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
              <kbd className="px-2 py-0.5 text-[10px] font-mono text-[#8B98A9] border border-white/12 rounded shrink-0">
                ESC
              </kbd>
            </div>

            {/* Category Scope Filter Bar */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/8 bg-[#121822] overflow-x-auto">
              <div className="flex items-center gap-1">
                {SCOPE_TABS.map((tab) => {
                  const active = scope === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setScope(tab.id)}
                      className={`px-2.5 py-1 text-[11px] font-mono rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#00FF66] text-[#0A0D12] font-semibold'
                          : 'text-[#8B98A9] hover:text-white hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] font-mono text-[#64748B] tabular-nums shrink-0 pr-1">
                {filtered.length} result{filtered.length === 1 ? '' : 's'}
              </span>
            </div>

            {/* Dynamic DevTools Keyboard Shortcuts Section */}
            {showShortcutStrip && (
              <div className="px-3 py-2.5 border-b border-white/8 bg-[#0B1017] space-y-2">
                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-[#C4CEDB]">
                    <Keyboard className="w-3.5 h-3.5 text-[#00FF66] shrink-0" />
                    <span>DevTools Keyboard Shortcuts</span>
                    <span aria-hidden="true" className="text-[#475569]">
                      ·
                    </span>
                    <span className="text-[#8B98A9] tabular-nums">
                      {filteredDynamicShortcuts.length} active
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-[#64748B] hidden sm:inline">
                    Press Alt + 1–{dynamicShortcuts.length} anywhere
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {filteredDynamicShortcuts.map((shortcut) => {
                    const isActive = activeDevTool === shortcut.id;
                    return (
                      <button
                        key={shortcut.id}
                        type="button"
                        onClick={() => executeShortcut(shortcut.id)}
                        aria-label={`Jump to ${shortcut.label} (${shortcut.shortcutLabel})`}
                        className={`flex items-center justify-between gap-2 px-2.5 py-1.5 rounded border text-left transition-colors cursor-pointer ${
                          isActive
                            ? 'border-[#00FF66]/55 bg-[#00FF66]/10 text-white'
                            : 'border-white/10 bg-[#0F141C] text-[#C4CEDB] hover:border-white/25 hover:text-white'
                        }`}
                      >
                        <span className="text-[11px] font-mono truncate">
                          {shortcut.shortLabel}
                        </span>
                        <kbd
                          className={`px-1.5 py-0.5 text-[10px] font-mono tabular-nums rounded border shrink-0 ${
                            isActive
                              ? 'border-[#00FF66]/60 bg-[#00FF66] text-[#0A0D12] font-semibold'
                              : 'border-white/12 bg-[#0A0D12] text-[#00E5FF]'
                          }`}
                        >
                          {shortcut.shortcutLabel}
                        </kbd>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Search Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-xs font-mono text-[#64748B]">
                  No catalog entries, documentation, or tools matched &ldquo;{query}&rdquo;.
                </p>
              ) : (
                filtered.map((item, idx) => {
                  const selected = idx === activeIndex;
                  const Icon =
                    item.group === 'Shortcuts'
                      ? Keyboard
                      : item.group === 'DevTools'
                      ? item.id === 'tool-syntax-visualizer'
                        ? Code2
                        : Wrench
                      : item.group === 'Projects'
                      ? FolderGit2
                      : item.group === 'Docs'
                      ? BookOpen
                      : item.group === 'Settings'
                      ? item.id === 'pref-theme'
                        ? Monitor
                        : Settings
                      : item.id === 'nav-admin'
                      ? ShieldCheck
                      : item.id === 'nav-collab'
                      ? Users
                      : Terminal;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => executeItem(item)}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-md text-left transition-colors cursor-pointer ${
                        selected
                          ? 'bg-[#00FF66]/12 text-white'
                          : 'text-[#C4CEDB] hover:bg-white/5'
                      }`}
                    >
                      <div className="flex items-start gap-2.5 min-w-0">
                        <Icon
                          className={`w-4 h-4 shrink-0 mt-0.5 ${
                            selected ? 'text-[#00FF66]' : 'text-[#8B98A9]'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{item.label}</p>
                          {item.subtitle && (
                            <p className="text-[11px] text-[#8B98A9] truncate mt-0.5">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.shortcut && (
                          <kbd
                            className={`px-1.5 py-0.5 text-[10px] font-mono tabular-nums rounded border ${
                              item.isActiveTool
                                ? 'border-[#00FF66]/60 bg-[#00FF66]/15 text-[#00FF66]'
                                : 'border-white/12 bg-[#0A0D12] text-[#00E5FF]'
                            }`}
                          >
                            {item.shortcut}
                          </kbd>
                        )}
                        <span className="font-mono text-[11px] text-[#64748B]">{item.group}</span>
                        {item.hint && (
                          <>
                            <span aria-hidden="true" className="text-[#475569]">
                              ·
                            </span>
                            <span
                              className={`font-mono text-[11px] ${
                                item.isActiveTool ? 'text-[#00FF66]' : 'text-[#00E5FF]'
                              }`}
                            >
                              {item.hint}
                            </span>
                          </>
                        )}
                        {selected && <ArrowRight className="w-3.5 h-3.5 text-[#00FF66]" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="px-4 py-2 border-t border-white/8 bg-[#0A0D12] flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[#64748B]">
              <span>↑ / ↓ Navigate · Enter Run · Alt+1..{dynamicShortcuts.length} DevTools</span>
              <span>HUNRUTECH Global Search · Ctrl+K</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
