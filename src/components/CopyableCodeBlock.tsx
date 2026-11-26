import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, Copy, Terminal } from 'lucide-react';
import { notify } from '../lib/toast.ts';

interface CopyableCodeBlockProps {
  command: string;
  label?: string;
  language?: string;
  projectTitle?: string;
  variant?: 'compact' | 'expanded';
  promptSymbol?: string;
  className?: string;
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to execCommand fallback
    }
  }

  if (typeof document !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      const ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      return ok;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }

  return false;
}

function renderCommandLine(line: string, lineIndex: number) {
  const trimmed = line.trim();
  if (!trimmed) return null;

  const parts = trimmed.split(/\s+/);
  const executable = parts[0] ?? '';
  const rest = parts.slice(1);

  return (
    <span key={`${lineIndex}-${trimmed}`} className="inline">
      <span className="text-[#00E5FF] font-medium">{executable}</span>
      {rest.map((token, idx) => {
        const isFlag = token.startsWith('-');
        return (
          <span
            key={`${idx}-${token}`}
            className={isFlag ? 'text-[#C4CEDB]' : 'text-[#E6EDF3]'}
          >
            {' '}
            {token}
          </span>
        );
      })}
    </span>
  );
}

export function CopyableCodeBlock({
  command,
  label = 'Install & Setup',
  language = 'bash',
  projectTitle,
  variant = 'compact',
  promptSymbol = '$',
  className = '',
}: CopyableCodeBlockProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  const handleCopy = async () => {
    const cleanCommand = command.trim();
    if (!cleanCommand) return;

    const ok = await copyTextToClipboard(cleanCommand);
    if (!ok) {
      notify.error('Copy Failed', {
        description: 'Clipboard access was blocked. Select the command to copy manually.',
      });
      return;
    }

    setCopied(true);
    notify.success('Command Copied', {
      description: cleanCommand,
    });

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1800);
  };

  const lines = command
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  const ariaLabel = projectTitle
    ? `Copy setup command for ${projectTitle}`
    : `Copy command: ${command}`;

  if (variant === 'expanded') {
    return (
      <div
        className={`rounded-md border transition-colors duration-150 overflow-hidden bg-[#0A0D12] ${
          copied ? 'border-[#00FF66]/60' : 'border-white/12'
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[#121822] border-b border-white/8">
          <div className="flex items-center gap-2 text-xs font-mono text-[#8B98A9] min-w-0">
            <Terminal className="w-3.5 h-3.5 text-[#00FF66] shrink-0" />
            <span className="text-[#C4CEDB] truncate">{label}</span>
            <span aria-hidden="true">·</span>
            <span>{language}</span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label={ariaLabel}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]/60 ${
              copied
                ? 'bg-[#00FF66] text-[#0A0D12] font-semibold'
                : 'bg-[#141B26] text-[#C4CEDB] hover:text-white hover:bg-[#1C2636] border border-white/10'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.12 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.12 }}
                  className="inline-flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span>Copy</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </div>

        <pre className="px-3.5 py-3 text-xs font-mono leading-relaxed overflow-x-auto select-all">
          <code className="block space-y-1">
            {lines.map((line, idx) => (
              <span key={`${idx}-${line}`} className="block whitespace-pre-wrap break-all">
                <span className="text-[#00FF66]/80 select-none mr-2">{promptSymbol}</span>
                {renderCommandLine(line, idx)}
              </span>
            ))}
          </code>
        </pre>
        <span className="sr-only" aria-live="polite">
          {copied ? 'Command copied to clipboard' : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-between gap-2 pl-3 pr-1.5 py-1.5 rounded-md border transition-colors duration-150 ${
        copied
          ? 'bg-[#00FF66]/[0.06] border-[#00FF66]/60'
          : 'bg-[#0A0D12] border-white/10 hover:border-white/20'
      } ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span
          aria-hidden="true"
          className="font-mono text-[11px] text-[#00FF66]/80 select-none shrink-0"
        >
          {promptSymbol}
        </span>
        <code
          title={command}
          className="text-[11px] font-mono text-[#C4CEDB] truncate select-all"
        >
          {renderCommandLine(lines[0] ?? command, 0)}
        </code>
      </div>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={ariaLabel}
        className={`inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-mono rounded transition-colors duration-150 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00FF66]/60 ${
          copied
            ? 'bg-[#00FF66] text-[#0A0D12] font-semibold'
            : 'bg-[#141B26] text-[#C4CEDB] hover:text-white hover:bg-[#1C2636] border border-white/10'
        }`}
      >
        <AnimatePresence mode="wait" initial={false}>
          {copied ? (
            <motion.span
              key="copied"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.12 }}
              className="inline-flex items-center gap-1"
            >
              <Check className="w-3 h-3" />
              <span>Copied</span>
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={{ opacity: 0, y: 2 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.12 }}
              className="inline-flex items-center gap-1"
            >
              <Copy className="w-3 h-3 text-[#00FF66]" />
              <span>Copy</span>
            </motion.span>
          )}
        </AnimatePresence>
      </button>
      <span className="sr-only" aria-live="polite">
        {copied ? 'Command copied to clipboard' : ''}
      </span>
    </div>
  );
}
