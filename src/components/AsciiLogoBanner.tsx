import { useMemo, useState } from 'react';
import { Check, Copy, Terminal } from 'lucide-react';
import { notify } from '../lib/toast.ts';

type AsciiPresetId = 'block' | 'shade' | 'binary' | 'kali' | 'custom';

const GLYPH_MAP: Record<string, string[]> = {
  H: ['1...1', '1...1', '11111', '1...1', '1...1'],
  U: ['1...1', '1...1', '1...1', '1...1', '.111.'],
  N: ['1...1', '11..1', '1.1.1', '1..11', '1...1'],
  R: ['1111.', '1...1', '1111.', '1..1.', '1...1'],
  T: ['11111', '..1..', '..1..', '..1..', '..1..'],
  E: ['11111', '1....', '1111.', '1....', '11111'],
  C: ['.1111', '1....', '1....', '1....', '.1111'],
  A: ['.111.', '1...1', '11111', '1...1', '1...1'],
  B: ['1111.', '1...1', '1111.', '1...1', '1111.'],
  D: ['1111.', '1...1', '1...1', '1...1', '1111.'],
  F: ['11111', '1....', '1111.', '1....', '1....'],
  G: ['.1111', '1....', '1..11', '1...1', '.1111'],
  I: ['11111', '..1..', '..1..', '..1..', '11111'],
  J: ['..111', '...1.', '...1.', '1..1.', '.11..'],
  K: ['1...1', '1..1.', '111..', '1..1.', '1...1'],
  L: ['1....', '1....', '1....', '1....', '11111'],
  M: ['1...1', '11.11', '1.1.1', '1...1', '1...1'],
  O: ['.111.', '1...1', '1...1', '1...1', '.111.'],
  P: ['1111.', '1...1', '1111.', '1....', '1....'],
  Q: ['.111.', '1...1', '1.1.1', '1..1.', '.11.1'],
  S: ['.1111', '1....', '.111.', '....1', '1111.'],
  V: ['1...1', '1...1', '1...1', '.1.1.', '..1..'],
  W: ['1...1', '1...1', '1.1.1', '11.11', '1...1'],
  X: ['1...1', '.1.1.', '..1..', '.1.1.', '1...1'],
  Y: ['1...1', '.1.1.', '..1..', '..1..', '..1..'],
  Z: ['11111', '...1.', '..1..', '.1...', '11111'],
  '0': ['.111.', '1..11', '1.1.1', '11..1', '.111.'],
  '1': ['..1..', '.11..', '..1..', '..1..', '.111.'],
  '-': ['.....', '.....', '11111', '.....', '.....'],
  ' ': ['...', '...', '...', '...', '...'],
};

const PRESETS: Array<{ id: AsciiPresetId; label: string; fg: string; bg: string }> = [
  { id: 'block', label: 'Hash (#)', fg: '#', bg: ' ' },
  { id: 'kali', label: 'Solid (█)', fg: '█', bg: ' ' },
  { id: 'shade', label: 'Shade (▓)', fg: '▓', bg: ' ' },
  { id: 'binary', label: 'Binary (1/0)', fg: '1', bg: '0' },
];

export function generateAsciiArtRows(
  text: string,
  fgChar: string,
  bgChar: string,
  useAlternatingBinary = false
): string[] {
  const normalized = text.toUpperCase();
  const rows = ['', '', '', '', ''];
  const safeFg = fgChar || '#';
  const safeBg = bgChar || ' ';

  for (let charIdx = 0; charIdx < normalized.length; charIdx++) {
    const ch = normalized[charIdx];
    const pattern = GLYPH_MAP[ch] ?? GLYPH_MAP[' '];
    for (let r = 0; r < 5; r++) {
      if (charIdx > 0) {
        rows[r] += safeBg === '0' ? ' ' : safeBg + safeBg;
        if (safeBg === '0') rows[r] += ' ';
      }
      const line = pattern[r];
      for (let c = 0; c < line.length; c++) {
        if (line[c] === '1') {
          if (useAlternatingBinary) {
            rows[r] += (r + c + charIdx) % 2 === 0 ? '1' : '0';
          } else {
            rows[r] += safeFg[c % safeFg.length];
          }
        } else {
          rows[r] += safeBg === '0' ? ' ' : safeBg;
        }
      }
    }
  }
  return rows;
}

export function AsciiLogoBanner() {
  const [preset, setPreset] = useState<AsciiPresetId>('block');
  const [customGlyph, setCustomGlyph] = useState('@');
  const [copied, setCopied] = useState(false);

  const activeSpec = useMemo(() => {
    if (preset === 'custom') {
      const ch = customGlyph.trim().slice(0, 2) || '#';
      return { fg: ch, bg: ' ', binary: false };
    }
    if (preset === 'binary') {
      return { fg: '1', bg: ' ', binary: true };
    }
    const found = PRESETS.find((p) => p.id === preset) ?? PRESETS[0];
    return { fg: found.fg, bg: found.bg, binary: false };
  }, [preset, customGlyph]);

  const rows = useMemo(
    () =>
      generateAsciiArtRows(
        'HUNRUTECH',
        activeSpec.fg,
        activeSpec.bg,
        activeSpec.binary
      ),
    [activeSpec]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(rows.join('\n'));
      setCopied(true);
      notify.success('ASCII Logo Copied', {
        description: 'HUNRUTECH terminal banner copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  return (
    <div className="rounded-lg border border-white/10 bg-[#0F141C] overflow-hidden mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-b border-white/8 bg-[#121822]">
        <div className="flex items-center gap-2 text-xs font-mono text-[#8B98A9]">
          <Terminal className="w-3.5 h-3.5 text-[#00FF66]" />
          <span className="text-white font-semibold">HUNRUTECH ASCII Banner Generator</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {PRESETS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`px-2 py-0.5 text-[11px] font-mono rounded border transition-colors cursor-pointer whitespace-nowrap ${
                preset === item.id
                  ? 'bg-[#00FF66] text-[#0A0D12] border-[#00FF66] font-semibold'
                  : 'bg-[#0A0D12] text-[#C4CEDB] border-white/10 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}

          <div className="inline-flex items-center gap-1 bg-[#0A0D12] border border-white/10 rounded px-2 py-0.5">
            <label htmlFor="ascii-custom-char" className="text-[11px] font-mono text-[#8B98A9]">
              Char:
            </label>
            <input
              id="ascii-custom-char"
              type="text"
              maxLength={2}
              value={customGlyph}
              onFocus={() => setPreset('custom')}
              onChange={(e) => {
                setCustomGlyph(e.target.value);
                setPreset('custom');
              }}
              aria-label="Custom terminal character for HUNRUTECH ASCII logo"
              className="w-7 bg-transparent text-center text-[11px] font-mono text-[#00E5FF] focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy HUNRUTECH ASCII logo"
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono text-[#00FF66] hover:text-white bg-[#0A0D12] border border-[#00FF66]/25 rounded transition-colors cursor-pointer whitespace-nowrap"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      <div className="px-3 sm:px-5 py-3.5 bg-[#0A0D12] overflow-x-auto">
        <pre
          aria-label="HUNRUTECH ASCII Art Logo"
          className="font-mono font-bold text-[clamp(0.34rem,1.45vw,0.78rem)] leading-[1.15] tracking-[0.04em] whitespace-pre select-all w-fit mx-auto"
        >
          {rows.map((row, idx) => (
            <span
              key={idx}
              className={`block ${
                idx < 2
                  ? 'text-[#00FF66]'
                  : idx === 2
                  ? 'text-[#39FF14]'
                  : 'text-[#00E5FF]'
              }`}
            >
              {row}
            </span>
          ))}
        </pre>
      </div>
    </div>
  );
}
