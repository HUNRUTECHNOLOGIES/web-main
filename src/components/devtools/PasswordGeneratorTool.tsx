import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Copy, Eye, EyeOff, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  buildPasswordCharacterSets,
  generateSecurePassword,
  PASSWORD_CHARSETS,
  type GeneratedPasswordResult,
  type PasswordGeneratorOptions,
} from '../../lib/cryptoUtils.ts';
import { notify } from '../../lib/toast.ts';

const QUICK_LENGTHS = [12, 16, 24, 32, 64] as const;

export function PasswordGeneratorTool() {
  const [options, setOptions] = useState<PasswordGeneratorOptions>({
    length: 24,
    uppercase: true,
    lowercase: true,
    digits: true,
    symbols: true,
    customChars: '',
    customOnly: false,
    excludeAmbiguous: false,
    requireEachSet: true,
  });

  const [batchCount, setBatchCount] = useState<1 | 3 | 5>(1);
  const [masked, setMasked] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | 'all' | null>(null);
  const [results, setResults] = useState<GeneratedPasswordResult[]>(() => [
    generateSecurePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      digits: true,
      symbols: true,
      customChars: '',
      customOnly: false,
      excludeAmbiguous: false,
      requireEachSet: true,
    }),
  ]);
  const [error, setError] = useState<string | null>(null);

  const { pool } = useMemo(() => buildPasswordCharacterSets(options), [options]);

  const regenerate = useCallback(
    (nextOpts: PasswordGeneratorOptions = options, count: number = batchCount) => {
      try {
        const list: GeneratedPasswordResult[] = [];
        for (let i = 0; i < count; i++) {
          list.push(generateSecurePassword(nextOpts));
        }
        setResults(list);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to generate password.');
      }
    },
    [options, batchCount]
  );

  useEffect(() => {
    regenerate(options, batchCount);
  }, [options, batchCount, regenerate]);

  const primary = results[0];

  const handleCopy = async (value: string, idx: number | 'all') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedIndex(idx);
      notify.success(idx === 'all' ? 'Copied All Passwords' : 'Password Copied', {
        description:
          idx === 'all'
            ? `${results.length} generated secrets copied to clipboard.`
            : `${value.length}-character secret copied to clipboard.`,
      });
      setTimeout(() => setCopiedIndex(null), 1600);
    } catch {
      notify.error('Clipboard Unavailable', {
        description: 'Copy permission denied by browser context.',
      });
    }
  };

  const updateOption = <K extends keyof PasswordGeneratorOptions>(
    key: K,
    value: PasswordGeneratorOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const strengthColor =
    primary?.strengthLabel === 'Very Strong'
      ? 'text-[#00FF66]'
      : primary?.strengthLabel === 'Strong'
      ? 'text-[#00E5FF]'
      : primary?.strengthLabel === 'Fair'
      ? 'text-amber-400'
      : 'text-red-400';

  const strengthBarWidth = primary
    ? Math.min(100, Math.max(12, Math.round((primary.entropyBits / 128) * 100)))
    : 0;

  return (
    <div className="p-5 sm:p-6 space-y-6">
      {/* Primary Output Panel */}
      <div className="p-4 sm:p-5 rounded-md border border-white/12 bg-[#0A0D12] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-mono text-[#00FF66]">
            <ShieldCheck className="w-4 h-4" />
            <span>CSPRNG · window.crypto.getRandomValues (Unbiased Rejection Sampling)</span>
          </div>
          {primary && (
            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
              <span className={strengthColor}>{primary.strengthLabel}</span>
              <span aria-hidden="true" className="text-[#64748B]">
                ·
              </span>
              <span className="text-[#C4CEDB]">{primary.entropyBits} bits entropy</span>
              <span aria-hidden="true" className="text-[#64748B]">
                ·
              </span>
              <span className="text-[#8B98A9]">Pool: {pool.length} chars</span>
            </div>
          )}
        </div>

        {error ? (
          <div className="p-3.5 rounded border border-red-500/30 bg-red-950/20 text-xs font-mono text-red-300">
            {error}
          </div>
        ) : (
          <div className="space-y-2.5">
            {results.map((item, idx) => (
              <div
                key={`${idx}-${item.password.slice(0, 6)}`}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded border border-white/10 bg-[#0F141C]"
              >
                <p
                  className={`font-mono text-sm sm:text-base tracking-wide break-all select-all ${
                    idx === 0 ? 'text-[#00FF66]' : 'text-[#E6EDF3]'
                  }`}
                >
                  {masked ? '•'.repeat(item.password.length) : item.password}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {idx === 0 && (
                    <button
                      type="button"
                      onClick={() => setMasked((prev) => !prev)}
                      aria-label={masked ? 'Show passwords' : 'Mask passwords'}
                      title={masked ? 'Show passwords' : 'Mask passwords'}
                      className="p-2 text-[#8B98A9] hover:text-white bg-[#0A0D12] border border-white/12 rounded transition-colors cursor-pointer"
                    >
                      {masked ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleCopy(item.password, idx)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] rounded font-semibold transition-all duration-150 whitespace-nowrap cursor-pointer"
                  >
                    {copiedIndex === idx ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Entropy Bar & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div className="flex-1 max-w-md space-y-1">
            <div className="h-1.5 w-full rounded-sm overflow-hidden bg-[#0F141C] border border-white/10">
              <div
                style={{ width: `${strengthBarWidth}%` }}
                className={`h-full transition-all duration-200 ${
                  primary?.strengthLabel === 'Very Strong'
                    ? 'bg-[#00FF66]'
                    : primary?.strengthLabel === 'Strong'
                    ? 'bg-[#00E5FF]'
                    : primary?.strengthLabel === 'Fair'
                    ? 'bg-amber-400'
                    : 'bg-red-400'
                }`}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {batchCount > 1 && results.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  handleCopy(results.map((r) => r.password).join('\n'), 'all')
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-mono text-[#00E5FF] bg-[#0F141C] hover:bg-[#141B26] border border-[#00E5FF]/30 rounded-md transition-colors cursor-pointer"
              >
                {copiedIndex === 'all' ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                <span>{copiedIndex === 'all' ? 'Copied All' : 'Copy All'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => regenerate()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#141B26] hover:bg-[#1C2636] active:scale-[0.98] border border-white/15 rounded-md transition-all duration-150 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#00FF66]" />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Length & Batch Controls */}
        <div className="lg:col-span-5 p-4 sm:p-5 rounded-md border border-white/10 bg-[#0A0D12] space-y-5">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="pw-length-input" className="text-xs font-medium text-[#C4CEDB]">
                Password Length
              </label>
              <input
                id="pw-length-input"
                type="number"
                min={6}
                max={128}
                value={options.length}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (!Number.isNaN(val)) {
                    updateOption('length', Math.max(6, Math.min(128, val)));
                  }
                }}
                className="w-20 px-2.5 py-1 text-right text-xs font-mono tabular-nums bg-[#0F141C] border border-white/15 rounded text-[#00FF66] focus:outline-none focus:border-[#00FF66]"
              />
            </div>

            <input
              type="range"
              aria-label="Password length slider"
              min={6}
              max={128}
              value={options.length}
              onChange={(e) => updateOption('length', Number(e.target.value))}
              className="w-full accent-[#00FF66] cursor-pointer"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_LENGTHS.map((len) => (
                <button
                  key={len}
                  type="button"
                  onClick={() => updateOption('length', len)}
                  className={`px-2.5 py-1 text-[11px] font-mono tabular-nums rounded border transition-colors cursor-pointer ${
                    options.length === len
                      ? 'bg-[#00FF66] text-[#0A0D12] border-[#00FF66] font-semibold'
                      : 'bg-[#0F141C] text-[#94A3B8] border-white/10 hover:text-white'
                  }`}
                >
                  {len} chars
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/8 space-y-2.5">
            <p className="text-xs font-medium text-[#C4CEDB]">Generation Mode &amp; Batch</p>
            <div className="flex items-center gap-1 p-1 bg-[#0F141C] border border-white/10 rounded-md w-fit">
              {([1, 3, 5] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  onClick={() => setBatchCount(count)}
                  className={`px-3 py-1 text-xs font-mono tabular-nums rounded transition-colors cursor-pointer ${
                    batchCount === count
                      ? 'bg-[#00E5FF] text-[#0A0D12] font-semibold'
                      : 'text-[#8B98A9] hover:text-white'
                  }`}
                >
                  {count === 1 ? 'Single (1)' : `Batch (${count})`}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-white/8 space-y-2.5">
            <label className="flex items-center gap-2.5 text-xs text-[#E6EDF3] cursor-pointer">
              <input
                type="checkbox"
                checked={options.excludeAmbiguous}
                onChange={(e) => updateOption('excludeAmbiguous', e.target.checked)}
                className="accent-[#00FF66]"
              />
              <span>Exclude ambiguous glyphs (0, O, 1, l, I, |)</span>
            </label>
            <label className="flex items-center gap-2.5 text-xs text-[#E6EDF3] cursor-pointer">
              <input
                type="checkbox"
                checked={options.requireEachSet}
                onChange={(e) => updateOption('requireEachSet', e.target.checked)}
                className="accent-[#00FF66]"
              />
              <span>Guarantee at least 1 character from each enabled set</span>
            </label>
          </div>
        </div>

        {/* Right: Character Sets & Custom Pool */}
        <div className="lg:col-span-7 p-4 sm:p-5 rounded-md border border-white/10 bg-[#0A0D12] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-[#C4CEDB]">Character Sets</p>
            <label className="inline-flex items-center gap-2 text-xs font-mono text-[#00E5FF] cursor-pointer">
              <input
                type="checkbox"
                checked={options.customOnly}
                onChange={(e) => updateOption('customOnly', e.target.checked)}
                className="accent-[#00E5FF]"
              />
              <span>Custom characters only</span>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(
              [
                { key: 'uppercase', label: 'Uppercase (A-Z)', sample: PASSWORD_CHARSETS.uppercase },
                { key: 'lowercase', label: 'Lowercase (a-z)', sample: PASSWORD_CHARSETS.lowercase },
                { key: 'digits', label: 'Digits (0-9)', sample: PASSWORD_CHARSETS.digits },
                { key: 'symbols', label: 'Symbols', sample: PASSWORD_CHARSETS.symbols },
              ] as const
            ).map((item) => {
              const checked = options[item.key];
              return (
                <label
                  key={item.key}
                  className={`flex flex-col gap-1 p-3 rounded border transition-colors cursor-pointer ${
                    options.customOnly
                      ? 'opacity-45 border-white/8 bg-[#0F141C]/50'
                      : checked
                      ? 'border-[#00FF66]/40 bg-[#0F141C]'
                      : 'border-white/10 bg-[#0F141C]/60 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-white">{item.label}</span>
                    <input
                      type="checkbox"
                      disabled={options.customOnly}
                      checked={checked}
                      onChange={(e) => updateOption(item.key, e.target.checked)}
                      className="accent-[#00FF66]"
                    />
                  </div>
                  <span className="font-mono text-[11px] text-[#8B98A9] truncate">
                    {item.sample}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="custom-charset-input" className="text-xs font-medium text-[#C4CEDB]">
                Custom Character Set {options.customOnly ? '(Exclusive Pool)' : '(Appended)'}
              </label>
              <button
                type="button"
                onClick={() => updateOption('customChars', '0123456789abcdef')}
                className="text-[11px] font-mono text-[#00E5FF] hover:underline cursor-pointer"
              >
                Load Hex (0-9, a-f)
              </button>
            </div>
            <input
              id="custom-charset-input"
              type="text"
              value={options.customChars}
              onChange={(e) => updateOption('customChars', e.target.value)}
              placeholder="Optional custom characters (e.g. _-!@# or 0123456789abcdef)"
              spellCheck={false}
              className="w-full px-3 py-2 text-xs font-mono bg-[#0F141C] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
