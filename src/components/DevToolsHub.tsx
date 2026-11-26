import { useState, useMemo, type FormEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  Copy,
  KeyRound,
  Mail,
  Play,
  Send,
  ShieldAlert,
  Braces,
  Hash,
  Webhook,
  Terminal,
  History,
  Loader2,
  Lock,
  QrCode,
  Code2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  decodeBase64Utf8,
  decodeJwtToken,
  encodeBase64Utf8,
  hmacDigest,
  md5,
  shaDigest,
  type DecodedJwt,
} from '../lib/cryptoUtils.ts';
import { getDynamicDevToolShortcuts } from '../lib/devToolsConfig.ts';
import { notify } from '../lib/toast.ts';
import { PasswordGeneratorTool } from './devtools/PasswordGeneratorTool.tsx';
import { QrScannerTool } from './devtools/QrScannerTool.tsx';
import { SyntaxVisualizer } from './devtools/SyntaxVisualizer.tsx';
import type { ApiPreset, DevToolId, HttpMethod } from '../types/hunrutech.ts';

interface DevToolsHubProps {
  presets: ApiPreset[];
  enabledTools: DevToolId[];
  maintenanceMode: boolean;
  activeTool: DevToolId;
  onChangeActiveTool: (tool: DevToolId) => void;
}

interface ProxyResponse {
  status: number;
  statusText: string;
  latencyMs: number;
  sizeBytes?: number;
  truncated?: boolean;
  headers: Record<string, string>;
  isJson: boolean;
  body: unknown;
}

interface ApiHistoryEntry {
  id: string;
  method: HttpMethod;
  url: string;
  bearerToken: string;
  headersJson: string;
  bodyJson: string;
  status: number;
  latencyMs: number;
}

interface SmtpResult {
  success: boolean;
  latencyMs: number;
  verified?: boolean;
  messageId?: string | null;
  response?: string;
  error?: string;
  logs: string[];
}

const TOOL_TABS: Array<{ id: DevToolId; label: string; icon: typeof Webhook }> = [
  { id: 'api-tester', label: 'API & Sandbox Tester', icon: Webhook },
  { id: 'smtp-tester', label: 'SMTP & Email Tester', icon: Mail },
  { id: 'jwt-decoder', label: 'JWT Decoder', icon: KeyRound },
  { id: 'hash-base64', label: 'Base64 & Hashes', icon: Hash },
  { id: 'json-formatter', label: 'JSON Formatter', icon: Braces },
  { id: 'password-gen', label: 'Password Generator', icon: Lock },
  { id: 'qr-scanner', label: 'QR Code Scanner', icon: QrCode },
  { id: 'syntax-visualizer', label: 'Syntax Visualizer', icon: Code2 },
];

const SAMPLE_JWT =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJodW5ydXRlY2gtZGV2IiwibmFtZSI6IkpvaG5tYXJrIChIVU5URVIgWkVOIFJVKSIsIm9yZyI6IkhVTlJVVEVDSCIsImlhdCI6MTc2MDAwMDAwMCwiZXhwIjoxODkzNDU2MDAwfQ.signature_placeholder';

export function DevToolsHub({
  presets,
  enabledTools,
  maintenanceMode,
  activeTool,
  onChangeActiveTool,
}: DevToolsHubProps) {
  // API Tester State
  const [selectedPresetId, setSelectedPresetId] = useState<string>('');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('https://httpbin.org/get');
  const [bearerToken, setBearerToken] = useState('');
  const [headersJson, setHeadersJson] = useState('{\n  "Accept": "application/json"\n}');
  const [bodyJson, setBodyJson] = useState('');
  const [paystackSecret, setPaystackSecret] = useState('sk_test_hunrutech_demo');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiResponse, setApiResponse] = useState<ProxyResponse | null>(null);
  const [copiedResponse, setCopiedResponse] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [apiHistory, setApiHistory] = useState<ApiHistoryEntry[]>([]);
  const [showInlineVisualizer, setShowInlineVisualizer] = useState(true);

  // SMTP Tester State
  const [smtpHost, setSmtpHost] = useState('smtp.ethereal.email');
  const [smtpPort, setSmtpPort] = useState<number>(587);
  const [smtpSecurity, setSmtpSecurity] = useState<'starttls' | 'ssl' | 'none'>('starttls');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFrom, setSmtpFrom] = useState('');
  const [smtpTo, setSmtpTo] = useState('');
  const [smtpSubject, setSmtpSubject] = useState('HUNRUTECH SMTP Verification Test');
  const [smtpBody, setSmtpBody] = useState('Delivered via HUNRUTECH DevTools SMTP Tester.');
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpResult, setSmtpResult] = useState<SmtpResult | null>(null);

  // JWT Decoder State
  const [jwtInput, setJwtInput] = useState(SAMPLE_JWT);

  // Hash & Base64 State
  const [hashInput, setHashInput] = useState('Made with Curiosity at HUNRUTECH');
  const [hmacSecret, setHmacSecret] = useState('hunrutech-secret-key');
  const [hashes, setHashes] = useState<{
    sha256: string;
    sha384: string;
    sha512: string;
    hmac256: string;
    hmac512: string;
  } | null>(null);
  const [b64Output, setB64Output] = useState('');
  const [b64Error, setB64Error] = useState<string | null>(null);

  // JSON Formatter State
  const [jsonRaw, setJsonRaw] = useState(
    '{"organization":"HUNRUTECH","founder":"Johnmark","community":"Zero One","tools":["Konsole-OS","Daraja Sandbox","SMTP Tester"]}'
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const visibleTabs = TOOL_TABS.filter((t) => enabledTools.includes(t.id));
  const currentTab = visibleTabs.some((t) => t.id === activeTool)
    ? activeTool
    : visibleTabs[0]?.id || 'api-tester';

  const shortcutByTool = useMemo(() => {
    const map = new Map<DevToolId, string>();
    for (const s of getDynamicDevToolShortcuts(enabledTools)) {
      map.set(s.id, s.shortcutLabel);
    }
    return map;
  }, [enabledTools]);

  const activePreset = useMemo(
    () => presets.find((p) => p.id === selectedPresetId) ?? null,
    [presets, selectedPresetId]
  );

  const requestSyntaxContext = useMemo(
    () => ({
      preset: activePreset,
      method,
      url,
      headersJson,
      bodyJson,
    }),
    [activePreset, method, url, headersJson, bodyJson]
  );

  const groupedPresets = useMemo(() => {
    const groups: Record<string, ApiPreset[]> = {
      Daraja: [],
      Paystack: [],
      Supabase: [],
      Custom: [],
    };
    for (const p of presets) {
      if (!groups[p.category]) groups[p.category] = [];
      groups[p.category].push(p);
    }
    return groups;
  }, [presets]);

  const applyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const found = presets.find((p) => p.id === presetId);
    if (!found) return;
    setMethod(found.method);
    setUrl(found.url);
    setHeadersJson(found.headersJson || '{}');
    setBodyJson(found.bodyJson || '');
    setApiError(null);
    setApiResponse(null);
  };

  const handleSignPaystackWebhook = async () => {
    try {
      const res = await fetch('/api/paystack/webhook-sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretKey: paystackSecret, payload: bodyJson }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || 'Could not sign Paystack webhook payload.');
        return;
      }
      let parsedHeaders: Record<string, string> = {};
      try {
        parsedHeaders = headersJson.trim() ? JSON.parse(headersJson) : {};
      } catch {
        parsedHeaders = {};
      }
      parsedHeaders['x-paystack-signature'] = data.signature;
      setHeadersJson(JSON.stringify(parsedHeaders, null, 2));
      setApiError(null);
      notify.success('Paystack Signature Computed', {
        description: 'Injected x-paystack-signature into request headers.',
      });
    } catch {
      setApiError('Failed to generate webhook signature.');
      notify.error('Webhook Signing Failed');
    }
  };

  const handleSendApiRequest = async (e: FormEvent) => {
    e.preventDefault();
    setApiError(null);
    setApiResponse(null);

    let parsedHeaders: Record<string, string> = {};
    if (headersJson.trim()) {
      try {
        parsedHeaders = JSON.parse(headersJson);
      } catch {
        setApiError('Custom Headers must be valid JSON.');
        return;
      }
    }
    if (bearerToken.trim()) {
      parsedHeaders.Authorization = `Bearer ${bearerToken.trim()}`;
    }

    if (!['GET', 'HEAD'].includes(method) && bodyJson.trim()) {
      try {
        JSON.parse(bodyJson);
      } catch {
        // Still allow plain string or warn if JSON invalid
      }
    }

    setApiLoading(true);
    try {
      const res = await fetch('/api/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: url.trim(),
          method,
          headers: parsedHeaders,
          body: !['GET', 'HEAD'].includes(method) ? bodyJson : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data.error || `Request failed (${res.status})`);
      } else {
        setApiResponse(data);
        setApiHistory((prev) => [
          {
            id: `${Date.now()}-${Math.random()}`,
            method,
            url: url.trim(),
            bearerToken,
            headersJson,
            bodyJson,
            status: data.status,
            latencyMs: data.latencyMs,
          },
          ...prev.slice(0, 4),
        ]);
      }
    } catch {
      setApiError('Network error communicating with proxy backend.');
    } finally {
      setApiLoading(false);
    }
  };

  const handleCopyCurl = async () => {
    let parsedHeaders: Record<string, string> = {};
    try {
      if (headersJson.trim()) parsedHeaders = JSON.parse(headersJson);
    } catch {
      parsedHeaders = {};
    }
    if (bearerToken.trim()) {
      parsedHeaders.Authorization = `Bearer ${bearerToken.trim()}`;
    }
    const escapeSingle = (val: string) => val.replace(/'/g, "'\\''");
    const lines = [`curl -X ${method} '${escapeSingle(url.trim())}'`];
    for (const [k, v] of Object.entries(parsedHeaders)) {
      lines.push(`  -H '${escapeSingle(`${k}: ${v}`)}'`);
    }
    if (!['GET', 'HEAD'].includes(method) && bodyJson.trim()) {
      lines.push(`  -d '${escapeSingle(bodyJson.trim())}'`);
    }
    try {
      await navigator.clipboard.writeText(lines.join(' \\\n'));
      setCopiedCurl(true);
      notify.success('Copied cURL Command', { description: `${method} ${url.trim()}` });
      setTimeout(() => setCopiedCurl(false), 1600);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  const restoreHistoryEntry = (entry: ApiHistoryEntry) => {
    setMethod(entry.method);
    setUrl(entry.url);
    setBearerToken(entry.bearerToken);
    setHeadersJson(entry.headersJson);
    setBodyJson(entry.bodyJson);
    setApiError(null);
  };

  const handleRunSmtp = async (sendEmail: boolean) => {
    setSmtpLoading(true);
    setSmtpResult(null);
    try {
      const res = await fetch('/api/smtp-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: smtpHost.trim(),
          port: Number(smtpPort),
          security: smtpSecurity,
          user: smtpUser,
          pass: smtpPass,
          from: smtpFrom,
          to: smtpTo,
          subject: smtpSubject,
          body: smtpBody,
          sendEmail,
        }),
      });
      const data = (await res.json()) as SmtpResult;
      setSmtpResult(data);
    } catch {
      setSmtpResult({
        success: false,
        latencyMs: 0,
        error: 'Unable to reach SMTP test endpoint.',
        logs: ['[ERROR] Backend connection failed.'],
      });
    } finally {
      setSmtpLoading(false);
    }
  };

  const decodedJwtResult = useMemo<{ data: DecodedJwt | null; error: string | null }>(() => {
    if (!jwtInput.trim()) return { data: null, error: null };
    try {
      return { data: decodeJwtToken(jwtInput), error: null };
    } catch (err) {
      return {
        data: null,
        error: err instanceof Error ? err.message : 'Invalid JWT string.',
      };
    }
  }, [jwtInput]);

  const computeAllHashes = async (text: string, secret: string) => {
    const [sha256, sha384, sha512, hmac256, hmac512] = await Promise.all([
      shaDigest('SHA-256', text),
      shaDigest('SHA-384', text),
      shaDigest('SHA-512', text),
      hmacDigest('SHA-256', secret || 'secret', text),
      hmacDigest('SHA-512', secret || 'secret', text),
    ]);
    setHashes({ sha256, sha384, sha512, hmac256, hmac512 });
  };

  const handleFormatJson = (indent: number) => {
    try {
      const parsed = JSON.parse(jsonRaw);
      setJsonRaw(JSON.stringify(parsed, null, indent));
      setJsonError(null);
      notify.success(indent === 0 ? 'JSON Minified' : `JSON Formatted (${indent} spaces)`);
    } catch (err) {
      setJsonError(err instanceof Error ? err.message : 'Invalid JSON syntax.');
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedResponse(true);
      notify.success('Copied to Clipboard');
      setTimeout(() => setCopiedResponse(false), 1600);
    } catch {
      // Ignore clipboard unavailability
    }
  };

  return (
    <section id="devtools" className="border-b border-white/8 bg-[#0A0D12]">
      <div className="max-w-7xl mx-auto px-6 py-16 lg:py-20 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col lg:flex-row lg:items-end justify-between gap-6"
        >
          <div className="space-y-2 max-w-2xl">
            <p className="font-mono text-xs text-[#00FF66]">02. Interactive Developer Workbench</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-white">
              DevTools Hub
            </h2>
            <p className="text-sm sm:text-base text-[#94A3B8]">
              Test REST APIs with Daraja, Paystack, and Supabase templates, verify live SMTP mail
              servers via Nodemailer, decode JWTs, inspect hashes, generate CSPRNG secrets, and scan
              QR endpoints.
            </p>
          </div>
        </motion.div>

        {maintenanceMode ? (
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="p-8 rounded-lg border border-amber-500/30 bg-amber-950/20 flex items-start gap-4"
          >
            <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="font-display text-lg font-semibold text-white">
                Workbench Temporarily in Maintenance Mode
              </h3>
              <p className="text-sm text-[#C4CEDB]">
                An administrator has paused outbound DevTools execution. Public catalog and
                collaboration submissions remain active.
              </p>
            </div>
          </motion.div>
        ) : visibleTabs.length === 0 ? (
          <div className="p-8 rounded-lg border border-white/10 bg-[#0F141C] text-sm text-[#94A3B8]">
            No workbench utilities are currently enabled. Contact an administrator to enable tools.
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.08 }}
            transition={{ duration: 0.26, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-lg border border-white/10 bg-[#0F141C] overflow-hidden"
          >
            {/* Workbench Tool Switcher Tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-white/8 bg-[#121822] overflow-x-auto">
              {visibleTabs.map((tab) => {
                const Icon = tab.icon;
                const active = currentTab === tab.id;
                const shortcut = shortcutByTool.get(tab.id);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onChangeActiveTool(tab.id)}
                    title={shortcut ? `Switch to ${tab.label} (${shortcut})` : tab.label}
                    className={`relative inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? 'text-[#0A0D12] font-semibold'
                        : 'text-[#94A3B8] hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="devtool-tab-active"
                        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                        className="absolute inset-0 rounded bg-[#00FF66]"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                    {shortcut && (
                      <kbd
                        className={`relative z-10 hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono tabular-nums rounded border ${
                          active
                            ? 'border-[#0A0D12]/25 bg-[#0A0D12]/10 text-[#0A0D12]'
                            : 'border-white/10 bg-[#0A0D12]/70 text-[#64748B]'
                        }`}
                      >
                        {shortcut}
                      </kbd>
                    )}
                  </button>
                );
              })}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={currentTab}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
              >
            {/* TAB 1: Multi-Protocol API Tester */}
            {currentTab === 'api-tester' && (
              <div className="p-5 sm:p-6 space-y-6">
                {/* Sandbox Presets Bar */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end pb-5 border-b border-white/8">
                  <div className="lg:col-span-5 space-y-1.5">
                    <label
                      htmlFor="preset-select"
                      className="block text-xs font-medium text-[#C4CEDB]"
                    >
                      Sandbox &amp; API Template Presets
                    </label>
                    <select
                      id="preset-select"
                      value={selectedPresetId}
                      onChange={(e) => applyPreset(e.target.value)}
                      className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                    >
                      <option value="">Select a template (Daraja, Paystack, Supabase)...</option>
                      {Object.entries(groupedPresets).map(([groupName, groupItems]) =>
                        groupItems.length > 0 ? (
                          <optgroup key={groupName} label={`${groupName} Templates`}>
                            {groupItems.map((p) => (
                              <option key={p.id} value={p.id}>
                                [{p.method}] {p.name}
                              </option>
                            ))}
                          </optgroup>
                        ) : null
                      )}
                    </select>
                  </div>

                  <div className="lg:col-span-4 space-y-1.5">
                    <label
                      htmlFor="bearer-input"
                      className="block text-xs font-medium text-[#C4CEDB]"
                    >
                      Auth Bearer Token (optional)
                    </label>
                    <input
                      id="bearer-input"
                      type="text"
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                      placeholder="Paste OAuth / JWT / API Bearer token"
                      className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
                    />
                  </div>

                  <div className="lg:col-span-3 flex flex-wrap gap-1.5">
                    {presets.slice(0, 3).map((quick) => (
                      <button
                        key={quick.id}
                        type="button"
                        onClick={() => applyPreset(quick.id)}
                        className="px-2.5 py-1.5 text-[11px] font-mono text-[#00E5FF] bg-[#0A0D12] hover:bg-[#141B26] border border-[#00E5FF]/25 rounded transition-colors truncate max-w-full cursor-pointer"
                      >
                        {quick.name.split(':')[0]} · {quick.method}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Request URL Bar */}
                <form onSubmit={handleSendApiRequest} className="space-y-4">
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <select
                      aria-label="HTTP Method"
                      value={method}
                      onChange={(e) => setMethod(e.target.value as HttpMethod)}
                      className="sm:w-32 px-3 py-2.5 text-xs font-mono font-semibold bg-[#0A0D12] border border-white/15 rounded-md text-[#00FF66] focus:outline-none focus:border-[#00FF66]"
                    >
                      {(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as HttpMethod[]).map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                    <input
                      type="url"
                      required
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder="https://api.example.com/v1/resource"
                      aria-label="Target API URL"
                      className="flex-1 px-3.5 py-2.5 text-xs font-mono bg-[#0A0D12] border border-white/15 rounded-md text-white placeholder-[#5B6778] focus:outline-none focus:border-[#00FF66]"
                    />
                    <button
                      type="button"
                      onClick={handleCopyCurl}
                      title="Copy request as cURL command"
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2.5 text-xs font-mono text-[#C4CEDB] hover:text-[#00E5FF] bg-[#0A0D12] hover:bg-[#141B26] border border-white/15 active:scale-[0.98] rounded-md transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {copiedCurl ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-[#00FF66]" />
                          <span className="text-[#00FF66]">Copied cURL</span>
                        </>
                      ) : (
                        <>
                          <Terminal className="w-3.5 h-3.5" />
                          <span>Copy cURL</span>
                        </>
                      )}
                    </button>
                    <button
                      type="submit"
                      disabled={apiLoading}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] disabled:opacity-60 rounded-md transition-all duration-150 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {apiLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Play className="w-3.5 h-3.5" />
                      )}
                      <span>{apiLoading ? 'Executing...' : 'Send Request'}</span>
                    </button>
                  </div>

                  {/* Paystack Webhook HMAC Signer helper when Paystack webhook preset active */}
                  {(selectedPresetId.includes('paystack') || url.includes('paystack')) && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded bg-[#0A0D12] border border-[#00E5FF]/25">
                      <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2">
                        <span className="font-mono text-xs text-[#00E5FF] whitespace-nowrap">
                          Paystack Webhook Signer:
                        </span>
                        <input
                          type="text"
                          value={paystackSecret}
                          onChange={(e) => setPaystackSecret(e.target.value)}
                          placeholder="Paystack Test Secret Key"
                          className="flex-1 px-2.5 py-1 text-xs font-mono bg-[#0F141C] border border-white/10 rounded text-white focus:outline-none"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSignPaystackWebhook}
                        className="px-3 py-1.5 text-xs font-mono text-[#0A0D12] bg-[#00E5FF] hover:bg-[#33ECFF] rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        Compute x-paystack-signature
                      </button>
                    </div>
                  )}

                  {/* Headers & Body Split */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono text-[#8B98A9]">
                        Request Headers (JSON)
                      </label>
                      <textarea
                        rows={7}
                        value={headersJson}
                        onChange={(e) => setHeadersJson(e.target.value)}
                        spellCheck={false}
                        className="w-full p-3 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-[#E6EDF3] focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono text-[#8B98A9]">
                        Request Body (JSON)
                      </label>
                      <textarea
                        rows={7}
                        value={bodyJson}
                        onChange={(e) => setBodyJson(e.target.value)}
                        disabled={method === 'GET'}
                        placeholder={
                          method === 'GET'
                            ? 'GET requests do not send a request body.'
                            : '{\n  "key": "value"\n}'
                        }
                        spellCheck={false}
                        className="w-full p-3 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-[#E6EDF3] disabled:opacity-45 focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                  </div>
                </form>

                {/* Session Request History Strip */}
                {apiHistory.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#8B98A9] mr-1">
                      <History className="w-3.5 h-3.5 text-[#00E5FF]" />
                      <span>Recent:</span>
                    </span>
                    {apiHistory.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => restoreHistoryEntry(item)}
                        className="inline-flex items-center gap-2 px-2.5 py-1 text-[11px] font-mono bg-[#0A0D12] hover:bg-[#141B26] border border-white/10 hover:border-white/25 rounded transition-colors max-w-[260px] truncate cursor-pointer"
                      >
                        <span
                          className={
                            item.status >= 200 && item.status < 300
                              ? 'text-[#00FF66]'
                              : item.status >= 400
                              ? 'text-red-400'
                              : 'text-[#00E5FF]'
                          }
                        >
                          {item.method} {item.status}
                        </span>
                        <span className="text-[#94A3B8] truncate">{item.url.replace(/^https?:\/\//, '')}</span>
                        <span className="text-[#64748B] shrink-0">{item.latencyMs}ms</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Proxy Response Viewer */}
                <AnimatePresence mode="wait">
                  {apiError && (
                    <motion.div
                      key="api-error"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="p-4 rounded border border-red-500/30 bg-red-950/20 text-xs font-mono text-red-300"
                    >
                      Error: {apiError}
                    </motion.div>
                  )}

                  {apiResponse && (
                    <motion.div
                      key={`api-res-${apiResponse.status}-${apiResponse.latencyMs}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="rounded-md border border-white/10 bg-[#0A0D12] overflow-hidden"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-white/8 bg-[#121822]">
                        <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
                          <span
                            className={
                              apiResponse.status >= 200 && apiResponse.status < 300
                                ? 'text-[#00FF66] font-semibold'
                                : apiResponse.status >= 400
                                ? 'text-red-400 font-semibold'
                                : 'text-[#00E5FF] font-semibold'
                            }
                          >
                            HTTP {apiResponse.status} {apiResponse.statusText}
                          </span>
                          <span className="text-[#8B98A9]">Latency: {apiResponse.latencyMs} ms</span>
                          {typeof apiResponse.sizeBytes === 'number' && (
                            <span className="text-[#8B98A9]">
                              Size: {(apiResponse.sizeBytes / 1024).toFixed(2)} KB
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            copyText(
                              apiResponse.isJson
                                ? JSON.stringify(apiResponse.body, null, 2)
                                : String(apiResponse.body)
                            )
                          }
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00FF66] hover:text-white cursor-pointer"
                        >
                          {copiedResponse ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Body</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 text-xs font-mono text-[#E6EDF3] max-h-80 overflow-auto whitespace-pre-wrap break-words">
                        {apiResponse.isJson
                          ? JSON.stringify(apiResponse.body, null, 2)
                          : String(apiResponse.body)}
                      </pre>
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Inline Preset Interactive Syntax Visualizer (YAML · JSON · Bash) */}
                <div className="pt-2 border-t border-white/8 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setShowInlineVisualizer((prev) => !prev)}
                      className="inline-flex items-center gap-2 text-xs font-mono text-[#C4CEDB] hover:text-white cursor-pointer"
                    >
                      <Code2 className="w-3.5 h-3.5 text-[#00FF66]" />
                      <span>
                        Preset Syntax Visualizer{' '}
                        <span className="text-[#8B98A9]">(YAML · JSON · Bash)</span>
                      </span>
                      {showInlineVisualizer ? (
                        <ChevronUp className="w-3.5 h-3.5 text-[#8B98A9]" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-[#8B98A9]" />
                      )}
                    </button>
                    <span className="text-[11px] font-mono text-[#64748B]">
                      {activePreset ? `Active: ${activePreset.name}` : 'Live Request Sync'}
                    </span>
                  </div>

                  {showInlineVisualizer && (
                    <SyntaxVisualizer
                      compact
                      requestContext={requestSyntaxContext}
                      onOpenFullTab={
                        enabledTools.includes('syntax-visualizer')
                          ? () => onChangeActiveTool('syntax-visualizer')
                          : undefined
                      }
                    />
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: SMTP & Email Tester */}
            {currentTab === 'smtp-tester' && (
              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">SMTP Host</label>
                      <input
                        type="text"
                        value={smtpHost}
                        onChange={(e) => setSmtpHost(e.target.value)}
                        placeholder="smtp.gmail.com"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">Port</label>
                      <select
                        value={smtpPort}
                        onChange={(e) => setSmtpPort(Number(e.target.value))}
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      >
                        <option value={587}>587 (STARTTLS)</option>
                        <option value={465}>465 (SSL/TLS)</option>
                        <option value={2525}>2525 (Alt TLS)</option>
                        <option value={25}>25 (Plain)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">Security</label>
                      <select
                        value={smtpSecurity}
                        onChange={(e) =>
                          setSmtpSecurity(e.target.value as 'starttls' | 'ssl' | 'none')
                        }
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      >
                        <option value="starttls">STARTTLS</option>
                        <option value="ssl">SSL / TLS</option>
                        <option value="none">None</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">Username</label>
                      <input
                        type="text"
                        value={smtpUser}
                        onChange={(e) => setSmtpUser(e.target.value)}
                        placeholder="user@domain.com"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">Password</label>
                      <input
                        type="password"
                        value={smtpPass}
                        onChange={(e) => setSmtpPass(e.target.value)}
                        placeholder="App password (not stored)"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/8">
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">
                        From Email
                      </label>
                      <input
                        type="email"
                        value={smtpFrom}
                        onChange={(e) => setSmtpFrom(e.target.value)}
                        placeholder="noreply@yourdomain.com"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-medium text-[#C4CEDB]">To Email</label>
                      <input
                        type="email"
                        value={smtpTo}
                        onChange={(e) => setSmtpTo(e.target.value)}
                        placeholder="recipient@example.com"
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#C4CEDB]">Subject</label>
                    <input
                      type="text"
                      value={smtpSubject}
                      onChange={(e) => setSmtpSubject(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-medium text-[#C4CEDB]">Message Body</label>
                    <textarea
                      rows={3}
                      value={smtpBody}
                      onChange={(e) => setSmtpBody(e.target.value)}
                      className="w-full p-3 text-xs bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                    />
                  </div>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      type="button"
                      disabled={smtpLoading}
                      onClick={() => handleRunSmtp(false)}
                      className="px-4 py-2 text-xs font-medium text-white bg-[#141B26] hover:bg-[#1C2636] active:scale-[0.98] border border-white/15 rounded-md transition-all duration-150 disabled:opacity-60 cursor-pointer"
                    >
                      {smtpLoading ? 'Testing...' : 'Verify Handshake Only'}
                    </button>
                    <button
                      type="button"
                      disabled={smtpLoading}
                      onClick={() => handleRunSmtp(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] active:scale-[0.98] rounded-md transition-all duration-150 disabled:opacity-60 cursor-pointer"
                    >
                      {smtpLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      <span>{smtpLoading ? 'Sending...' : 'Send Test Email'}</span>
                    </button>
                  </div>
                </div>

                {/* Real-time Connection Logs */}
                <div className="lg:col-span-5 flex flex-col rounded-md border border-white/10 bg-[#0A0D12] overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-[#121822]">
                    <span className="font-mono text-xs text-[#C4CEDB]">
                      SMTP Session Transcript
                    </span>
                    {smtpResult && (
                      <span
                        className={`font-mono text-xs tabular-nums ${
                          smtpResult.success ? 'text-[#00FF66]' : 'text-red-400'
                        }`}
                      >
                        {smtpResult.success ? '250 OK' : 'FAILED'} · {smtpResult.latencyMs} ms
                      </span>
                    )}
                  </div>
                  <div className="flex-1 p-4 font-mono text-xs space-y-1.5 overflow-y-auto min-h-[280px] max-h-[420px]">
                    <AnimatePresence mode="wait">
                      {!smtpResult ? (
                        <motion.p
                          key="smtp-empty"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.14 }}
                          className="text-[#64748B]"
                        >
                          Enter your SMTP server credentials and click Verify Handshake Only or Send
                          Test Email to inspect live Nodemailer diagnostics. Credentials are never
                          stored.
                        </motion.p>
                      ) : (
                        <motion.div
                          key={`smtp-res-${smtpResult.latencyMs}-${smtpResult.success}`}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                          className="space-y-1.5"
                        >
                          {smtpResult.error && (
                            <div className="p-2.5 mb-2 rounded border border-red-500/30 bg-red-950/25 text-red-300">
                              {smtpResult.error}
                            </div>
                          )}
                          {smtpResult.response && smtpResult.success && (
                            <div className="p-2.5 mb-2 rounded border border-[#00FF66]/30 bg-[#00FF66]/10 text-[#00FF66]">
                              {smtpResult.response}
                              {smtpResult.messageId ? ` (${smtpResult.messageId})` : ''}
                            </div>
                          )}
                          {smtpResult.logs.map((line, i) => (
                            <div key={i} className="text-[#94A3B8] break-all">
                              {line}
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: JWT Decoder */}
            {currentTab === 'jwt-decoder' && (
              <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-mono text-[#C4CEDB]">Encoded JWT Token</label>
                    <button
                      type="button"
                      onClick={() => setJwtInput(SAMPLE_JWT)}
                      className="text-xs font-mono text-[#00E5FF] hover:underline cursor-pointer"
                    >
                      Load Sample Token
                    </button>
                  </div>
                  <textarea
                    rows={12}
                    value={jwtInput}
                    onChange={(e) => setJwtInput(e.target.value)}
                    placeholder="Paste eyJ... JWT token here"
                    spellCheck={false}
                    className="w-full p-3.5 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-[#00E5FF] focus:outline-none focus:border-[#00FF66] break-all"
                  />
                  {decodedJwtResult.error && (
                    <p className="text-xs font-mono text-red-400">{decodedJwtResult.error}</p>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="p-4 rounded-md border border-white/10 bg-[#0A0D12] space-y-2">
                    <p className="text-xs font-mono text-[#00FF66]">Decoded Header</p>
                    <pre className="text-xs font-mono text-[#E6EDF3] overflow-auto">
                      {decodedJwtResult.data
                        ? JSON.stringify(decodedJwtResult.data.header, null, 2)
                        : '{}'}
                    </pre>
                  </div>

                  <div className="p-4 rounded-md border border-white/10 bg-[#0A0D12] space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-mono text-[#00E5FF]">Decoded Payload</p>
                      {decodedJwtResult.data && decodedJwtResult.data.isExpired !== null && (
                        <span
                          className={`text-xs font-mono ${
                            decodedJwtResult.data.isExpired ? 'text-red-400' : 'text-[#00FF66]'
                          }`}
                        >
                          {decodedJwtResult.data.isExpired ? 'EXPIRED' : 'ACTIVE WINDOW'}
                        </span>
                      )}
                    </div>
                    <pre className="text-xs font-mono text-[#E6EDF3] overflow-auto">
                      {decodedJwtResult.data
                        ? JSON.stringify(decodedJwtResult.data.payload, null, 2)
                        : '{}'}
                    </pre>
                    {decodedJwtResult.data?.expiresAtIso && (
                      <p className="text-[11px] font-mono text-[#8B98A9] pt-1">
                        Expires (exp): {decodedJwtResult.data.expiresAtIso}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: Base64 & Hash Generator */}
            {currentTab === 'hash-base64' && (
              <div className="p-5 sm:p-6 space-y-5">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-mono text-[#C4CEDB]">
                      Input Plaintext or Base64 String
                    </label>
                    <textarea
                      rows={5}
                      value={hashInput}
                      onChange={(e) => setHashInput(e.target.value)}
                      className="w-full p-3 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                    />
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-xs font-mono text-[#C4CEDB]">
                        HMAC Secret Key
                      </label>
                      <input
                        type="text"
                        value={hmacSecret}
                        onChange={(e) => setHmacSecret(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-white focus:outline-none focus:border-[#00FF66]"
                      />
                    </div>
                    <div className="flex flex-wrap gap-2.5 pt-1">
                      <button
                        type="button"
                        onClick={() => computeAllHashes(hashInput, hmacSecret)}
                        className="px-4 py-2 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] hover:bg-[#2BFF80] rounded-md cursor-pointer"
                      >
                        Generate Digests
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setB64Error(null);
                          setB64Output(encodeBase64Utf8(hashInput));
                        }}
                        className="px-3.5 py-2 text-xs font-mono text-white bg-[#141B26] border border-white/15 rounded-md cursor-pointer"
                      >
                        Encode Base64
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          try {
                            setB64Error(null);
                            setB64Output(decodeBase64Utf8(hashInput.trim()));
                          } catch {
                            setB64Error('Invalid Base64 input string.');
                          }
                        }}
                        className="px-3.5 py-2 text-xs font-mono text-white bg-[#141B26] border border-white/15 rounded-md cursor-pointer"
                      >
                        Decode Base64
                      </button>
                    </div>
                    {b64Error && <p className="text-xs font-mono text-red-400">{b64Error}</p>}
                    {b64Output && (
                      <div className="p-3 rounded bg-[#0A0D12] border border-white/10 font-mono text-xs text-[#00E5FF] break-all">
                        {b64Output}
                      </div>
                    )}
                  </div>
                </div>

                {/* Live MD5 + SHA Outputs */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-white/8">
                  <div className="p-3 rounded bg-[#0A0D12] border border-white/10 space-y-1">
                    <span className="text-[11px] font-mono text-[#8B98A9]">MD5 (Live)</span>
                    <p className="text-xs font-mono text-[#E6EDF3] break-all">{md5(hashInput)}</p>
                  </div>
                  {hashes && (
                    <>
                      <div className="p-3 rounded bg-[#0A0D12] border border-white/10 space-y-1">
                        <span className="text-[11px] font-mono text-[#8B98A9]">SHA-256</span>
                        <p className="text-xs font-mono text-[#00FF66] break-all">
                          {hashes.sha256}
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[#0A0D12] border border-white/10 space-y-1">
                        <span className="text-[11px] font-mono text-[#8B98A9]">SHA-512</span>
                        <p className="text-xs font-mono text-[#E6EDF3] break-all">
                          {hashes.sha512}
                        </p>
                      </div>
                      <div className="p-3 rounded bg-[#0A0D12] border border-white/10 space-y-1">
                        <span className="text-[11px] font-mono text-[#8B98A9]">HMAC-SHA512</span>
                        <p className="text-xs font-mono text-[#00E5FF] break-all">
                          {hashes.hmac512}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: JSON Formatter */}
            {currentTab === 'json-formatter' && (
              <div className="p-5 sm:p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleFormatJson(2)}
                      className="px-3.5 py-1.5 text-xs font-semibold text-[#0A0D12] bg-[#00FF66] rounded-md cursor-pointer"
                    >
                      Format (2 spaces)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormatJson(4)}
                      className="px-3.5 py-1.5 text-xs font-mono text-white bg-[#141B26] border border-white/15 rounded-md cursor-pointer"
                    >
                      Format (4 spaces)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleFormatJson(0)}
                      className="px-3.5 py-1.5 text-xs font-mono text-white bg-[#141B26] border border-white/15 rounded-md cursor-pointer"
                    >
                      Minify
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(jsonRaw)}
                    className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00FF66] hover:text-white cursor-pointer"
                  >
                    {copiedResponse ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedResponse ? 'Copied' : 'Copy JSON'}</span>
                  </button>
                </div>

                {jsonError && (
                  <div className="p-3 rounded border border-red-500/30 bg-red-950/20 text-xs font-mono text-red-300">
                    Syntax Error: {jsonError}
                  </div>
                )}

                <textarea
                  rows={12}
                  value={jsonRaw}
                  onChange={(e) => setJsonRaw(e.target.value)}
                  spellCheck={false}
                  className="w-full p-4 text-xs font-mono bg-[#0A0D12] border border-white/12 rounded-md text-[#E6EDF3] focus:outline-none focus:border-[#00FF66]"
                />
              </div>
            )}

            {/* TAB 6: Cryptographic Password Generator */}
            {currentTab === 'password-gen' && <PasswordGeneratorTool />}

            {/* TAB 7: Camera QR Code Scanner */}
            {currentTab === 'qr-scanner' && (
              <QrScannerTool
                onLoadApiEndpoint={(endpointUrl) => {
                  setUrl(endpointUrl);
                  setMethod('GET');
                  setApiError(null);
                  setApiResponse(null);
                  onChangeActiveTool('api-tester');
                  notify.info('Endpoint Loaded in API Tester', { description: endpointUrl });
                }}
                onLoadApiConfigJson={(cfg) => {
                  setUrl(cfg.url);
                  if (
                    cfg.method &&
                    ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(cfg.method.toUpperCase())
                  ) {
                    setMethod(cfg.method.toUpperCase() as HttpMethod);
                  }
                  if (cfg.headersJson) setHeadersJson(cfg.headersJson);
                  if (cfg.bodyJson) setBodyJson(cfg.bodyJson);
                  setApiError(null);
                  setApiResponse(null);
                  onChangeActiveTool('api-tester');
                  notify.info('QR Config Loaded in API Tester', { description: cfg.url });
                }}
                onOpenJsonFormatter={(formattedJson) => {
                  setJsonRaw(formattedJson);
                  setJsonError(null);
                  onChangeActiveTool('json-formatter');
                }}
                onOpenJwtDecoder={(token) => {
                  setJwtInput(token);
                  onChangeActiveTool('jwt-decoder');
                }}
              />
            )}

            {/* TAB 8: Interactive Syntax Visualizer */}
            {currentTab === 'syntax-visualizer' && (
              <SyntaxVisualizer requestContext={requestSyntaxContext} />
            )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        )}
      </div>
    </section>
  );
}
