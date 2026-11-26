import type { DevToolId } from '../types/hunrutech.ts';

export interface DevToolCatalogEntry {
  id: DevToolId;
  label: string;
  shortLabel: string;
  description: string;
  keywords: string;
  hint: string;
}

export const DEV_TOOLS_CATALOG: DevToolCatalogEntry[] = [
  {
    id: 'api-tester',
    label: 'API & Sandbox Tester',
    shortLabel: 'API Tester',
    description: 'GET/POST/PUT/PATCH/DELETE proxy with Daraja, Paystack, Supabase & cURL export',
    keywords: 'rest http proxy curl headers bearer daraja paystack supabase',
    hint: 'REST Proxy',
  },
  {
    id: 'smtp-tester',
    label: 'SMTP & Email Tester',
    shortLabel: 'SMTP Tester',
    description: 'Test STARTTLS/SSL credentials, handshakes, and live Nodemailer delivery logs',
    keywords: 'smtp email mail server tls ssl starttls port 587 465 nodemailer',
    hint: 'Nodemailer',
  },
  {
    id: 'jwt-decoder',
    label: 'JWT Decoder',
    shortLabel: 'JWT Decoder',
    description: 'Inspect JWT header, payload claims, and token expiration status locally',
    keywords: 'jwt json web token decode bearer claims exp iat header payload',
    hint: 'Utility',
  },
  {
    id: 'hash-base64',
    label: 'Base64 & Hashes',
    shortLabel: 'Hashes',
    description: 'Generate MD5, SHA-256, SHA-384, SHA-512, HMAC signatures, and Base64 UTF-8',
    keywords: 'base64 encode decode md5 sha256 sha512 hmac crypto digest',
    hint: 'Crypto',
  },
  {
    id: 'json-formatter',
    label: 'JSON Formatter',
    shortLabel: 'JSON',
    description: 'Pretty-print (2/4 spaces), minify, validate, and copy JSON payloads',
    keywords: 'json format pretty print minify validate lint syntax',
    hint: 'Utility',
  },
  {
    id: 'password-gen',
    label: 'Password Generator',
    shortLabel: 'Password Gen',
    description: 'CSPRNG secrets with custom character sets, entropy bits, batch mode & instant copy',
    keywords: 'password generator secret csprng entropy random characters symbols copy',
    hint: 'CSPRNG',
  },
  {
    id: 'qr-scanner',
    label: 'QR Code Scanner',
    shortLabel: 'QR Scanner',
    description: 'Scan camera streams or QR images to extract endpoints, JSON configs, Wi-Fi & JWTs',
    keywords: 'qr code scanner camera webcam upload decode endpoint config',
    hint: 'Scanner',
  },
  {
    id: 'syntax-visualizer',
    label: 'Syntax Visualizer',
    shortLabel: 'Syntax',
    description: 'Live YAML, JSON, and Bash syntax highlighting for presets and security configs',
    keywords: 'syntax visualizer yaml json bash highlighter cybersecurity config preset falco networkpolicy',
    hint: 'YAML · JSON · Bash',
  },
];

export interface DynamicDevToolShortcut extends DevToolCatalogEntry {
  index: number;
  digit: string;
  keyCode: string;
  shortcutLabel: string;
}

export function getDynamicDevToolShortcuts(
  enabledTools: DevToolId[]
): DynamicDevToolShortcut[] {
  const visible = DEV_TOOLS_CATALOG.filter((tool) => enabledTools.includes(tool.id));
  return visible.slice(0, 9).map((tool, idx) => {
    const index = idx + 1;
    return {
      ...tool,
      index,
      digit: String(index),
      keyCode: `Digit${index}`,
      shortcutLabel: `Alt+${index}`,
    };
  });
}
