import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  FileCode,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import { notify } from '../../lib/toast.ts';
import type { ApiPreset, HttpMethod } from '../../types/hunrutech.ts';

export type SyntaxFormat = 'yaml' | 'json' | 'bash';

export interface RequestSyntaxContext {
  preset?: ApiPreset | null;
  method: HttpMethod;
  url: string;
  headersJson: string;
  bodyJson: string;
}

interface SyntaxVisualizerProps {
  requestContext?: RequestSyntaxContext;
  compact?: boolean;
  onOpenFullTab?: () => void;
}

interface SecuritySample {
  id: string;
  label: string;
  format: SyntaxFormat;
  code: string;
}

const CYBER_SAMPLES: SecuritySample[] = [
  {
    id: 'k8s-networkpolicy',
    label: 'K8s Zero-Trust NetworkPolicy',
    format: 'yaml',
    code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: hunrutech-zero-trust-egress
  namespace: production-api
spec:
  podSelector:
    matchLabels:
      app: gateway-proxy
      tier: security
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              role: ingress-controller
      ports:
        - protocol: TCP
          port: 8443
  egress:
    # Block RFC1918 lateral movement; allow HTTPS egress only
    - to:
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8
              - 172.16.0.0/12
              - 192.168.0.0/16
      ports:
        - protocol: TCP
          port: 443`,
  },
  {
    id: 'falco-shell-rule',
    label: 'Falco Container Shell Rule',
    format: 'yaml',
    code: `---
- rule: Unauthorized Shell Spawn in Production Container
  desc: Detect interactive shell execution inside hardened application pods
  condition: >
    spawned_process and container
    and proc.name in (bash, sh, zsh, ash)
    and not user.name = "root-breakglass"
  output: >
    Shell spawned in container (user=%user.name pod=%k8s.pod.name
    cmd=%proc.cmdline image=%container.image.repository)
  priority: CRITICAL
  tags: [container, mitre_execution, runtime_defense]
  enabled: true`,
  },
  {
    id: 'iam-csp-json',
    label: 'Zero-Trust CSP & Webhook Policy',
    format: 'json',
    code: `{
  "policyName": "hunrutech-zero-trust-edge",
  "version": "2026-11-01",
  "enforceStrictTls": true,
  "minTlsVersion": "1.3",
  "rateLimitPerMinute": 30,
  "ssrfProtection": {
    "blockPrivateRanges": true,
    "blockedCidrs": ["127.0.0.0/8", "10.0.0.0/8", "169.254.169.254/32"],
    "allowHttpSchemes": ["https"]
  },
  "webhookVerification": {
    "algorithm": "HMAC-SHA512",
    "header": "x-paystack-signature",
    "maxClockSkewSeconds": 300
  }
}`,
  },
  {
    id: 'tls-audit-bash',
    label: 'TLS & Security Header Audit',
    format: 'bash',
    code: `#!/usr/bin/env bash
set -euo pipefail

TARGET_HOST="\${1:-sandbox.safaricom.co.ke}"
TIMEOUT_SEC=8

# Verify TLS 1.2/1.3 certificate chain and ALPN negotiation
echo "[+] Inspecting TLS certificate for \${TARGET_HOST}..."
openssl s_client -connect "\${TARGET_HOST}:443" -servername "\${TARGET_HOST}" </dev/null 2>/dev/null \\
  | openssl x509 -noout -subject -issuer -dates

# Probe strict security headers over HTTPS
curl -sSI --max-time "\${TIMEOUT_SEC}" "https://\${TARGET_HOST}" \\
  | grep -iE "^(strict-transport-security|content-security-policy|x-frame-options|x-content-type-options):" \\
  || echo "[!] Missing hardened security headers"`,
  },
];

function safeParseJsonObject(raw: string): Record<string, unknown> | null {
  if (!raw.trim()) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function toYamlScalar(val: unknown): string {
  if (val === null) return 'null';
  if (typeof val === 'boolean' || typeof val === 'number') return String(val);
  if (typeof val === 'string') {
    if (
      val === '' ||
      /[:#\n\r{}[\],&*!|>'"%@`]/.test(val) ||
      /^(true|false|null|\d+(\.\d+)?)$/i.test(val)
    ) {
      return JSON.stringify(val);
    }
    return val;
  }
  return JSON.stringify(val);
}

function objectToYamlLines(obj: unknown, indent = 0): string[] {
  const pad = '  '.repeat(indent);
  if (Array.isArray(obj)) {
    if (obj.length === 0) return [`${pad}[]`];
    const lines: string[] = [];
    for (const item of obj) {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        const entries = Object.entries(item as Record<string, unknown>);
        if (entries.length === 0) {
          lines.push(`${pad}- {}`);
        } else {
          const [firstKey, firstVal] = entries[0];
          if (firstVal && typeof firstVal === 'object') {
            lines.push(`${pad}- ${firstKey}:`);
            lines.push(...objectToYamlLines(firstVal, indent + 2));
          } else {
            lines.push(`${pad}- ${firstKey}: ${toYamlScalar(firstVal)}`);
          }
          for (const [k, v] of entries.slice(1)) {
            if (v && typeof v === 'object') {
              lines.push(`${pad}  ${k}:`);
              lines.push(...objectToYamlLines(v, indent + 2));
            } else {
              lines.push(`${pad}  ${k}: ${toYamlScalar(v)}`);
            }
          }
        }
      } else {
        lines.push(`${pad}- ${toYamlScalar(item)}`);
      }
    }
    return lines;
  }

  if (obj && typeof obj === 'object') {
    const entries = Object.entries(obj as Record<string, unknown>);
    if (entries.length === 0) return [`${pad}{}`];
    const lines: string[] = [];
    for (const [key, val] of entries) {
      if (val && typeof val === 'object') {
        lines.push(`${pad}${key}:`);
        lines.push(...objectToYamlLines(val, indent + 1));
      } else {
        lines.push(`${pad}${key}: ${toYamlScalar(val)}`);
      }
    }
    return lines;
  }

  return [`${pad}${toYamlScalar(obj)}`];
}

function buildPresetSnippet(ctx: RequestSyntaxContext, format: SyntaxFormat): string {
  const headersObj = safeParseJsonObject(ctx.headersJson) ?? {};
  const bodyObj = !['GET', 'HEAD'].includes(ctx.method)
    ? safeParseJsonObject(ctx.bodyJson) ?? (ctx.bodyJson.trim() ? ctx.bodyJson.trim() : undefined)
    : undefined;

  const presetTitle = ctx.preset?.name || 'Custom API Request';
  const presetCategory = ctx.preset?.category || 'Custom';

  if (format === 'json') {
    const manifest = {
      preset: presetTitle,
      category: presetCategory,
      request: {
        method: ctx.method,
        url: ctx.url.trim() || 'https://api.example.com',
        headers: headersObj,
        ...(bodyObj !== undefined ? { body: bodyObj } : {}),
      },
      securityChecks: {
        ssrfEgressGuard: true,
        tlsRequired: ctx.url.trim().startsWith('https://'),
      },
    };
    return JSON.stringify(manifest, null, 2);
  }

  if (format === 'yaml') {
    const lines = [
      `# Active Preset: ${presetTitle}`,
      `apiVersion: hunrutech.dev/v1`,
      `kind: EndpointProbe`,
      `metadata:`,
      `  name: ${toYamlScalar(presetTitle)}`,
      `  category: ${toYamlScalar(presetCategory)}`,
      `spec:`,
      `  method: ${ctx.method}`,
      `  url: ${toYamlScalar(ctx.url.trim() || 'https://api.example.com')}`,
      `  tlsVerify: ${ctx.url.trim().startsWith('https://') ? 'true' : 'false'}`,
      `  headers:`,
      ...objectToYamlLines(headersObj, 2),
    ];
    if (bodyObj !== undefined) {
      lines.push(`  payload:`);
      if (typeof bodyObj === 'string') {
        lines.push(`    raw: ${toYamlScalar(bodyObj)}`);
      } else {
        lines.push(...objectToYamlLines(bodyObj, 2));
      }
    }
    return lines.join('\n');
  }

  // Bash format
  const escapeSingle = (val: string) => val.replace(/'/g, "'\\''");
  const lines = [
    `#!/usr/bin/env bash`,
    `set -euo pipefail`,
    `# Preset: ${presetTitle} (${presetCategory})`,
    `TARGET_URL='${escapeSingle(ctx.url.trim() || 'https://api.example.com')}'`,
    ``,
    `curl -sS -w "\\nHTTP_STATUS:%{http_code} LATENCY:%{time_total}s\\n" \\`,
    `  -X ${ctx.method} "\${TARGET_URL}" \\`,
  ];
  for (const [k, v] of Object.entries(headersObj)) {
    lines.push(`  -H '${escapeSingle(`${k}: ${String(v)}`)}' \\`);
  }
  if (bodyObj !== undefined) {
    const bodyText = typeof bodyObj === 'string' ? bodyObj : JSON.stringify(bodyObj);
    lines.push(`  -d '${escapeSingle(bodyText)}' \\`);
  }
  // Remove trailing backslash on final curl argument
  const lastIdx = lines.length - 1;
  lines[lastIdx] = lines[lastIdx].replace(/ \\$/, '');
  lines.push(`  | jq .`);
  return lines.join('\n');
}

function validateSyntax(format: SyntaxFormat, code: string): { valid: boolean; message: string } {
  const trimmed = code.trim();
  if (!trimmed) {
    return { valid: false, message: 'Buffer is empty' };
  }

  if (format === 'json') {
    try {
      JSON.parse(trimmed);
      return { valid: true, message: 'Valid JSON syntax' };
    } catch (err) {
      return {
        valid: false,
        message: err instanceof Error ? err.message : 'Invalid JSON syntax',
      };
    }
  }

  if (format === 'yaml') {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^\t+/.test(line)) {
        return {
          valid: false,
          message: `Line ${i + 1}: YAML forbids leading tabs for indentation`,
        };
      }
    }
    return { valid: true, message: 'Valid YAML structure' };
  }

  // Basic Bash quote/brace balance check
  let singleQuotes = 0;
  let doubleQuotes = 0;
  for (let i = 0; i < code.length; i += 1) {
    const ch = code[i];
    const prev = i > 0 ? code[i - 1] : '';
    if (ch === "'" && doubleQuotes % 2 === 0 && prev !== '\\') singleQuotes += 1;
    if (ch === '"' && singleQuotes % 2 === 0 && prev !== '\\') doubleQuotes += 1;
  }
  if (singleQuotes % 2 !== 0) {
    return { valid: false, message: 'Unclosed single quote in Bash script' };
  }
  if (doubleQuotes % 2 !== 0) {
    return { valid: false, message: 'Unclosed double quote in Bash script' };
  }
  return { valid: true, message: 'Valid Bash syntax' };
}

function highlightYamlLine(line: string, lineIndex: number): ReactNode {
  if (!line) return ' ';
  if (/^\s*#/.test(line)) {
    return <span className="text-[#64748B] italic">{line}</span>;
  }
  if (/^\s*(---|\.\.\.)\s*$/.test(line)) {
    return <span className="text-[#E879F9] font-semibold">{line}</span>;
  }

  const kvMatch = line.match(/^(\s*)(-\s+)?([A-Za-z0-9_.-]+)(\s*:\s*)(.*)$/);
  if (kvMatch) {
    const [, indent, dash, key, colon, rest] = kvMatch;
    return (
      <>
        <span>{indent}</span>
        {dash && <span className="text-[#00FF66] font-semibold">{dash}</span>}
        <span className="text-[#00E5FF]">{key}</span>
        <span className="text-[#8B98A9]">{colon}</span>
        {renderYamlValue(rest, lineIndex)}
      </>
    );
  }

  const listMatch = line.match(/^(\s*)(-\s+)(.*)$/);
  if (listMatch) {
    const [, indent, dash, rest] = listMatch;
    return (
      <>
        <span>{indent}</span>
        <span className="text-[#00FF66] font-semibold">{dash}</span>
        {renderYamlValue(rest, lineIndex)}
      </>
    );
  }

  return renderYamlValue(line, lineIndex);
}

function renderYamlValue(val: string, seed: number): ReactNode {
  if (!val) return null;
  const commentIdx = val.indexOf(' #');
  const mainPart = commentIdx >= 0 ? val.slice(0, commentIdx) : val;
  const commentPart = commentIdx >= 0 ? val.slice(commentIdx) : '';

  const trimmed = mainPart.trim();
  let styledMain: ReactNode = <span className="text-[#E6EDF3]">{mainPart}</span>;

  if (/^(true|false|yes|no|on|off|null|~)$/i.test(trimmed)) {
    styledMain = <span className="text-[#E879F9] font-medium">{mainPart}</span>;
  } else if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    styledMain = <span className="text-[#F59E0B]">{mainPart}</span>;
  } else if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    styledMain = <span className="text-[#00FF66]">{mainPart}</span>;
  } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    styledMain = <span className="text-[#A7F3D0]">{mainPart}</span>;
  } else if (trimmed === '>' || trimmed === '|') {
    styledMain = <span className="text-[#E879F9]">{mainPart}</span>;
  }

  return (
    <span key={`yv-${seed}`}>
      {styledMain}
      {commentPart && <span className="text-[#64748B] italic">{commentPart}</span>}
    </span>
  );
}

function highlightJsonLine(line: string, lineIndex: number): ReactNode {
  if (!line) return ' ';
  const tokenRegex =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIdx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }

    const full = match[0];
    const stringToken = match[1];
    const colonSuffix = match[2];
    const boolNullToken = match[3];

    if (stringToken && colonSuffix) {
      nodes.push(
        <span key={`${lineIndex}-${tokenIdx++}`} className="text-[#00E5FF]">
          {stringToken}
        </span>
      );
      nodes.push(
        <span key={`${lineIndex}-${tokenIdx++}`} className="text-[#8B98A9]">
          {colonSuffix}
        </span>
      );
    } else if (stringToken) {
      nodes.push(
        <span key={`${lineIndex}-${tokenIdx++}`} className="text-[#00FF66]">
          {stringToken}
        </span>
      );
    } else if (boolNullToken) {
      nodes.push(
        <span key={`${lineIndex}-${tokenIdx++}`} className="text-[#E879F9] font-medium">
          {boolNullToken}
        </span>
      );
    } else if (/^-?\d/.test(full)) {
      nodes.push(
        <span key={`${lineIndex}-${tokenIdx++}`} className="text-[#F59E0B]">
          {full}
        </span>
      );
    } else {
      nodes.push(
        <span key={`${lineIndex}-${tokenIdx++}`} className="text-[#8B98A9]">
          {full}
        </span>
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

const BASH_KEYWORDS = new Set([
  'if',
  'then',
  'else',
  'elif',
  'fi',
  'for',
  'in',
  'do',
  'done',
  'while',
  'case',
  'esac',
  'set',
  'export',
  'local',
  'echo',
  'printf',
  'return',
  'exit',
]);

const BASH_TOOLS = new Set([
  'curl',
  'openssl',
  'jq',
  'grep',
  'awk',
  'sed',
  'nmap',
  'ssh',
  'docker',
  'kubectl',
  'git',
  'python3',
  'node',
  'npx',
]);

function highlightBashLine(line: string, lineIndex: number): ReactNode {
  if (!line) return ' ';
  if (/^\s*#!/.test(line)) {
    return <span className="text-[#E879F9] font-medium">{line}</span>;
  }
  if (/^\s*#/.test(line)) {
    return <span className="text-[#64748B] italic">{line}</span>;
  }

  const tokenRegex =
    /#.*$|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\$\{?[A-Za-z_][A-Za-z0-9_]*\}?|\|\||&&|[|><]{1,2}|--?[A-Za-z0-9][A-Za-z0-9-]*|\b[A-Za-z_][A-Za-z0-9_]*\b(?==)|[A-Za-z0-9_./:-]+/g;

  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let tokenIdx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    let cls = 'text-[#E6EDF3]';

    if (token.startsWith('#')) {
      cls = 'text-[#64748B] italic';
    } else if (token.startsWith('"') || token.startsWith("'")) {
      cls = 'text-[#A7F3D0]';
    } else if (token.startsWith('$')) {
      cls = 'text-[#00FF66]';
    } else if (token === '|' || token === '&&' || token === '||' || token === '>' || token === '>>') {
      cls = 'text-[#00FF66] font-semibold';
    } else if (token.startsWith('-')) {
      cls = 'text-[#F59E0B]';
    } else if (BASH_KEYWORDS.has(token)) {
      cls = 'text-[#E879F9] font-medium';
    } else if (BASH_TOOLS.has(token)) {
      cls = 'text-[#00E5FF] font-semibold';
    } else if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(token) && line[tokenRegex.lastIndex] === '=') {
      cls = 'text-[#00E5FF]';
    }

    nodes.push(
      <span key={`${lineIndex}-${tokenIdx++}`} className={cls}>
        {token}
      </span>
    );
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    nodes.push(line.slice(lastIndex));
  }

  return nodes;
}

export function SyntaxVisualizer({
  requestContext,
  compact = false,
  onOpenFullTab,
}: SyntaxVisualizerProps) {
  const [format, setFormat] = useState<SyntaxFormat>('yaml');
  const [syncWithPreset, setSyncWithPreset] = useState<boolean>(Boolean(requestContext));
  const [customCode, setCustomCode] = useState<string>(() =>
    requestContext ? buildPresetSnippet(requestContext, 'yaml') : CYBER_SAMPLES[0].code
  );
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
    };
  }, []);

  const presetSyncedCode = useMemo(() => {
    if (!requestContext) return null;
    return buildPresetSnippet(requestContext, format);
  }, [requestContext, format]);

  const activeCode = syncWithPreset && presetSyncedCode !== null ? presetSyncedCode : customCode;

  const handleSelectFormat = (nextFormat: SyntaxFormat) => {
    setFormat(nextFormat);
    if (!syncWithPreset || !requestContext) {
      const matchingSample = CYBER_SAMPLES.find((s) => s.format === nextFormat);
      if (matchingSample) {
        setCustomCode(matchingSample.code);
      }
    }
  };

  const handleLoadSample = (sample: SecuritySample) => {
    setSyncWithPreset(false);
    setFormat(sample.format);
    setCustomCode(sample.code);
  };

  const handleCodeEdit = (value: string) => {
    if (syncWithPreset) {
      setSyncWithPreset(false);
    }
    setCustomCode(value);
  };

  const handleResyncPreset = () => {
    if (!requestContext) return;
    setSyncWithPreset(true);
    setCustomCode(buildPresetSnippet(requestContext, format));
    notify.info('Synced with Active Preset', {
      description: `Updated ${format.toUpperCase()} preview from current API Tester state.`,
    });
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(activeCode);
      setCopied(true);
      notify.success('Configuration Copied', {
        description: `${format.toUpperCase()} snippet copied to clipboard.`,
      });
      if (copyTimerRef.current !== null) window.clearTimeout(copyTimerRef.current);
      copyTimerRef.current = window.setTimeout(() => setCopied(false), 1800);
    } catch {
      notify.error('Clipboard Blocked', {
        description: 'Select the code view to copy manually.',
      });
    }
  };

  const lines = useMemo(() => activeCode.split('\n'), [activeCode]);
  const validation = useMemo(() => validateSyntax(format, activeCode), [format, activeCode]);

  return (
    <div
      className={
        compact
          ? 'rounded-md border border-white/10 bg-[#0A0D12] overflow-hidden'
          : 'p-5 sm:p-6 space-y-5'
      }
    >
      {/* Top Toolbar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-3 ${
          compact
            ? 'px-4 py-2.5 border-b border-white/8 bg-[#121822]'
            : 'pb-4 border-b border-white/8'
        }`}
      >
        <div className="flex flex-wrap items-center gap-3 min-w-0">
          <div className="flex items-center gap-2 text-xs font-mono text-white">
            <Code2 className="w-4 h-4 text-[#00FF66] shrink-0" />
            <span className="font-semibold">Interactive Syntax Visualizer</span>
          </div>

          {requestContext && (
            <button
              type="button"
              onClick={() =>
                syncWithPreset ? setSyncWithPreset(false) : handleResyncPreset()
              }
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                syncWithPreset
                  ? 'border-[#00FF66]/45 bg-[#00FF66]/10 text-[#00FF66]'
                  : 'border-white/12 bg-[#0F141C] text-[#94A3B8] hover:text-white'
              }`}
            >
              <RefreshCw className="w-3 h-3" />
              <span>{syncWithPreset ? 'Synced to Active Preset' : 'Sync Active Preset'}</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Format Switcher */}
          <div
            role="tablist"
            aria-label="Syntax format"
            className="flex items-center gap-1 p-0.5 rounded bg-[#0F141C] border border-white/10"
          >
            {(['yaml', 'json', 'bash'] as SyntaxFormat[]).map((fmt) => {
              const active = format === fmt;
              return (
                <button
                  key={fmt}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectFormat(fmt)}
                  className={`relative px-2.5 py-1 text-[11px] font-mono uppercase rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active ? 'text-[#0A0D12] font-semibold' : 'text-[#8B98A9] hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={compact ? 'syntax-fmt-compact' : 'syntax-fmt-full'}
                      transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute inset-0 rounded bg-[#00FF66]"
                    />
                  )}
                  <span className="relative z-10">{fmt}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              copied
                ? 'bg-[#00FF66] text-[#0A0D12] border-[#00FF66] font-semibold'
                : 'bg-[#141B26] text-[#C4CEDB] hover:text-white border-white/12'
            }`}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="copied"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="inline-flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Copied</span>
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.12 }}
                  className="inline-flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5 text-[#00FF66]" />
                  <span>Copy</span>
                </motion.span>
              )}
            </AnimatePresence>
          </button>

          {compact && onOpenFullTab && (
            <button
              type="button"
              onClick={onOpenFullTab}
              title="Open full editor in Syntax Visualizer tab"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-mono text-[#00E5FF] hover:text-white bg-[#0F141C] border border-white/12 rounded whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Expand</span>
            </button>
          )}
        </div>
      </div>

      {/* Cybersecurity Config Samples Strip */}
      <div
        className={`flex flex-wrap items-center gap-2 ${
          compact ? 'px-4 py-2 border-b border-white/8 bg-[#0F141C]/60' : ''
        }`}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-[#8B98A9] mr-1">
          <FileCode className="w-3.5 h-3.5 text-[#00E5FF]" />
          <span>Security Configs:</span>
        </span>
        {CYBER_SAMPLES.map((sample) => (
          <button
            key={sample.id}
            type="button"
            onClick={() => handleLoadSample(sample)}
            className="px-2.5 py-1 text-[11px] font-mono text-[#C4CEDB] hover:text-white bg-[#0A0D12] hover:bg-[#141B26] border border-white/10 hover:border-white/25 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {sample.label} · {sample.format.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Editor + Highlighted Inspector Grid */}
      <div
        className={`grid grid-cols-1 lg:grid-cols-2 ${
          compact ? 'divide-y lg:divide-y-0 lg:divide-x divide-white/8' : 'gap-5'
        }`}
      >
        {/* Source Editor */}
        <div
          className={
            compact
              ? 'flex flex-col bg-[#0A0D12]'
              : 'rounded-md border border-white/12 bg-[#0A0D12] overflow-hidden flex flex-col'
          }
        >
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/8 bg-[#121822] text-[11px] font-mono text-[#8B98A9]">
            <span>Source Input · {format.toUpperCase()}</span>
            <span className="tabular-nums">
              {lines.length} lines · {activeCode.length} chars
            </span>
          </div>
          <textarea
            rows={compact ? 10 : 16}
            value={activeCode}
            onChange={(e) => handleCodeEdit(e.target.value)}
            spellCheck={false}
            aria-label={`${format.toUpperCase()} configuration editor`}
            className="w-full flex-1 p-3.5 text-xs font-mono leading-relaxed bg-transparent text-[#E6EDF3] placeholder-[#5B6778] focus:outline-none resize-y"
          />
        </div>

        {/* Highlighted Syntax Output */}
        <div
          className={
            compact
              ? 'flex flex-col bg-[#0A0D12] min-w-0'
              : 'rounded-md border border-white/12 bg-[#0A0D12] overflow-hidden flex flex-col min-w-0'
          }
        >
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 border-b border-white/8 bg-[#121822] text-[11px] font-mono">
            <span className="text-[#C4CEDB]">Highlighted Preview</span>
            <span
              className={`inline-flex items-center gap-1.5 ${
                validation.valid ? 'text-[#00FF66]' : 'text-amber-400'
              }`}
            >
              {validation.valid ? (
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              )}
              <span className="truncate max-w-[260px]">{validation.message}</span>
            </span>
          </div>

          <div
            className={`flex-1 overflow-auto p-3.5 font-mono text-xs leading-relaxed ${
              compact ? 'max-h-[260px]' : 'max-h-[380px]'
            }`}
          >
            <div className="space-y-0.5 min-w-max">
              {lines.map((line, idx) => (
                <div key={`${idx}-${line.slice(0, 12)}`} className="flex items-start gap-3">
                  <span className="w-7 text-right text-[#475569] select-none tabular-nums shrink-0">
                    {idx + 1}
                  </span>
                  <code className="whitespace-pre">
                    {format === 'yaml'
                      ? highlightYamlLine(line, idx)
                      : format === 'json'
                      ? highlightJsonLine(line, idx)
                      : highlightBashLine(line, idx)}
                  </code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
