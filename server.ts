import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import dns from 'dns/promises';
import net from 'net';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { adminAuth } from './src/lib/firebase-admin.ts';

const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

// Runtime configurable rate limits & telemetry counters
const runtimeConfig = {
  proxyRateLimitPerMin: 30,
  smtpRateLimitPerMin: 6,
};

interface ExecutionSummary {
  id: string;
  protocol: 'HTTP' | 'SMTP';
  target: string;
  status: string;
  latencyMs: number;
  timestamp: string;
}

const telemetry = {
  totalApiRuns: 0,
  totalSmtpRuns: 0,
  recentExecutions: [] as ExecutionSummary[],
};

function recordExecution(entry: ExecutionSummary) {
  telemetry.recentExecutions.unshift(entry);
  if (telemetry.recentExecutions.length > 25) {
    telemetry.recentExecutions.length = 25;
  }
}

// In-memory sliding window rate limiter
const rateBuckets = new Map<string, number[]>();

function checkRateLimit(key: string, maxPerMin: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const windowStart = now - 60_000;
  const timestamps = (rateBuckets.get(key) || []).filter((ts) => ts > windowStart);
  if (timestamps.length >= maxPerMin) {
    const oldest = timestamps[0];
    const retryAfterSec = Math.max(1, Math.ceil((oldest + 60_000 - now) / 1000));
    rateBuckets.set(key, timestamps);
    return { allowed: false, retryAfterSec };
  }
  timestamps.push(now);
  rateBuckets.set(key, timestamps);
  return { allowed: true, retryAfterSec: 0 };
}

function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || 'unknown';
}

// SSRF Protection: Block all private, loopback, link-local, metadata, and reserved IPs
function isBlockedIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isBlockedIP(ip: string): boolean {
  const normalized = ip.toLowerCase().trim();
  if (net.isIPv4(normalized)) {
    return isBlockedIPv4(normalized);
  }
  if (net.isIPv6(normalized)) {
    if (normalized === '::' || normalized === '::1') return true;
    if (normalized.startsWith('::ffff:')) {
      const mapped = normalized.slice(7);
      if (net.isIPv4(mapped)) return isBlockedIPv4(mapped);
      return true;
    }
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true; // ULA fc00::/7
    if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) {
      return true; // Link-local fe80::/10
    }
    if (normalized.startsWith('ff')) return true; // Multicast
    return false;
  }
  return true;
}

async function validateOutboundHost(hostname: string): Promise<string> {
  const lower = hostname.toLowerCase().trim();
  if (!lower || lower === 'localhost' || lower.endsWith('.localhost') || lower.endsWith('.local') || lower.endsWith('.internal')) {
    throw new Error('Blocked destination: local or internal hostnames are not permitted.');
  }

  if (net.isIP(lower)) {
    if (isBlockedIP(lower)) {
      throw new Error('Blocked destination: private or reserved IP address.');
    }
    return lower;
  }

  let addresses: { address: string; family: number }[];
  try {
    addresses = await dns.lookup(lower, { all: true });
  } catch {
    throw new Error('DNS resolution failed for target host.');
  }

  if (!addresses || addresses.length === 0) {
    throw new Error('Target host did not resolve to any IP address.');
  }

  for (const entry of addresses) {
    if (isBlockedIP(entry.address)) {
      throw new Error('Blocked destination: target resolves to a private or reserved network address.');
    }
  }

  return addresses[0].address;
}

async function validateOutboundUrl(rawUrl: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL format. Include https:// or http://.');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted.');
  }

  if (parsed.username || parsed.password) {
    throw new Error('URL embedded credentials are not allowed; use Authorization headers instead.');
  }

  await validateOutboundHost(parsed.hostname);
  return parsed;
}

// Verify Firebase ID token for Admin API routes
const ADMIN_ALLOWLIST_EMAIL = 'atomzentwo@gmail.com';

async function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Authorization Bearer token.' });
  }
  const token = authHeader.slice(7).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    if (!decoded.email_verified || decoded.email !== ADMIN_ALLOWLIST_EMAIL) {
      return res.status(403).json({ error: 'Forbidden: Admin privileges required.' });
    }
    (req as Request & { adminEmail?: string }).adminEmail = decoded.email;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

async function startServer() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '1mb' }));

  // Health Check
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'hunrutech-api', timestamp: new Date().toISOString() });
  });

  // SSRF-Hardened Multi-Protocol HTTP API Proxy
  app.post('/api/proxy', async (req, res) => {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(`proxy:${clientIp}`, runtimeConfig.proxyRateLimitPerMin);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. Try again in ${rate.retryAfterSec}s.`,
      });
    }

    const { url, method = 'GET', headers = {}, body } = req.body ?? {};
    if (typeof url !== 'string' || url.length > 2048) {
      return res.status(400).json({ error: 'A valid target URL string is required.' });
    }

    const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD'];
    const normalizedMethod = String(method).toUpperCase();
    if (!allowedMethods.includes(normalizedMethod)) {
      return res.status(400).json({ error: `Unsupported HTTP method: ${normalizedMethod}` });
    }

    let validatedUrl: URL;
    try {
      validatedUrl = await validateOutboundUrl(url.trim());
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'Invalid target URL.',
      });
    }

    // Sanitize outbound headers
    const cleanHeaders: Record<string, string> = {
      'User-Agent': 'HUNRUTECH-Workbench/1.0',
    };
    const forbiddenHeaders = new Set(['host', 'connection', 'content-length', 'transfer-encoding', 'upgrade']);
    if (headers && typeof headers === 'object' && !Array.isArray(headers)) {
      for (const [k, v] of Object.entries(headers)) {
        const keyLower = k.toLowerCase().trim();
        if (!keyLower || forbiddenHeaders.has(keyLower) || keyLower.startsWith('sec-') || keyLower.startsWith('proxy-')) {
          continue;
        }
        if (typeof v === 'string' && v.length <= 4096) {
          cleanHeaders[k.trim()] = v;
        }
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const startMs = performance.now();

    try {
      const hasBody = !['GET', 'HEAD'].includes(normalizedMethod) && body !== undefined && body !== '';
      const requestInit: RequestInit = {
        method: normalizedMethod,
        headers: cleanHeaders,
        redirect: 'manual', // Block open-redirect SSRF bounces
        signal: controller.signal,
        ...(hasBody ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
      };

      const upstream = await fetch(validatedUrl.toString(), requestInit);
      const latencyMs = Math.round(performance.now() - startMs);

      // Read capped at 1.5MB
      const arrayBuf = await upstream.arrayBuffer();
      const maxBytes = 1_500_000;
      const truncated = arrayBuf.byteLength > maxBytes;
      const slicedBuf = truncated ? arrayBuf.slice(0, maxBytes) : arrayBuf;
      const rawText = Buffer.from(slicedBuf).toString('utf8');

      const responseHeaders: Record<string, string> = {};
      upstream.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      let parsedJson: unknown = null;
      let isJson = false;
      try {
        parsedJson = JSON.parse(rawText);
        isJson = true;
      } catch {
        isJson = false;
      }

      telemetry.totalApiRuns += 1;
      recordExecution({
        id: crypto.randomUUID().slice(0, 8),
        protocol: 'HTTP',
        target: `${normalizedMethod} ${validatedUrl.hostname}${validatedUrl.pathname}`,
        status: `${upstream.status} ${upstream.statusText}`,
        latencyMs,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        status: upstream.status,
        statusText: upstream.statusText,
        latencyMs,
        sizeBytes: arrayBuf.byteLength,
        truncated,
        headers: responseHeaders,
        isJson,
        body: isJson ? parsedJson : rawText,
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startMs);
      telemetry.totalApiRuns += 1;
      recordExecution({
        id: crypto.randomUUID().slice(0, 8),
        protocol: 'HTTP',
        target: `${normalizedMethod} ${validatedUrl.hostname}`,
        status: 'ERROR',
        latencyMs,
        timestamp: new Date().toISOString(),
      });

      const msg =
        err instanceof Error && err.name === 'AbortError'
          ? 'Request timed out after 10 seconds.'
          : err instanceof Error
          ? err.message
          : 'Upstream request failed.';
      return res.status(502).json({ error: msg, latencyMs });
    } finally {
      clearTimeout(timeoutId);
    }
  });

  // SMTP & Email Tester via Nodemailer
  app.post('/api/smtp-test', async (req, res) => {
    const clientIp = getClientIp(req);
    const rate = checkRateLimit(`smtp:${clientIp}`, runtimeConfig.smtpRateLimitPerMin);
    if (!rate.allowed) {
      return res.status(429).json({
        error: `SMTP rate limit exceeded. Try again in ${rate.retryAfterSec}s.`,
      });
    }

    const {
      host,
      port = 587,
      security = 'starttls',
      user = '',
      pass = '',
      from = '',
      to = '',
      subject = 'HUNRUTECH SMTP Diagnostic Test',
      body = 'Automated SMTP verification message from the HUNRUTECH DevTools Workbench.',
      sendEmail = false,
    } = req.body ?? {};

    if (typeof host !== 'string' || !host.trim() || host.length > 253) {
      return res.status(400).json({ error: 'Valid SMTP host is required.' });
    }

    const portNum = Number(port);
    if (!Number.isInteger(portNum) || ![25, 465, 587, 2525].includes(portNum)) {
      return res.status(400).json({ error: 'Port must be one of 25, 465, 587, or 2525.' });
    }

    try {
      await validateOutboundHost(host.trim());
    } catch (err) {
      return res.status(400).json({
        error: err instanceof Error ? err.message : 'SMTP host blocked by security policy.',
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (sendEmail) {
      if (typeof from !== 'string' || !emailRegex.test(from.trim())) {
        return res.status(400).json({ error: 'Valid From email address is required to send test mail.' });
      }
      if (typeof to !== 'string' || !emailRegex.test(to.trim())) {
        return res.status(400).json({ error: 'Valid To email address is required to send test mail.' });
      }
    }

    const logs: string[] = [];
    const customLogger = {
      level: () => {},
      trace: (...args: unknown[]) => logs.push(`[TRACE] ${args.map(String).join(' ')}`),
      debug: (...args: unknown[]) => logs.push(`[DEBUG] ${args.map(String).join(' ')}`),
      info: (...args: unknown[]) => logs.push(`[INFO] ${args.map(String).join(' ')}`),
      warn: (...args: unknown[]) => logs.push(`[WARN] ${args.map(String).join(' ')}`),
      error: (...args: unknown[]) => logs.push(`[ERROR] ${args.map(String).join(' ')}`),
      fatal: (...args: unknown[]) => logs.push(`[FATAL] ${args.map(String).join(' ')}`),
    };

    const startMs = performance.now();
    const isSecureTls = security === 'ssl' || portNum === 465;

    const transporter = nodemailer.createTransport({
      host: host.trim(),
      port: portNum,
      secure: isSecureTls,
      requireTLS: security === 'starttls',
      ignoreTLS: security === 'none',
      auth:
        typeof user === 'string' && user.trim()
          ? { user: user.trim(), pass: typeof pass === 'string' ? pass : '' }
          : undefined,
      connectionTimeout: 8000,
      greetingTimeout: 8000,
      socketTimeout: 10000,
      logger: customLogger as never,
      debug: true,
    });

    try {
      logs.push(`[INIT] Connecting to ${host.trim()}:${portNum} (${security.toUpperCase()})`);
      await transporter.verify();
      logs.push('[AUTH] SMTP handshake and authentication verified.');

      let info: { messageId?: string; response?: string } | null = null;
      if (sendEmail) {
        info = await transporter.sendMail({
          from: from.trim(),
          to: to.trim(),
          subject: String(subject).slice(0, 200),
          text: String(body).slice(0, 5000),
        });
        logs.push(`[SENT] Message accepted: ${info.messageId}`);
      }

      const latencyMs = Math.round(performance.now() - startMs);
      telemetry.totalSmtpRuns += 1;
      recordExecution({
        id: crypto.randomUUID().slice(0, 8),
        protocol: 'SMTP',
        target: `${host.trim()}:${portNum}`,
        status: sendEmail ? '250 SENT' : '250 VERIFIED',
        latencyMs,
        timestamp: new Date().toISOString(),
      });

      return res.json({
        success: true,
        latencyMs,
        verified: true,
        messageId: info?.messageId || null,
        response: info?.response || 'SMTP server verified successfully.',
        logs: logs.slice(0, 60),
      });
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startMs);
      telemetry.totalSmtpRuns += 1;
      recordExecution({
        id: crypto.randomUUID().slice(0, 8),
        protocol: 'SMTP',
        target: `${host.trim()}:${portNum}`,
        status: 'FAILED',
        latencyMs,
        timestamp: new Date().toISOString(),
      });

      const message = err instanceof Error ? err.message : 'SMTP connection failed.';
      logs.push(`[FAIL] ${message}`);
      return res.status(400).json({
        success: false,
        latencyMs,
        error: message,
        logs: logs.slice(0, 60),
      });
    } finally {
      transporter.close();
    }
  });

  // Paystack Webhook Signature Simulator Helper
  app.post('/api/paystack/webhook-sign', (req, res) => {
    const { secretKey, payload } = req.body ?? {};
    if (typeof secretKey !== 'string' || !secretKey.trim()) {
      return res.status(400).json({ error: 'Test secret key is required to compute HMAC-SHA512 signature.' });
    }
    const serialized = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
    const signature = crypto.createHmac('sha512', secretKey.trim()).update(serialized).digest('hex');
    return res.json({ signature, headerName: 'x-paystack-signature' });
  });

  // Cached GitHub Developer Stats for @hunter-zen-RU
  interface GitHubStatsPayload {
    username: string;
    profileUrl: string;
    repoCount: number;
    starCount: number;
    followers: number;
    languages: Array<{ name: string; count: number; percentage: number }>;
    fetchedAt: string;
  }
  let githubStatsCache: { data: GitHubStatsPayload; expiresAt: number } | null = null;

  app.get('/api/github/stats', async (req, res) => {
    const forceRefresh = req.query.refresh === '1';
    const now = Date.now();
    if (!forceRefresh && githubStatsCache && githubStatsCache.expiresAt > now) {
      return res.json(githubStatsCache.data);
    }

    const username = 'hunter-zen-RU';
    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'HUNRUTECH-Platform/1.0',
    };
    if (process.env.GITHUB_TOKEN) {
      ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const [userRes, reposRes] = await Promise.all([
        fetch(`https://api.github.com/users/${username}`, {
          headers: ghHeaders,
          signal: AbortSignal.timeout(8000),
        }),
        fetch(`https://api.github.com/users/${username}/repos?per_page=100&type=owner&sort=updated`, {
          headers: ghHeaders,
          signal: AbortSignal.timeout(8000),
        }),
      ]);

      if (!userRes.ok) {
        if (githubStatsCache) {
          return res.json(githubStatsCache.data);
        }
        return res.status(userRes.status === 404 ? 404 : 502).json({
          error: `GitHub API returned HTTP ${userRes.status}.`,
        });
      }

      const userData = (await userRes.json()) as {
        login?: string;
        html_url?: string;
        public_repos?: number;
        followers?: number;
      };

      const reposData = reposRes.ok
        ? ((await reposRes.json()) as Array<{
            stargazers_count?: number;
            language?: string | null;
            fork?: boolean;
          }>)
        : [];

      let starCount = 0;
      const langCounts = new Map<string, number>();

      for (const repo of reposData) {
        starCount += Number(repo.stargazers_count || 0);
        if (repo.language && typeof repo.language === 'string') {
          langCounts.set(repo.language, (langCounts.get(repo.language) || 0) + 1);
        }
      }

      const totalLangRepos = Array.from(langCounts.values()).reduce((sum, n) => sum + n, 0);
      const sortedLangs = Array.from(langCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, count]) => ({
          name,
          count,
          percentage: totalLangRepos > 0 ? Math.round((count / totalLangRepos) * 100) : 0,
        }));

      const payload: GitHubStatsPayload = {
        username: userData.login || username,
        profileUrl: userData.html_url || `https://github.com/${username}`,
        repoCount: Number(userData.public_repos ?? reposData.length),
        starCount,
        followers: Number(userData.followers ?? 0),
        languages: sortedLangs,
        fetchedAt: new Date().toISOString(),
      };

      githubStatsCache = {
        data: payload,
        expiresAt: now + 10 * 60 * 1000,
      };

      return res.json(payload);
    } catch {
      if (githubStatsCache) {
        return res.json(githubStatsCache.data);
      }
      return res.status(502).json({
        error: 'Unable to reach GitHub API at this time.',
      });
    }
  });

  // Cached 52-week GitHub Commit & Contribution Activity Heatmap for @hunter-zen-RU
  interface HeatmapDay {
    date: string;
    count: number;
    level: 0 | 1 | 2 | 3 | 4;
  }
  interface GitHubActivityPayload {
    username: string;
    totalContributions: number;
    activeDays: number;
    longestStreak: number;
    weeks: Array<{ weekStart: string; days: HeatmapDay[] }>;
    fetchedAt: string;
  }
  let githubActivityCache: { data: GitHubActivityPayload; expiresAt: number } | null = null;

  app.get('/api/github/activity', async (req, res) => {
    const forceRefresh = req.query.refresh === '1';
    const nowMs = Date.now();
    if (!forceRefresh && githubActivityCache && githubActivityCache.expiresAt > nowMs) {
      return res.json(githubActivityCache.data);
    }

    const username = 'hunter-zen-RU';
    const ghHeaders: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'HUNRUTECH-Platform/1.0',
    };
    if (process.env.GITHUB_TOKEN) {
      ghHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
      const [reposRes, eventsRes] = await Promise.all([
        fetch(
          `https://api.github.com/users/${username}/repos?per_page=20&type=owner&sort=pushed`,
          { headers: ghHeaders, signal: AbortSignal.timeout(8000) }
        ),
        fetch(`https://api.github.com/users/${username}/events/public?per_page=100`, {
          headers: ghHeaders,
          signal: AbortSignal.timeout(8000),
        }),
      ]);

      if (!reposRes.ok && !eventsRes.ok) {
        if (githubActivityCache) {
          return res.json(githubActivityCache.data);
        }
        return res.status(502).json({
          error: `GitHub API returned HTTP ${reposRes.status}.`,
        });
      }

      const reposData = reposRes.ok
        ? ((await reposRes.json()) as Array<{ name?: string; fork?: boolean }>)
        : [];
      const eventsData = eventsRes.ok
        ? ((await eventsRes.json()) as Array<{
            type?: string;
            created_at?: string;
            payload?: { size?: number; commits?: unknown[] };
          }>)
        : [];

      const dailyCommits = new Map<string, number>();

      // Fetch 52-week commit_activity stats for top owned repositories
      const targetRepos = reposData
        .filter((r) => r.name && !r.fork)
        .slice(0, 8)
        .map((r) => r.name as string);

      const statsResults = await Promise.allSettled(
        targetRepos.map((repoName) =>
          fetch(
            `https://api.github.com/repos/${username}/${encodeURIComponent(repoName)}/stats/commit_activity`,
            { headers: ghHeaders, signal: AbortSignal.timeout(5000) }
          ).then(async (r) => (r.status === 200 ? ((await r.json()) as Array<{ week: number; days: number[] }>) : []))
        )
      );

      for (const result of statsResults) {
        if (result.status !== 'fulfilled' || !Array.isArray(result.value)) continue;
        for (const weekEntry of result.value) {
          if (!weekEntry || !Array.isArray(weekEntry.days) || typeof weekEntry.week !== 'number') {
            continue;
          }
          for (let d = 0; d < 7; d++) {
            const count = Number(weekEntry.days[d] || 0);
            if (count <= 0) continue;
            const dateStr = new Date((weekEntry.week + d * 86400) * 1000).toISOString().slice(0, 10);
            dailyCommits.set(dateStr, (dailyCommits.get(dateStr) || 0) + count);
          }
        }
      }

      // Merge recent public push/creation events so very recent activity is reflected immediately
      const eventCommits = new Map<string, number>();
      for (const ev of eventsData) {
        if (!ev.created_at) continue;
        const dateStr = ev.created_at.slice(0, 10);
        const weight =
          ev.type === 'PushEvent'
            ? Math.max(1, Number(ev.payload?.size || ev.payload?.commits?.length || 1))
            : 1;
        eventCommits.set(dateStr, (eventCommits.get(dateStr) || 0) + weight);
      }

      for (const [dateStr, evCount] of eventCommits.entries()) {
        dailyCommits.set(dateStr, Math.max(dailyCommits.get(dateStr) || 0, evCount));
      }

      // Build 52-week grid ending on the upcoming/current Saturday (Sunday -> Saturday columns)
      const todayUtc = new Date();
      todayUtc.setUTCHours(0, 0, 0, 0);
      const dayOfWeek = todayUtc.getUTCDay(); // 0=Sun..6=Sat
      const endOfWeek = new Date(todayUtc);
      endOfWeek.setUTCDate(endOfWeek.getUTCDate() + (6 - dayOfWeek));

      const startOfGrid = new Date(endOfWeek);
      startOfGrid.setUTCDate(startOfGrid.getUTCDate() - (52 * 7 - 1));

      const rawCounts: Array<{ date: string; count: number; isFuture: boolean }> = [];
      let maxDayCount = 0;
      let totalContributions = 0;
      let activeDays = 0;
      let currentStreak = 0;
      let longestStreak = 0;

      for (let i = 0; i < 52 * 7; i++) {
        const cellDate = new Date(startOfGrid);
        cellDate.setUTCDate(startOfGrid.getUTCDate() + i);
        const isFuture = cellDate.getTime() > todayUtc.getTime();
        const dateStr = cellDate.toISOString().slice(0, 10);
        const count = isFuture ? 0 : dailyCommits.get(dateStr) || 0;

        if (!isFuture) {
          totalContributions += count;
          if (count > 0) {
            activeDays += 1;
            currentStreak += 1;
            if (currentStreak > longestStreak) longestStreak = currentStreak;
          } else {
            currentStreak = 0;
          }
          if (count > maxDayCount) maxDayCount = count;
        }
        rawCounts.push({ date: dateStr, count, isFuture });
      }

      const toLevel = (count: number): 0 | 1 | 2 | 3 | 4 => {
        if (count <= 0) return 0;
        const cap = Math.max(maxDayCount, 4);
        const ratio = count / cap;
        if (ratio <= 0.25) return 1;
        if (ratio <= 0.5) return 2;
        if (ratio <= 0.75) return 3;
        return 4;
      };

      const weeks: Array<{ weekStart: string; days: HeatmapDay[] }> = [];
      for (let w = 0; w < 52; w++) {
        const slice = rawCounts.slice(w * 7, w * 7 + 7);
        weeks.push({
          weekStart: slice[0].date,
          days: slice.map((entry) => ({
            date: entry.date,
            count: entry.count,
            level: toLevel(entry.count),
          })),
        });
      }

      const payload: GitHubActivityPayload = {
        username,
        totalContributions,
        activeDays,
        longestStreak,
        weeks,
        fetchedAt: new Date().toISOString(),
      };

      githubActivityCache = {
        data: payload,
        expiresAt: nowMs + 15 * 60 * 1000,
      };

      return res.json(payload);
    } catch {
      if (githubActivityCache) {
        return res.json(githubActivityCache.data);
      }
      return res.status(502).json({
        error: 'Unable to fetch GitHub commit activity right now.',
      });
    }
  });

  // Protected Admin Telemetry & Rate Limit Endpoints
  app.get('/api/admin/stats', requireAdminAuth, (_req, res) => {
    res.json({
      totalApiRuns: telemetry.totalApiRuns,
      totalSmtpRuns: telemetry.totalSmtpRuns,
      recentExecutions: telemetry.recentExecutions,
      rateLimits: runtimeConfig,
      uptimeSec: Math.floor(process.uptime()),
    });
  });

  app.post('/api/admin/rate-limits', requireAdminAuth, (req, res) => {
    const { proxyRateLimitPerMin, smtpRateLimitPerMin } = req.body ?? {};
    const proxyNum = Number(proxyRateLimitPerMin);
    const smtpNum = Number(smtpRateLimitPerMin);
    if (!Number.isInteger(proxyNum) || proxyNum < 1 || proxyNum > 120) {
      return res.status(400).json({ error: 'Proxy rate limit must be an integer between 1 and 120.' });
    }
    if (!Number.isInteger(smtpNum) || smtpNum < 1 || smtpNum > 30) {
      return res.status(400).json({ error: 'SMTP rate limit must be an integer between 1 and 30.' });
    }
    runtimeConfig.proxyRateLimitPerMin = proxyNum;
    runtimeConfig.smtpRateLimitPerMin = smtpNum;
    return res.json({ ok: true, rateLimits: runtimeConfig });
  });

  // Serve Vite in dev or dist/ in prod
  if (!IS_PROD) {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HUNRUTECH server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
