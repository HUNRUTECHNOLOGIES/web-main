// Pure TypeScript MD5 & WebCrypto SHA / HMAC / Base64 / JWT helpers

export function md5(input: string): string {
  const utf8 = unescape(encodeURIComponent(input));
  const words: number[] = [];
  for (let i = 0; i < utf8.length; i++) {
    words[i >> 2] |= (utf8.charCodeAt(i) & 0xff) << ((i % 4) * 8);
  }
  const bitLen = utf8.length * 8;
  words[bitLen >> 5] |= 0x80 << (bitLen % 32);
  words[(((bitLen + 64) >>> 9) << 4) + 14] = bitLen;

  let a = 0x67452301;
  let b = 0xefcdab89;
  let c = 0x98badcfe;
  let d = 0x10325476;

  const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
  const cmn = (q: number, a0: number, b0: number, x: number, s: number, t: number) =>
    (rotl((a0 + q + x + t) | 0, s) + b0) | 0;
  const ff = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn((b0 & c0) | (~b0 & d0), a0, b0, x, s, t);
  const gg = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn((b0 & d0) | (c0 & ~d0), a0, b0, x, s, t);
  const hh = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn(b0 ^ c0 ^ d0, a0, b0, x, s, t);
  const ii = (a0: number, b0: number, c0: number, d0: number, x: number, s: number, t: number) =>
    cmn(c0 ^ (b0 | ~d0), a0, b0, x, s, t);

  for (let i = 0; i < words.length; i += 16) {
    const oa = a;
    const ob = b;
    const oc = c;
    const od = d;

    const w = (idx: number) => words[i + idx] || 0;

    a = ff(a, b, c, d, w(0), 7, -680876936);
    d = ff(d, a, b, c, w(1), 12, -389564586);
    c = ff(c, d, a, b, w(2), 17, 606105819);
    b = ff(b, c, d, a, w(3), 22, -1044525330);
    a = ff(a, b, c, d, w(4), 7, -176418897);
    d = ff(d, a, b, c, w(5), 12, 1200080426);
    c = ff(c, d, a, b, w(6), 17, -1473231341);
    b = ff(b, c, d, a, w(7), 22, -45705983);
    a = ff(a, b, c, d, w(8), 7, 1770035416);
    d = ff(d, a, b, c, w(9), 12, -1958414417);
    c = ff(c, d, a, b, w(10), 17, -42063);
    b = ff(b, c, d, a, w(11), 22, -1990404162);
    a = ff(a, b, c, d, w(12), 7, 1804603682);
    d = ff(d, a, b, c, w(13), 12, -40341101);
    c = ff(c, d, a, b, w(14), 17, -1502002290);
    b = ff(b, c, d, a, w(15), 22, 1236535329);

    a = gg(a, b, c, d, w(1), 5, -165796510);
    d = gg(d, a, b, c, w(6), 9, -1069501632);
    c = gg(c, d, a, b, w(11), 14, 643717713);
    b = gg(b, c, d, a, w(0), 20, -373897302);
    a = gg(a, b, c, d, w(5), 5, -701558691);
    d = gg(d, a, b, c, w(10), 9, 38016083);
    c = gg(c, d, a, b, w(15), 14, -660478335);
    b = gg(b, c, d, a, w(4), 20, -405537848);
    a = gg(a, b, c, d, w(9), 5, 568446438);
    d = gg(d, a, b, c, w(14), 9, -1019803690);
    c = gg(c, d, a, b, w(3), 14, -187363961);
    b = gg(b, c, d, a, w(8), 20, 1163531501);
    a = gg(a, b, c, d, w(13), 5, -1444681467);
    d = gg(d, a, b, c, w(2), 9, -51403784);
    c = gg(c, d, a, b, w(7), 14, 1735328473);
    b = gg(b, c, d, a, w(12), 20, -1926607734);

    a = hh(a, b, c, d, w(5), 4, -378558);
    d = hh(d, a, b, c, w(8), 11, -2022574463);
    c = hh(c, d, a, b, w(11), 16, 1839030562);
    b = hh(b, c, d, a, w(14), 23, -35309556);
    a = hh(a, b, c, d, w(1), 4, -1530992060);
    d = hh(d, a, b, c, w(4), 11, 1272893353);
    c = hh(c, d, a, b, w(7), 16, -155497632);
    b = hh(b, c, d, a, w(10), 23, -1094730640);
    a = hh(a, b, c, d, w(13), 4, 681279174);
    d = hh(d, a, b, c, w(0), 11, -358537222);
    c = hh(c, d, a, b, w(3), 16, -722521979);
    b = hh(b, c, d, a, w(6), 23, 76029189);
    a = hh(a, b, c, d, w(9), 4, -640364487);
    d = hh(d, a, b, c, w(12), 11, -421815835);
    c = hh(c, d, a, b, w(15), 16, 530742520);
    b = hh(b, c, d, a, w(2), 23, -995338651);

    a = ii(a, b, c, d, w(0), 6, -198630844);
    d = ii(d, a, b, c, w(7), 10, 1126891415);
    c = ii(c, d, a, b, w(14), 15, -1416354905);
    b = ii(b, c, d, a, w(5), 21, -57434055);
    a = ii(a, b, c, d, w(12), 6, 1700485571);
    d = ii(d, a, b, c, w(3), 10, -1894986606);
    c = ii(c, d, a, b, w(10), 15, -1051523);
    b = ii(b, c, d, a, w(1), 21, -2054922799);
    a = ii(a, b, c, d, w(8), 6, 1873313359);
    d = ii(d, a, b, c, w(15), 10, -30611744);
    c = ii(c, d, a, b, w(6), 15, -1560198380);
    b = ii(b, c, d, a, w(13), 21, 1309151649);
    a = ii(a, b, c, d, w(4), 6, -145523070);
    d = ii(d, a, b, c, w(11), 10, -1120210379);
    c = ii(c, d, a, b, w(2), 15, 718787259);
    b = ii(b, c, d, a, w(9), 21, -343485551);

    a = (a + oa) | 0;
    b = (b + ob) | 0;
    c = (c + oc) | 0;
    d = (d + od) | 0;
  }

  const toHex = (n: number) => {
    let out = '';
    for (let j = 0; j < 4; j++) {
      out += ((n >> (j * 8)) & 0xff).toString(16).padStart(2, '0');
    }
    return out;
  };
  return toHex(a) + toHex(b) + toHex(c) + toHex(d);
}

export async function shaDigest(algorithm: 'SHA-256' | 'SHA-384' | 'SHA-512', input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest(algorithm, encoded);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hmacDigest(
  algorithm: 'SHA-256' | 'SHA-512',
  secret: string,
  payload: string
): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: algorithm },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function encodeBase64Utf8(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

export function decodeBase64Utf8(b64: string): string {
  const normalized = b64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

export interface DecodedJwt {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signature: string;
  isExpired: boolean | null;
  expiresAtIso: string | null;
  issuedAtIso: string | null;
}

export function decodeJwtToken(token: string): DecodedJwt {
  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    throw new Error('JWT must contain exactly 3 dot-separated segments (header.payload.signature).');
  }
  const header = JSON.parse(decodeBase64Utf8(parts[0])) as Record<string, unknown>;
  const payload = JSON.parse(decodeBase64Utf8(parts[1])) as Record<string, unknown>;
  const signature = parts[2];

  const exp = typeof payload.exp === 'number' ? payload.exp : null;
  const iat = typeof payload.iat === 'number' ? payload.iat : null;

  return {
    header,
    payload,
    signature,
    isExpired: exp !== null ? Date.now() / 1000 > exp : null,
    expiresAtIso: exp !== null ? new Date(exp * 1000).toISOString() : null,
    issuedAtIso: iat !== null ? new Date(iat * 1000).toISOString() : null,
  };
}

export const PASSWORD_CHARSETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  digits: '0123456789',
  symbols: '!@#$%^&*()-_=+[]{};:,.<>?/~',
} as const;

const AMBIGUOUS_CHARS = new Set(['0', 'O', '1', 'l', 'I', '|']);

export interface PasswordGeneratorOptions {
  length: number;
  uppercase: boolean;
  lowercase: boolean;
  digits: boolean;
  symbols: boolean;
  customChars: string;
  customOnly: boolean;
  excludeAmbiguous: boolean;
  requireEachSet: boolean;
}

export interface GeneratedPasswordResult {
  password: string;
  poolSize: number;
  entropyBits: number;
  strengthLabel: 'Weak' | 'Fair' | 'Strong' | 'Very Strong';
}

function getUnbiasedRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  const maxUint32 = 0x100000000;
  const limit = Math.floor(maxUint32 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) {
      return buf[0] % maxExclusive;
    }
  }
}

function deduplicateChars(raw: string, excludeAmbiguous: boolean): string {
  const seen = new Set<string>();
  let out = '';
  for (const ch of raw) {
    if (excludeAmbiguous && AMBIGUOUS_CHARS.has(ch)) continue;
    if (!seen.has(ch)) {
      seen.add(ch);
      out += ch;
    }
  }
  return out;
}

export function buildPasswordCharacterSets(options: PasswordGeneratorOptions): {
  pool: string;
  activeSets: string[];
} {
  const activeSets: string[] = [];

  if (options.customOnly) {
    const customSet = deduplicateChars(options.customChars, options.excludeAmbiguous);
    if (customSet.length > 0) {
      activeSets.push(customSet);
    }
    return { pool: customSet, activeSets };
  }

  if (options.uppercase) {
    const s = deduplicateChars(PASSWORD_CHARSETS.uppercase, options.excludeAmbiguous);
    if (s) activeSets.push(s);
  }
  if (options.lowercase) {
    const s = deduplicateChars(PASSWORD_CHARSETS.lowercase, options.excludeAmbiguous);
    if (s) activeSets.push(s);
  }
  if (options.digits) {
    const s = deduplicateChars(PASSWORD_CHARSETS.digits, options.excludeAmbiguous);
    if (s) activeSets.push(s);
  }
  if (options.symbols) {
    const s = deduplicateChars(PASSWORD_CHARSETS.symbols, options.excludeAmbiguous);
    if (s) activeSets.push(s);
  }
  if (options.customChars.length > 0) {
    const customSet = deduplicateChars(options.customChars, options.excludeAmbiguous);
    if (customSet) activeSets.push(customSet);
  }

  const pool = deduplicateChars(activeSets.join(''), false);
  return { pool, activeSets };
}

export function generateSecurePassword(options: PasswordGeneratorOptions): GeneratedPasswordResult {
  const length = Math.max(4, Math.min(256, Math.floor(options.length)));
  const { pool, activeSets } = buildPasswordCharacterSets(options);

  if (pool.length === 0) {
    throw new Error('Select at least one character set or enter custom characters.');
  }

  const chars: string[] = [];

  if (options.requireEachSet && activeSets.length > 0) {
    const setsToSatisfy = activeSets.slice(0, length);
    for (const set of setsToSatisfy) {
      chars.push(set[getUnbiasedRandomInt(set.length)]);
    }
  }

  while (chars.length < length) {
    chars.push(pool[getUnbiasedRandomInt(pool.length)]);
  }

  // Unbiased Fisher-Yates shuffle using crypto.getRandomValues
  for (let i = chars.length - 1; i > 0; i--) {
    const j = getUnbiasedRandomInt(i + 1);
    const tmp = chars[i];
    chars[i] = chars[j];
    chars[j] = tmp;
  }

  const entropyBits = Math.round(length * Math.log2(pool.length) * 10) / 10;
  let strengthLabel: GeneratedPasswordResult['strengthLabel'] = 'Weak';
  if (entropyBits >= 100) strengthLabel = 'Very Strong';
  else if (entropyBits >= 72) strengthLabel = 'Strong';
  else if (entropyBits >= 48) strengthLabel = 'Fair';

  return {
    password: chars.join(''),
    poolSize: pool.length,
    entropyBits,
    strengthLabel,
  };
}

