import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Terminal,
  Shield,
  Code2,
  Cpu,
  Layers,
  Command,
  Settings,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { FOUNDER_PORTRAIT_IMAGE, HERO_WORKSTATION_IMAGE } from '../data/seedCatalog.ts';
import { playTerminalKeystroke } from '../lib/terminalAudio.ts';
import { AsciiLogoBanner } from './AsciiLogoBanner.tsx';
import type { DevToolId } from '../types/hunrutech.ts';

interface HeroSectionProps {
  onJumpToSection: (sectionId: string) => void;
  onSelectDevToolTab?: (tab: DevToolId) => void;
  onOpenCommandPalette?: () => void;
  onOpenSettings?: () => void;
  onToggleTheme?: () => void;
  onToggleMatrixRain?: () => void;
  soundEnabled?: boolean;
  onToggleSound?: () => void;
}

interface TerminalLine {
  id: string;
  cmd?: string;
  output: string[];
}

const INITIAL_HISTORY: TerminalLine[] = [
  {
    id: 'boot-1',
    cmd: 'cat /etc/hunrutech/motd',
    output: [
      'HUNRUTECH Ecosystem · hunter-zen-RU · HUNRUTECHNOLOGIES',
      'Led by Johnmark (HUNTER ZEN RU) & Zero One Community',
      'Motto: "Made with Curiosity at HUNRUTECH"',
      'Type "help" or use Up/Down arrows for command history.',
    ],
  },
];

const DISCIPLINES = [
  {
    num: '01.',
    title: 'Full-Stack Web Engineering',
    desc: 'Next.js, TypeScript, REST & RPC architectures deployed with strict input validation.',
    icon: Code2,
  },
  {
    num: '02.',
    title: 'Software & Systems Development',
    desc: 'Android TUI environments (Konsole-OS), automated media workers, and systems tooling.',
    icon: Cpu,
  },
  {
    num: '03.',
    title: 'Graphic & UI/UX Design',
    desc: 'Precision dark-mode developer workspaces, Figma design systems, and 3D pipelines.',
    icon: Layers,
  },
  {
    num: '04.',
    title: 'Ethical Hacking & Security',
    desc: 'Authorized offensive audits, TLS diagnostics, SSRF-hardened proxies, and recon scripts.',
    icon: Shield,
  },
];

export function HeroSection({
  onJumpToSection,
  onSelectDevToolTab,
  onOpenCommandPalette,
  onOpenSettings,
  onToggleTheme,
  onToggleMatrixRain,
  soundEnabled: externalSoundEnabled,
  onToggleSound,
}: HeroSectionProps) {
  const [history, setHistory] = useState<TerminalLine[]>(INITIAL_HISTORY);
  const [commandHistory, setCommandHistory] = useState<string[]>(() => {
    const defaults = ['cat /etc/hunrutech/motd', 'whoami', 'help'];
    if (typeof window === 'undefined') return defaults;
    try {
      const saved = window.localStorage.getItem('hunrutech-terminal-history');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.every((x) => typeof x === 'string') && parsed.length > 0) {
          return parsed.slice(-50);
        }
      }
    } catch {
      // Ignore storage error
    }
    return defaults;
  });
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [draftCommand, setDraftCommand] = useState<string>('');
  const [commandInput, setCommandInput] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [portraitFailed, setPortraitFailed] = useState(false);
  const [internalSoundEnabled, setInternalSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.localStorage.getItem('hunrutech-terminal-sound') !== 'off';
  });
  const soundEnabled = externalSoundEnabled ?? internalSoundEnabled;
  const terminalEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const toggleTerminalSound = () => {
    if (onToggleSound) {
      onToggleSound();
      return;
    }
    setInternalSoundEnabled((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('hunrutech-terminal-sound', next ? 'on' : 'off');
      } catch {
        // Ignore storage errors
      }
      if (next) {
        playTerminalKeystroke('nav', true);
      }
      return next;
    });
  };

  const runCommand = (rawCmd: string) => {
    const trimmed = rawCmd.trim();
    const cmd = trimmed.toLowerCase();
    if (!cmd) return;

    playTerminalKeystroke('enter', soundEnabled);

    setCommandHistory((prev) => {
      const next = prev[prev.length - 1] === trimmed ? prev : [...prev.slice(-49), trimmed];
      try {
        window.localStorage.setItem('hunrutech-terminal-history', JSON.stringify(next));
      } catch {
        // Ignore storage error
      }
      return next;
    });
    setHistoryIndex(-1);
    setDraftCommand('');

    if (cmd === 'clear') {
      setHistory([]);
      setCommandInput('');
      return;
    }

    if (cmd === 'history -c' || cmd === 'clear-history') {
      setCommandHistory([]);
      try {
        window.localStorage.removeItem('hunrutech-terminal-history');
      } catch {
        // Ignore storage error
      }
      setHistory((prev) => [
        ...prev.slice(-8),
        { id: `${Date.now()}-${Math.random()}`, cmd: trimmed, output: ['Command history cleared.'] },
      ]);
      setCommandInput('');
      return;
    }

    let output: string[] = [];
    if (cmd === 'help') {
      output = [
        'Available commands:',
        '  whoami     Display founder, ecosystem handles & Zero One Community info',
        '  projects   Jump to the Tools, Scripts & Software Showcase',
        '  tools      Launch the interactive API, Daraja, Paystack & SMTP Workbench',
        '  keygen     Open the Cryptographic Password Generator in DevTools',
        '  qr         Open the Camera QR Code Scanner in DevTools',
        '  syntax     Open the Interactive Syntax Visualizer (YAML, JSON, Bash)',
        '  collab     Open the Developer Collaboration Portal & Reference Tracker',
        '  stack      Inspect languages, frameworks, cloud & design matrix',
        '  socials    List ecosystem links & open-source support channels',
        '  palette    Open the Quick Command Palette (or press Ctrl+K / Cmd+K)',
        '  theme      Toggle between Obsidian and Matrix/Terminal theme',
        '  rain       Toggle canvas Matrix rain background on/off',
        '  settings   Open Display & Terminal Settings menu',
        '  history    List executed commands (or use Up/Down arrows; "history -c" clears)',
        '  clear      Clear terminal buffer',
      ];
    } else if (cmd === 'theme') {
      output = ['Toggling color theme between Obsidian and Matrix/Terminal...'];
      setTimeout(() => onToggleTheme?.(), 80);
    } else if (cmd === 'rain' || cmd === 'matrix') {
      output = ['Toggling canvas Matrix rain background...'];
      setTimeout(() => onToggleMatrixRain?.(), 80);
    } else if (cmd === 'settings') {
      output = ['Opening Display & Terminal Settings menu...'];
      setTimeout(() => onOpenSettings?.(), 80);
    } else if (cmd === 'palette') {
      output = ['Opening HUNRUTECH Quick Command Palette...'];
      setTimeout(() => onOpenCommandPalette?.(), 80);
    } else if (cmd === 'history') {
      const items =
        commandHistory[commandHistory.length - 1] === trimmed
          ? commandHistory
          : [...commandHistory, trimmed];
      output = items.map((entry, idx) => `  ${String(idx + 1).padStart(2, ' ')}  ${entry}`);
    } else if (cmd === 'whoami') {
      output = [
        'Founder: Johnmark (HUNTER ZEN RU)',
        'Ecosystem: @hunter-zen-RU | @hunrutech | @HUNRUTECHNOLOGIES',
        'Community: Zero One Community',
        'Focus: Full-Stack Web, Systems Software, UI/UX, Ethical Hacking',
      ];
    } else if (cmd === 'projects') {
      output = ['Opening Tools, Scripts & Software Showcase (Konsole-OS, Kali Org Portal, Recon)...'];
      setTimeout(() => onJumpToSection('catalog'), 120);
    } else if (cmd === 'tools') {
      output = ['Launching HUNRUTECH DevTools Hub (REST Proxy, Daraja, Paystack, Supabase, SMTP)...'];
      onSelectDevToolTab?.('api-tester');
      setTimeout(() => onJumpToSection('devtools'), 120);
    } else if (cmd === 'keygen' || cmd === 'password') {
      output = ['Opening Cryptographic Random Password Generator in DevTools Hub...'];
      onSelectDevToolTab?.('password-gen');
      setTimeout(() => onJumpToSection('devtools'), 120);
    } else if (cmd === 'qr' || cmd === 'scan') {
      output = ['Opening Camera QR Code Scanner in DevTools Hub...'];
      onSelectDevToolTab?.('qr-scanner');
      setTimeout(() => onJumpToSection('devtools'), 120);
    } else if (cmd === 'syntax' || cmd === 'visualizer') {
      output = ['Opening Interactive Syntax Visualizer (YAML, JSON & Bash) in DevTools Hub...'];
      onSelectDevToolTab?.('syntax-visualizer');
      setTimeout(() => onJumpToSection('devtools'), 120);
    } else if (cmd === 'collab') {
      output = ['Navigating to Developer Collaboration Portal & Reference ID Tracker...'];
      setTimeout(() => onJumpToSection('collaborate'), 120);
    } else if (cmd === 'stack') {
      output = ['Scrolling to categorized Tech Stack Matrix...'];
      setTimeout(() => onJumpToSection('stack'), 120);
    } else if (cmd === 'socials') {
      output = [
        'GitHub: github.com/hunter-zen-RU · github.com/hunrutech · github.com/HUNRUTECHNOLOGIES',
        'Community: Zero One Discord · LinkedIn · X · Behance · YouTube',
      ];
      setTimeout(() => onJumpToSection('stack'), 150);
    } else {
      output = [`hunrutech: command not found: "${cmd}". Type "help" for available commands.`];
    }

    setHistory((prev) => [
      ...prev.slice(-8),
      { id: `${Date.now()}-${Math.random()}`, cmd: trimmed, output },
    ]);
    setCommandInput('');
    setTimeout(() => {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 50);
  };

  const placeCaretAtEnd = (val: string) => {
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (el) {
        el.setSelectionRange(val.length, val.length);
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      if (commandHistory.length === 0) return;
      e.preventDefault();
      playTerminalKeystroke('nav', soundEnabled);
      if (historyIndex === -1) {
        setDraftCommand(commandInput);
        const nextIdx = commandHistory.length - 1;
        const nextCmd = commandHistory[nextIdx];
        setHistoryIndex(nextIdx);
        setCommandInput(nextCmd);
        placeCaretAtEnd(nextCmd);
      } else {
        const nextIdx = Math.max(0, historyIndex - 1);
        const nextCmd = commandHistory[nextIdx];
        setHistoryIndex(nextIdx);
        setCommandInput(nextCmd);
        placeCaretAtEnd(nextCmd);
      }
    } else if (e.key === 'ArrowDown') {
      if (historyIndex === -1) return;
      e.preventDefault();
      playTerminalKeystroke('nav', soundEnabled);
      if (historyIndex >= commandHistory.length - 1) {
        setHistoryIndex(-1);
        setCommandInput(draftCommand);
        placeCaretAtEnd(draftCommand);
      } else {
        const nextIdx = historyIndex + 1;
        const nextCmd = commandHistory[nextIdx];
        setHistoryIndex(nextIdx);
        setCommandInput(nextCmd);
        placeCaretAtEnd(nextCmd);
      }
    } else if (
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete')
    ) {
      playTerminalKeystroke('type', soundEnabled);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    runCommand(commandInput);
  };

  return (
    <section id="top" className="relative border-b border-white/8">
      <div className="max-w-7xl mx-auto px-6 py-12 lg:py-16">
        <AsciiLogoBanner />

        {/* Main Hero Split: 2 balanced columns with items-stretch */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Left Column: Brand Proposition + CTAs + Interactive Terminal */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-7 flex flex-col justify-between space-y-8"
          >
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#8B98A9]">
                <span className="text-[#00FF66]">HUNRUTECH</span>
                <span aria-hidden="true">·</span>
                <span>hunter-zen-RU</span>
                <span aria-hidden="true">·</span>
                <span>HUNRUTECHNOLOGIES</span>
                <span aria-hidden="true">·</span>
                <span>Zero One Community</span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.25rem] font-bold tracking-tight text-white leading-[1.1]">
                Engineering secure systems, developer tools, and offensive security software.
              </h1>

              <p className="text-base sm:text-lg text-[#B5C0CE] max-w-2xl leading-relaxed">
                Led by founder <span className="text-white font-medium">Johnmark (HUNTER ZEN RU)</span>,
                HUNRUTECH unites full-stack architecture, mobile terminal tooling, UI/UX craft, and
                ethical hacking under one principle:{' '}
                <span className="text-[#00E5FF] font-medium">Made with Curiosity at HUNRUTECH</span>.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <button
                  type="button"
                  onClick={() => onJumpToSection('devtools')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]/60 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Launch Dev Tools</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onJumpToSection('collaborate')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-[#E6EDF3] bg-[#0F141C] hover:bg-[#141B26] hover:border-white/25 active:scale-[0.98] border border-white/15 rounded-md transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00E5FF]/50 whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <span>Request Collaboration</span>
                </button>
              </div>
            </div>

            {/* Interactive Hero Terminal Console */}
            <div
              onClick={() => inputRef.current?.focus()}
              className="rounded-lg border border-white/10 hover:border-white/20 bg-[#0F141C] overflow-hidden transition-colors duration-150"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 border-b border-white/8 bg-[#121822]">
                <div className="flex items-center gap-2 text-xs font-mono text-[#8B98A9]">
                  <Terminal className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span>johnmark@hunrutech-kali:~</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {(['help', 'projects', 'tools', 'collab'] as const).map((quickCmd) => (
                    <button
                      key={quickCmd}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        runCommand(quickCmd);
                      }}
                      className="px-2 py-0.5 text-[11px] font-mono text-[#C4CEDB] hover:text-[#00FF66] hover:border-[#00FF66]/40 active:scale-[0.97] bg-[#0A0D12] border border-white/10 rounded transition-all duration-150 cursor-pointer whitespace-nowrap"
                    >
                      {quickCmd}
                    </button>
                  ))}
                  {onOpenCommandPalette && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playTerminalKeystroke('nav', soundEnabled);
                        onOpenCommandPalette();
                      }}
                      title="Open Quick Command Palette (Ctrl+K)"
                      className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-[#00E5FF] hover:text-white hover:border-[#00E5FF]/40 active:scale-[0.97] bg-[#0A0D12] border border-[#00E5FF]/25 rounded transition-all duration-150 cursor-pointer whitespace-nowrap"
                    >
                      <Command className="w-3 h-3" />
                      <span>K</span>
                    </button>
                  )}
                  {onOpenSettings && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playTerminalKeystroke('nav', soundEnabled);
                        onOpenSettings();
                      }}
                      aria-label="Open display and terminal settings"
                      title="Settings (Theme & Matrix Rain)"
                      className="p-1 rounded border text-[#C4CEDB] hover:text-[#00FF66] border-white/10 hover:border-[#00FF66]/40 bg-[#0A0D12] transition-colors cursor-pointer"
                    >
                      <Settings className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTerminalSound();
                    }}
                    aria-label={
                      soundEnabled
                        ? 'Mute terminal keystroke audio'
                        : 'Enable terminal keystroke audio'
                    }
                    title={soundEnabled ? 'Keystroke audio: On' : 'Keystroke audio: Muted'}
                    className={`p-1 rounded border transition-colors cursor-pointer ${
                      soundEnabled
                        ? 'text-[#00FF66] border-[#00FF66]/25 bg-[#0A0D12] hover:border-[#00FF66]/50'
                        : 'text-[#64748B] border-white/10 bg-[#0A0D12] hover:text-white'
                    }`}
                  >
                    {soundEnabled ? (
                      <Volume2 className="w-3 h-3" />
                    ) : (
                      <VolumeX className="w-3 h-3" />
                    )}
                  </button>
                </div>
              </div>

              <div className="p-4 font-mono text-xs space-y-2.5 max-h-52 overflow-y-auto">
                {history.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-1"
                  >
                    {item.cmd && (
                      <div className="flex items-center gap-2 text-[#E6EDF3]">
                        <span className="text-[#00FF66]">$</span>
                        <span>{item.cmd}</span>
                      </div>
                    )}
                    {item.output.map((line, idx) => (
                      <div key={idx} className="text-[#94A3B8] pl-4 whitespace-pre-wrap">
                        {line}
                      </div>
                    ))}
                  </motion.div>
                ))}

                {/* Live Active Prompt Mirror with Blinking Block Cursor */}
                <div className="flex items-center gap-2 text-[#E6EDF3] pt-0.5">
                  <span className="text-[#00FF66] shrink-0">hunrutech@kali:~$</span>
                  <span className="break-all">
                    {commandInput}
                    <span
                      aria-hidden="true"
                      className="inline-block w-2 h-3.5 align-middle bg-[#00FF66] ml-0.5 terminal-cursor-blink"
                    />
                  </span>
                </div>

                <div ref={terminalEndRef} />
              </div>

              <form
                onSubmit={handleSubmit}
                className="flex items-center gap-2 px-4 py-2.5 border-t border-white/8 bg-[#0A0D12]"
              >
                <span className="font-mono text-xs text-[#00FF66] shrink-0 flex items-center gap-1.5">
                  <span>hunrutech@kali:~$</span>
                  <span
                    aria-hidden="true"
                    className="inline-block w-1.5 h-3.5 bg-[#00FF66] terminal-cursor-blink"
                  />
                </span>
                <input
                  ref={inputRef}
                  type="text"
                  value={commandInput}
                  onChange={(e) => {
                    setCommandInput(e.target.value);
                    if (historyIndex !== -1) setHistoryIndex(-1);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder='Type command or use ↑/↓ history (try "help", "tools")...'
                  aria-label="Interactive terminal command input"
                  className="w-full bg-transparent font-mono text-xs text-white placeholder-[#5B6778] caret-[#00FF66] focus:outline-none"
                />
                {historyIndex !== -1 && (
                  <span className="font-mono text-[10px] text-[#00E5FF] shrink-0 tabular-nums">
                    hist {historyIndex + 1}/{commandHistory.length}
                  </span>
                )}
                <button
                  type="submit"
                  className="px-2.5 py-1 text-[11px] font-mono text-[#00FF66] hover:bg-[#00FF66]/10 active:scale-[0.97] rounded transition-all duration-150 shrink-0 cursor-pointer"
                >
                  Run
                </button>
              </form>
            </div>
          </motion.div>

          {/* Right Column: Workstation Visual + Founder Card */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, delay: 0.04, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5 flex flex-col gap-5"
          >
            <div className="group relative flex-1 min-h-[260px] rounded-lg border border-white/10 hover:border-white/20 overflow-hidden bg-[#0F141C] transition-colors duration-200">
              {!heroImgFailed ? (
                <img
                  src={HERO_WORKSTATION_IMAGE}
                  alt="HUNRUTECH cybersecurity and software engineering workstation"
                  referrerPolicy="no-referrer"
                  onError={() => setHeroImgFailed(true)}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300 ease-out"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#0F141C] to-[#141B26] text-center">
                  <Terminal className="w-10 h-10 text-[#00FF66] mb-3" />
                  <p className="font-mono text-xs text-[#C4CEDB]">HUNRUTECH Engineering Lab</p>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-[#0A0D12]/95 via-[#0A0D12]/70 to-transparent">
                <p className="font-mono text-xs text-[#00FF66]">Kali-Inspired Systems Architecture</p>
                <p className="text-xs text-[#C4CEDB] mt-0.5">
                  Terminal-first engineering, automated recon, and API security tooling.
                </p>
              </div>
            </div>

            {/* Founder Identity Strip */}
            <div className="flex items-center gap-4 p-4 rounded-lg border border-white/10 hover:border-white/20 bg-[#0F141C] transition-colors duration-150">
              <div className="w-14 h-14 rounded-md overflow-hidden border border-white/10 shrink-0 bg-[#141B26]">
                {!portraitFailed ? (
                  <img
                    src={FOUNDER_PORTRAIT_IMAGE}
                    alt="Johnmark (HUNTER ZEN RU), Founder of HUNRUTECH"
                    referrerPolicy="no-referrer"
                    onError={() => setPortraitFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center font-mono text-sm text-[#00FF66]">
                    JM
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  Johnmark · HUNTER ZEN RU
                </p>
                <p className="text-xs text-[#8B98A9] mt-0.5">
                  Founder & Principal Systems Architect · Zero One Community Lead
                </p>
                <p className="font-mono text-[11px] text-[#00E5FF] mt-1 truncate">
                  @hunter-zen-RU · @hunrutech · @HUNRUTECHNOLOGIES
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Full-Width 4-Column Disciplines Strip Below Hero Split */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-12 pt-10 border-t border-white/8">
          {DISCIPLINES.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.num}
                className="p-5 rounded-lg border border-white/8 hover:border-white/20 hover:-translate-y-0.5 bg-[#0F141C] flex flex-col justify-between gap-3 transition-all duration-150"
              >
                <div className="flex items-center justify-between text-xs font-mono text-[#8B98A9]">
                  <span className="text-[#00FF66]">{item.num}</span>
                  <Icon className="w-4 h-4 text-[#00E5FF]" />
                </div>
                <div>
                  <h2 className="font-display text-base font-semibold text-white">
                    {item.title}
                  </h2>
                  <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
