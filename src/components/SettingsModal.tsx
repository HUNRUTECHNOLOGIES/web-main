import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Monitor, Sparkles, Terminal, Volume2, VolumeX, X } from 'lucide-react';
import { notify } from '../lib/toast.ts';

export type AppTheme = 'obsidian' | 'matrix';

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  theme: AppTheme;
  onChangeTheme: (theme: AppTheme) => void;
  matrixRain: boolean;
  onToggleMatrixRain: () => void;
  terminalSound: boolean;
  onToggleTerminalSound: () => void;
}

export function SettingsModal({
  open,
  onClose,
  theme,
  onChangeTheme,
  matrixRain,
  onToggleMatrixRain,
  terminalSound,
  onToggleTerminalSound,
}: SettingsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  const handleSelectTheme = (nextTheme: AppTheme) => {
    if (nextTheme === theme) return;
    onChangeTheme(nextTheme);
    notify.success('Theme Updated', {
      description:
        nextTheme === 'matrix'
          ? 'High-contrast Matrix/Terminal palette active.'
          : 'Default Obsidian dark palette active.',
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Interface Settings"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 8 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-lg border border-white/15 bg-[#0F141C] overflow-hidden shadow-2xl"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#121822]">
              <div>
                <p className="font-mono text-[11px] text-[#00FF66]">HUNRUTECH Preferences</p>
                <h2 className="font-display text-lg font-bold text-white">
                  Display &amp; Terminal Settings
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close settings menu"
                className="p-1.5 text-[#8B98A9] hover:text-white rounded cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Theme Toggle Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-white">Color Theme</h3>
                    <p className="text-xs text-[#8B98A9] mt-0.5">
                      Switch between default Obsidian and high-contrast Matrix/Terminal mode.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectTheme('obsidian')}
                    aria-pressed={theme === 'obsidian'}
                    className={`p-4 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                      theme === 'obsidian'
                        ? 'border-[#00FF66] bg-[#0A0D12]'
                        : 'border-white/12 bg-[#0A0D12] hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                        <Monitor className="w-3.5 h-3.5 text-[#00E5FF]" />
                        <span>Obsidian</span>
                      </span>
                      {theme === 'obsidian' && <Check className="w-3.5 h-3.5 text-[#00FF66]" />}
                    </div>
                    <p className="text-[11px] text-[#8B98A9] mt-1.5">
                      Deep charcoal obsidian surfaces with cyan and terminal-green accents.
                    </p>
                    <div className="flex items-center gap-1.5 mt-3">
                      <span className="w-4 h-4 rounded-sm bg-[#0A0D12] border border-white/25" />
                      <span className="w-4 h-4 rounded-sm bg-[#00FF66]" />
                      <span className="w-4 h-4 rounded-sm bg-[#00E5FF]" />
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSelectTheme('matrix')}
                    aria-pressed={theme === 'matrix'}
                    className={`p-4 rounded-lg border text-left transition-all duration-150 cursor-pointer ${
                      theme === 'matrix'
                        ? 'border-[#00FF66] bg-[#000000]'
                        : 'border-white/12 bg-[#0A0D12] hover:border-[#00FF66]/45'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-2 text-xs font-semibold text-white">
                        <Terminal className="w-3.5 h-3.5 text-[#00FF66]" />
                        <span>Matrix / Terminal</span>
                      </span>
                      {theme === 'matrix' && <Check className="w-3.5 h-3.5 text-[#00FF66]" />}
                    </div>
                    <p className="text-[11px] text-[#8B98A9] mt-1.5">
                      High-contrast neon phosphor green typography on a pure black canvas.
                    </p>
                    <div className="flex items-center gap-1.5 mt-3">
                      <span className="w-4 h-4 rounded-sm bg-[#000000] border border-[#00FF66]/60" />
                      <span className="w-4 h-4 rounded-sm bg-[#39FF14]" />
                      <span className="w-4 h-4 rounded-sm bg-[#00FF66]" />
                    </div>
                  </button>
                </div>
              </div>

              {/* Matrix Rain Canvas Toggle */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Matrix Rain Canvas Background</h3>
                  <p className="text-xs text-[#8B98A9] mt-0.5">
                    Animated falling glyph canvas styled for the Matrix/Terminal theme.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleMatrixRain}
                  aria-pressed={matrixRain}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono rounded-md border transition-colors cursor-pointer shrink-0 ${
                    matrixRain
                      ? 'border-[#00FF66] bg-[#00FF66]/15 text-[#00FF66]'
                      : 'border-white/15 bg-[#0A0D12] text-[#8B98A9] hover:text-white'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{matrixRain ? 'Enabled' : 'Disabled'}</span>
                </button>
              </div>

              {/* Audio Feedback Toggle */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-white">Terminal Keystroke Audio</h3>
                  <p className="text-xs text-[#8B98A9] mt-0.5">
                    Subtle tactile keystroke acoustics in the hero terminal prompt.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onToggleTerminalSound}
                  aria-pressed={terminalSound}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-mono rounded-md border transition-colors cursor-pointer shrink-0 ${
                    terminalSound
                      ? 'border-[#00FF66] bg-[#00FF66]/15 text-[#00FF66]'
                      : 'border-white/15 bg-[#0A0D12] text-[#8B98A9] hover:text-white'
                  }`}
                >
                  {terminalSound ? (
                    <>
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Enabled</span>
                    </>
                  ) : (
                    <>
                      <VolumeX className="w-3.5 h-3.5" />
                      <span>Muted</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
