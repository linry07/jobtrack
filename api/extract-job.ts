import type { VercelRequest, VercelResponse } from '@vercel/node';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns/promises';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { createClient } from '@supabase/supabase-js';
// @ts-ignore
import WebSocket from 'ws';

if (!(globalThis as any).WebSocket) {
  (globalThis as any).WebSocket = WebSocket;
}

// ============================================================================
// 1. SSRF & Security Protections
// ============================================================================

export function parseIPv6Words(ip: string): number[] {
  let cleaned = ip.toLowerCase().replace(/^\[|\]$/g, '');
  let ipv4Part: string | null = null;
  if (cleaned.includes('.')) {
    const lastColon = cleaned.lastIndexOf(':');
    ipv4Part = cleaned.slice(lastColon + 1);
    cleaned = cleaned.slice(0, lastColon + 1) + '0:0';
  }
  let parts = cleaned.split(':');
  if (cleaned.includes('::')) {
    const halves = cleaned.split('::');
    const left = halves[0] ? halves[0].split(':') : [];
    const right = halves[1] ? halves[1].split(':') : [];
    const missing = 8 - (left.length + right.length);
    parts = [...left, ...Array(missing).fill('0'), ...right];
  }
  if (ipv4Part) {
    const octs = ipv4Part.split('.').map(Number);
    parts[6] = ((octs[0] << 8) | octs[1]).toString(16);
    parts[7] = ((octs[2] << 8) | octs[3]).toString(16);
  }
  return parts.map((p) => parseInt(p || '0', 16));
}

export function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => isNaN(n) || n < 0 || n > 255)) {
    return true; // invalid -> block
  }
  const [a, b, c, d] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (Private - RFC 1918)
  if (a === 10) return true;
  // 100.64.0.0/10 (Shared Address Space / Carrier-Grade NAT - RFC 6598)
  if (a === 100 && (b & 0xc0) === 64) return true;
  // 127.0.0.0/8 (Loopback - RFC 1122)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-Local / Cloud Metadata - RFC 3927)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (Private - RFC 1918: 172.16.0.0 - 172.31.255.255)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF protocol assignments & Oracle cloud metadata 192.0.0.192)
  if (a === 192 && b === 0 && c === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1 - RFC 5737)
  if (a === 192 && b === 0 && c === 2) return true;
  // 192.88.99.0/24 (6to4 Relay - RFC 3068)
  if (a === 192 && b === 88 && c === 99) return true;
  // 192.168.0.0/16 (Private - RFC 1918)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Benchmarking - RFC 2544: 198.18.0.0 - 198.19.255.255)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2 - RFC 5737)
  if (a === 198 && b === 51 && c === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3 - RFC 5737)
  if (a === 203 && b === 0 && c === 113) return true;
  // 224.0.0.0/4 (Multicast - RFC 5771: 224 - 239)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future use - RFC 1112: 240 - 255)
  if (a >= 240) return true;
  // 255.255.255.255 (Broadcast)
  if (a === 255 && b === 255 && c === 255 && d === 255) return true;

  return false;
}

export function isPrivateOrReservedIpv6(ip: string): boolean {
  try {
    const words = parseIPv6Words(ip);
    if (words.length !== 8 || words.some((w) => isNaN(w) || w < 0 || w > 0xffff)) {
      return true;
    }

    // ::/128 (Unspecified) & ::1/128 (Loopback)
    const allZeroExceptLast = words.slice(0, 7).every((w) => w === 0);
    if (allZeroExceptLast && (words[7] === 0 || words[7] === 1)) {
      return true;
    }

    // IPv4-mapped / IPv4-translated (::ffff:0:0/96 or ::ffff:0:0:0/96 or ::0:ffff:0:0)
    const isMapped =
      (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0 && words[4] === 0 && words[5] === 0xffff) ||
      (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0 && words[4] === 0xffff && words[5] === 0) ||
      (words[0] === 0 && words[1] === 0 && words[2] === 0 && words[3] === 0 && words[4] === 0 && words[5] === 0);

    if (isMapped) {
      const ipv4Str = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
      if (isPrivateOrReservedIpv4(ipv4Str)) return true;
    }

    // fc00::/7 (ULA - Unique Local Address, private IPv6: fc00: to fdff:)
    if ((words[0] & 0xfe00) === 0xfc00) return true;

    // fe80::/10 (Link-Local unicast: fe80: to febf:)
    if ((words[0] & 0xffc0) === 0xfe80) return true;

    // ff00::/8 (Multicast)
    if ((words[0] & 0xff00) === 0xff00) return true;

    // 2001:db8::/32 (Documentation)
    if (words[0] === 0x2001 && words[1] === 0x0db8) return true;

    // 2002::/16 (6to4 addressing - maps to IPv4 in words[1], words[2])
    if (words[0] === 0x2002) {
      const ipv4Str = `${words[1] >> 8}.${words[1] & 0xff}.${words[2] >> 8}.${words[2] & 0xff}`;
      if (isPrivateOrReservedIpv4(ipv4Str)) return true;
    }

    // 64:ff9b::/96 (IPv4/IPv6 translation - RFC 6052)
    if (words[0] === 0x0064 && words[1] === 0xff9b && words[2] === 0 && words[3] === 0 && words[4] === 0 && words[5] === 0) {
      const ipv4Str = `${words[6] >> 8}.${words[6] & 0xff}.${words[7] >> 8}.${words[7] & 0xff}`;
      if (isPrivateOrReservedIpv4(ipv4Str)) return true;
    }

    // 100::/64 (Discard-only prefix - RFC 6666)
    if (words[0] === 0x0100 && words[1] === 0 && words[2] === 0 && words[3] === 0) return true;

    return false;
  } catch {
    return true;
  }
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (!ip || typeof ip !== 'string') return true;
  const cleaned = ip.trim().replace(/^\[|\]$/g, '');
  const ver = net.isIP(cleaned);
  if (ver === 4) return isPrivateOrReservedIpv4(cleaned);
  if (ver === 6) return isPrivateOrReservedIpv6(cleaned);
  return true;
}

export function isPrivateOrReservedHost(hostname: string): boolean {
  if (!hostname || typeof hostname !== 'string') return true;
  const lower = hostname.toLowerCase().trim().replace(/^\[|\]$/g, '');

  if (
    lower === 'localhost' ||
    lower.endsWith('.localhost') ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower.endsWith('.lan') ||
    lower === 'metadata.google.internal' ||
    lower === 'instance-data'
  ) {
    return true;
  }

  // Check if hostname is an IP literal
  if (net.isIP(lower)) {
    return isPrivateOrReservedIp(lower);
  }

  return false;
}

// In-Memory sliding-window rate limiter (for Vercel warm containers)
interface RateLimitEntry {
  count: number;
  resetAt: number;
}
const rateLimitStore = new Map<string, RateLimitEntry>();
export const MAX_REQUESTS_PER_WINDOW = 15;
export const WINDOW_MS = 60 * 1000; // 60 seconds

export function checkRateLimit(identifier: string): { allowed: boolean; remaining: number; retryAfter?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  // Periodic pruning of expired entries
  if (rateLimitStore.size > 500) {
    for (const [key, val] of rateLimitStore.entries()) {
      if (val.resetAt <= now) rateLimitStore.delete(key);
    }
  }

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - 1 };
  }

  if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, remaining: 0, retryAfter };
  }

  entry.count++;
  return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.count };
}

export interface SafeFetchResult {
  body?: string;
  finalUrl?: string;
  errorStatus?: number;
}

// Robust Safe Fetch with IP Pinning (Zero DNS Rebinding TOCTOU), Multi-IP Fallback, and Decompression
export async function safeFetchHtml(
  inputUrl: string,
  maxRedirects = 5
): Promise<SafeFetchResult> {
  let currentUrlStr = inputUrl;
  let redirectCount = 0;

  while (redirectCount <= maxRedirects) {
    const parsedUrl = new URL(currentUrlStr);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      throw new Error('Only HTTP and HTTPS URLs are supported.');
    }

    if (parsedUrl.username || parsedUrl.password) {
      throw new Error('URLs with embedded credentials are not allowed.');
    }

    const isHttps = parsedUrl.protocol === 'https:';
    const defaultPort = isHttps ? 443 : 80;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : defaultPort;
    if (port !== 80 && port !== 443) {
      throw new Error(`Non-standard port ${port} is blocked for security.`);
    }

    if (isPrivateOrReservedHost(parsedUrl.hostname)) {
      throw new Error('Access to private or internal network addresses is blocked.');
    }

    // DNS Resolution & Validation of all returned IPs
    let resolvedAddresses: { address: string; family: number }[] = [];
    const literalFamily = net.isIP(parsedUrl.hostname);
    if (literalFamily) {
      resolvedAddresses = [{ address: parsedUrl.hostname, family: literalFamily }];
    } else {
      try {
        resolvedAddresses = await dns.lookup(parsedUrl.hostname, { all: true });
      } catch (err: any) {
        throw new Error(`Could not resolve host ${parsedUrl.hostname}: ${err.message}`);
      }
    }

    if (!resolvedAddresses || resolvedAddresses.length === 0) {
      throw new Error(`Could not resolve host ${parsedUrl.hostname}.`);
    }

    // SSRF Guard: Reject entire request immediately if ANY resolved address is private or reserved
    for (const entry of resolvedAddresses) {
      if (isPrivateOrReservedIp(entry.address)) {
        throw new Error('Host resolves to a private or reserved network address.');
      }
    }

    // Sort IP addresses: Prefer IPv4 first (for serverless environments with IPv4 egress), then IPv6
    const sortedAddresses = [
      ...resolvedAddresses.filter((a) => a.family === 4),
      ...resolvedAddresses.filter((a) => a.family === 6),
    ];

    const requestLib = isHttps ? https : http;
    let successfulResponse: {
      isRedirect: boolean;
      nextUrl?: string;
      body?: string;
      errorStatus?: number;
    } | null = null;
    let lastError: any = null;

    // Multi-IP fallback loop: Try valid public IP addresses in order until one connects
    for (const targetIpEntry of sortedAddresses) {
      try {
        const responseData = await new Promise<{
          isRedirect: boolean;
          nextUrl?: string;
          body?: string;
          errorStatus?: number;
        }>((resolve, reject) => {
          const timeout = setTimeout(() => {
            req.destroy(new Error('Request timed out while fetching the job posting.'));
          }, 8000);

          const options = {
            hostname: parsedUrl.hostname,
            port,
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
              Host: parsedUrl.host,
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (JobTrack/1.0 JobBot)',
              Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              Connection: 'close',
            },
            servername: parsedUrl.hostname, // Crucial for TLS SNI and certificate validation
            autoSelectFamily: false, // safeFetchHtml already handles IPv4 preference and multi-IP fallback
            lookup: (_hostname: string, optsOrCb: any, maybeCb?: any) => {
              // Pin to the validated IP to defeat DNS rebinding TOCTOU
              const cb = typeof optsOrCb === 'function' ? optsOrCb : maybeCb;
              const opts = typeof optsOrCb === 'object' && optsOrCb !== null ? optsOrCb : {};
              if (opts.all) {
                cb(null, [{ address: targetIpEntry.address, family: targetIpEntry.family }]);
              } else {
                cb(null, targetIpEntry.address, targetIpEntry.family);
              }
            },
          };

          const req = requestLib.request(options, (res) => {
            clearTimeout(timeout);

            // 1. Pre-validate Redirects before following
            if ([301, 302, 303, 307, 308].includes(res.statusCode || 0)) {
              const location = res.headers.location;
              res.resume();
              if (!location) {
                return reject(new Error('Redirect missing location header.'));
              }
              try {
                const redirectUrl = new URL(location, currentUrlStr);
                return resolve({ isRedirect: true, nextUrl: redirectUrl.toString() });
              } catch {
                return reject(new Error('Invalid redirect target URL.'));
              }
            }

            // 2. Handle HTTP Errors (e.g. 403 Forbidden, 404 Not Found, 429 Too Many Requests)
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
              res.resume();
              return resolve({ isRedirect: false, errorStatus: res.statusCode });
            }

            // 3. Verify Content-Type
            const contentType = res.headers['content-type'] || '';
            if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
              res.resume();
              return reject(new Error('The provided URL does not return an HTML web page.'));
            }

            // 4. Stream response and decompress if encoded
            let stream: NodeJS.ReadableStream = res;
            const contentEncoding = (res.headers['content-encoding'] || '').toLowerCase();
            if (contentEncoding === 'gzip') {
              stream = res.pipe(zlib.createGunzip());
            } else if (contentEncoding === 'deflate') {
              stream = res.pipe(zlib.createInflate());
            } else if (contentEncoding === 'br') {
              stream = res.pipe(zlib.createBrotliDecompress());
            }

            const chunks: Buffer[] = [];
            let totalBytes = 0;
            const MAX_BYTES = 3 * 1024 * 1024;

            stream.on('data', (chunk: Buffer) => {
              totalBytes += chunk.length;
              if (totalBytes > MAX_BYTES) {
                req.destroy(new Error('Page content exceeded the maximum allowed size (3MB).'));
                return;
              }
              chunks.push(chunk);
            });

            stream.on('end', () => {
              const body = Buffer.concat(chunks).toString('utf-8');
              resolve({ isRedirect: false, body });
            });

            stream.on('error', (err) => {
              reject(err);
            });
          });

          req.on('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });

          req.end();
        });

        successfulResponse = responseData;
        break; // Successfully connected and received response
      } catch (err: any) {
        lastError = err;
        console.warn(
          `[Smart Job Import] Connection to ${parsedUrl.hostname} via ${targetIpEntry.address} failed: ${err?.code || err?.message || 'Error'}. Trying next IP...`
        );
      }
    }

    if (!successfulResponse) {
      throw lastError || new Error(`Unable to establish connection to ${parsedUrl.hostname}.`);
    }

    if (successfulResponse.isRedirect && successfulResponse.nextUrl) {
      redirectCount++;
      currentUrlStr = successfulResponse.nextUrl;
      continue;
    }

    if (successfulResponse.errorStatus) {
      return { errorStatus: successfulResponse.errorStatus, finalUrl: currentUrlStr };
    }

    return { body: successfulResponse.body || '', finalUrl: currentUrlStr };
  }

  throw new Error('Too many redirects followed.');
}

// Decode basic HTML entities
export function decodeHtmlEntities(text: string): string {
  if (!text) return '';
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#x2F;/g, '/')
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Strip HTML tags and clean up whitespace
export function stripHtml(html: string): string {
  if (!html) return '';
  const noTags = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(noTags).replace(/\s+/g, ' ').trim();
}

// ============================================================================
// 2. Constants & Dictionaries
// ============================================================================

// Known company brand names mapped by domain slug or full domain
export const KNOWN_CAREER_DOMAINS: Record<string, string> = {
  'amazon.jobs': 'Amazon',
  'janestreet.com': 'Jane Street',
  'careers.google.com': 'Google',
  'google.com': 'Google',
  'careers.microsoft.com': 'Microsoft',
  'microsoft.com': 'Microsoft',
  'apple.com': 'Apple',
  'meta.com': 'Meta',
  'metacareers.com': 'Meta',
  'netflix.com': 'Netflix',
  'stripe.com': 'Stripe',
  'figma.com': 'Figma',
  'vercel.com': 'Vercel',
  'shopify.com': 'Shopify',
  'airbnb.com': 'Airbnb',
  'notion.so': 'Notion',
  'linear.app': 'Linear',
  'uber.com': 'Uber',
  'lyft.com': 'Lyft',
  'spotify.com': 'Spotify',
  'discord.com': 'Discord',
  'slack.com': 'Slack',
  'salesforce.com': 'Salesforce',
  'datadoghq.com': 'Datadog',
  'cloudflare.com': 'Cloudflare',
  'bloomberg.com': 'Bloomberg',
  'citadel.com': 'Citadel',
  'twosigma.com': 'Two Sigma',
  'goldmansachs.com': 'Goldman Sachs',
  'morganstanley.com': 'Morgan Stanley',
  'jpmorgan.com': 'JPMorgan Chase',
  'dropbox.com': 'Dropbox',
  'coinbase.com': 'Coinbase',
  'palantir.com': 'Palantir',
  'nvidia.com': 'NVIDIA',
  'adobe.com': 'Adobe',
  'reddit.com': 'Reddit',
  'pinterest.com': 'Pinterest',
  'doordash.com': 'DoorDash',
  'instacart.com': 'Instacart',
  'snap.com': 'Snap',
  'tiktok.com': 'TikTok',
  'openai.com': 'OpenAI',
  'anthropic.com': 'Anthropic',
};

// Generic Applicant Tracking Systems (ATS) and Job Boards
// These should NEVER be identified as the employer!
export const GENERIC_JOB_BOARDS = new Set([
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'monster.com',
  'ziprecruiter.com',
  'greenhouse.io',
  'boards.greenhouse.io',
  'lever.co',
  'jobs.lever.co',
  'workday.com',
  'myworkdayjobs.com',
  'ashbyhq.com',
  'jobs.ashbyhq.com',
  'smartrecruiters.com',
  'jobvite.com',
  'icims.com',
  'taleo.net',
  'bamboohr.com',
  'workable.com',
  'rippling.com',
  'dice.com',
  'simplyhired.com',
  'builtin.com',
  'wellfound.com',
  'angellist.com',
  'handshake.com',
  'joinhandshake.com',
]);

// Well-known locations for disambiguating title tokens
const KNOWN_LOCATION_TOKENS = new Set([
  'new york',
  'new york city',
  'nyc',
  'ny',
  'san francisco',
  'sf',
  'bay area',
  'mountain view',
  'sunnyvale',
  'palo alto',
  'seattle',
  'bellevue',
  'redmond',
  'wa',
  'arlington',
  'austin',
  'boston',
  'cambridge',
  'chicago',
  'los angeles',
  'la',
  'san diego',
  'london',
  'uk',
  'remote',
  'hybrid',
  'on-site',
  'onsite',
  'toronto',
  'vancouver',
  'paris',
  'berlin',
  'amsterdam',
  'dublin',
  'singapore',
  'tokyo',
  'sydney',
  'hong kong',
]);

// ============================================================================
// 3. Independent Field Extractors
// ============================================================================

export function cleanCompanyName(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let clean = decodeHtmlEntities(raw).trim();

  // Strip trailing domain suffixes like "Amazon.jobs" -> "Amazon"
  clean = clean.replace(/\.(?:jobs|com|io|co|net|org)$/i, '');

  const lower = clean.toLowerCase();
  if (
    !clean ||
    lower === 'jobs' ||
    lower === 'careers' ||
    lower === 'career' ||
    lower === 'job' ||
    lower === 'hiring' ||
    lower.includes('job board') ||
    lower.includes('applicant tracking')
  ) {
    return null;
  }

  return clean.trim();
}

export function getCompanyFromDomain(parsedUrl: URL): string | null {
  const hostname = parsedUrl.hostname.toLowerCase().replace(/^www\./, '');

  // 1. Direct match in dictionary
  if (KNOWN_CAREER_DOMAINS[hostname]) {
    return KNOWN_CAREER_DOMAINS[hostname];
  }

  // 2. Check parent domains in dictionary
  for (const [domain, name] of Object.entries(KNOWN_CAREER_DOMAINS)) {
    if (hostname === domain || hostname.endsWith('.' + domain)) {
      return name;
    }
  }

  // 3. Exclude generic job boards
  for (const board of GENERIC_JOB_BOARDS) {
    if (hostname === board || hostname.endsWith('.' + board)) {
      return null;
    }
  }

  // 4. Fallback for custom .jobs domains (e.g. netflix.jobs -> Netflix)
  if (hostname.endsWith('.jobs')) {
    const prefix = hostname.replace(/\.jobs$/, '');
    if (prefix && !prefix.includes('.')) {
      return prefix.charAt(0).toUpperCase() + prefix.slice(1);
    }
  }

  // 5. Clean first label of corporate domain (e.g. janestreet.com -> Jane Street if formatted, or Janestreet)
  const parts = hostname.split('.');
  if (parts.length >= 2) {
    const base = parts[0];
    if (KNOWN_CAREER_DOMAINS[base]) {
      return KNOWN_CAREER_DOMAINS[base];
    }
    // Generic words to avoid
    if (!['jobs', 'careers', 'apply', 'join', 'work', 'recruiting'].includes(base)) {
      return base.charAt(0).toUpperCase() + base.slice(1);
    }
  }

  return null;
}

// Dissect full page titles like "Software Engineer Internship, New York :: Jane Street"
export function parseDissectedTitle(rawTitle: string): {
  position?: string;
  company?: string;
  location?: string;
} {
  const clean = decodeHtmlEntities(rawTitle).trim();
  const result: { position?: string; company?: string; location?: string } = {};

  // Check double colon "::" separator (e.g. "Software Engineer Internship, New York :: Jane Street")
  if (clean.includes(' :: ')) {
    const parts = clean.split(' :: ').map((p) => p.trim());
    if (parts.length === 2) {
      result.company = cleanCompanyName(parts[1]) || undefined;

      // Inspect left part: "Software Engineer Internship, New York"
      const left = parts[0];
      if (left.includes(',')) {
        const subparts = left.split(',').map((s) => s.trim());
        const lastSub = subparts[subparts.length - 1].toLowerCase();
        if (KNOWN_LOCATION_TOKENS.has(lastSub)) {
          result.location = subparts[subparts.length - 1];
          result.position = subparts.slice(0, subparts.length - 1).join(', ');
        } else {
          result.position = left;
        }
      } else {
        result.position = left;
      }
      return result;
    }
  }

  // Check pipe "|" separator (e.g. "Title - Cohort | Company.jobs")
  if (clean.includes(' | ')) {
    const parts = clean.split(' | ').map((p) => p.trim());
    const right = parts[parts.length - 1];
    const compCandidate = cleanCompanyName(right);
    if (compCandidate) {
      result.company = compCandidate;
    }
    // Left part is position
    let left = parts.slice(0, parts.length - 1).join(' | ');
    // Remove Job ID if present
    left = left.replace(/\s*[-–]\s*Job ID:\s*\d+.*$/i, '').trim();
    result.position = left;
    return result;
  }

  // Default: retain full title
  let safeTitle = clean.replace(/\s*\|\s*[^|]+$/, '');
  safeTitle = safeTitle.replace(/\s*[-–]\s*Job ID:\s*\d+.*$/i, '');
  result.position = safeTitle.trim();

  return result;
}

// Extract company name following the strict hierarchy
export function extractCompany(
  jobPosting: any,
  html: string,
  metaMap: Record<string, string>,
  parsedUrl: URL,
  dissectedTitle: { company?: string }
): string | null {
  // 1. Structured JSON-LD metadata: hiringOrganization.name
  if (jobPosting?.hiringOrganization) {
    const org = jobPosting.hiringOrganization;
    const name = typeof org === 'string' ? org : org.name;
    const clean = cleanCompanyName(name);
    if (clean) return clean;
  }

  // 2. Visible page employer/legal entity indicators (e.g. "Job ID: 10552937 | Amazon.com Services LLC")
  const llcMatch = html.match(/class=["']meta["'][^>]*>[^<]*\|\s*([A-Za-z0-9.,\s&]+(?:LLC|Inc\.?|Corp\.?|Corporation|Company|Ltd\.?))/i);
  if (llcMatch && llcMatch[1]) {
    const fullOrg = llcMatch[1].trim();
    if (fullOrg.toLowerCase().startsWith('amazon')) return 'Amazon';
    const clean = cleanCompanyName(fullOrg);
    if (clean) return clean;
  }

  // 3. EEO footnote indication (e.g. "<p>Jane Street is an Equal Opportunity Employer</p>")
  const eeoMatch = html.match(/<div class=["']eeo-footnote["'][^>]*>\s*<p>([^<]+?)\s+is an Equal Opportunity/i);
  if (eeoMatch && eeoMatch[1]) {
    const clean = cleanCompanyName(eeoMatch[1]);
    if (clean) return clean;
  }

  // 4. Dissected title company (e.g. from "Title :: Jane Street")
  if (dissectedTitle.company) {
    const clean = cleanCompanyName(dissectedTitle.company);
    if (clean) return clean;
  }

  // 5. OpenGraph and page metadata (og:site_name, etc.)
  const siteName = metaMap['og:site_name'] || metaMap['application-name'] || metaMap['author'];
  if (siteName) {
    const clean = cleanCompanyName(siteName);
    if (clean) return clean;
  }

  // 6. Verified company-owned career domain
  const domainCompany = getCompanyFromDomain(parsedUrl);
  if (domainCompany) {
    return domainCompany;
  }

  return null;
}

// Extract job title following the strict hierarchy
export function extractJobTitle(
  jobPosting: any,
  html: string,
  metaMap: Record<string, string>,
  dissectedTitle: { position?: string }
): string | null {
  // 1. Structured JSON-LD job title
  if (jobPosting?.title) {
    const title = decodeHtmlEntities(jobPosting.title).trim();
    if (title) return title;
  }

  // 2. Visible on-page heading (e.g. <h4 class="page-heading">Software Engineer Internship, May-August</h4>)
  const headingRegexes = [
    /<h[1-4][^>]*class=["'][^"']*(?:page-heading|job-title|position-title|posting-title|job-heading)[^"']*["'][^>]*>([\s\S]*?)<\/h[1-4]>/i,
    /<h1[^>]*class=["'][^"']*title[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i,
    /<h1[^>]*>([\s\S]*?)<\/h1>/i,
  ];

  for (const regex of headingRegexes) {
    const match = html.match(regex);
    if (match && match[1]) {
      const clean = stripHtml(match[1]);
      if (clean && clean.length > 3 && clean.length < 150) {
        return clean;
      }
    }
  }

  // 3. OpenGraph / Twitter meta tags
  const ogTitle = metaMap['og:title'] || metaMap['twitter:title'];
  if (ogTitle) {
    const dissected = parseDissectedTitle(ogTitle);
    if (dissected.position) return dissected.position;
  }

  // 4. HTML <title> tag via parser
  if (dissectedTitle.position) {
    return dissectedTitle.position;
  }

  return null;
}

// Extract location following the strict hierarchy
export function extractLocation(
  jobPosting: any,
  html: string,
  dissectedTitle: { location?: string }
): string | null {
  // 1. Structured JSON-LD location
  if (jobPosting?.jobLocation) {
    const loc = jobPosting.jobLocation;
    if (typeof loc === 'string') return loc.trim();
    if (Array.isArray(loc)) {
      const parts = loc
        .map((l) => {
          const addr = l.address || l;
          return [addr.addressLocality, addr.addressRegion, addr.addressCountry?.name || addr.addressCountry]
            .filter(Boolean)
            .join(', ');
        })
        .filter(Boolean);
      if (parts.length > 0) return parts.join(' | ');
    }
    const address = loc.address || loc;
    const parts = [
      address.addressLocality,
      address.addressRegion,
      address.addressCountry?.name || address.addressCountry,
    ].filter(Boolean);
    if (parts.length > 0) return parts.join(', ');
  }

  // 2. Labeled on-page location field (e.g. Jane Street: <p class="label">LOCATION</p><p class="name city">NYC</p>)
  const labeledLocMatch = html.match(
    /<p[^>]*class=["']label["'][^>]*>\s*LOCATION\s*<\/p>\s*<p[^>]*class=["'][^"']*["'][^>]*>\s*([^<]+)\s*<\/p>/i
  );
  if (labeledLocMatch && labeledLocMatch[1]) {
    return decodeHtmlEntities(labeledLocMatch[1].trim());
  }

  // 3. Location lists (e.g. Amazon: association-content location list)
  const locListMatch = html.match(
    /aria-label=["']location["'][^>]*>[\s\S]*?<ul[^>]*class=["']association-content["'][^>]*>([\s\S]*?)<\/ul>/i
  );
  if (locListMatch && locListMatch[1]) {
    const liMatches = [...locListMatch[1].matchAll(/<li>([^<]+)<\/li>/gi)].map((m) => m[1].trim());
    if (liMatches.length > 0) {
      return liMatches.join(' | ');
    }
  }

  // 4. Location from dissected title (e.g. "Software Engineer Internship, New York :: Jane Street" -> "New York")
  if (dissectedTitle.location) {
    return dissectedTitle.location;
  }

  return null;
}

// Extract salary/compensation following the strict hierarchy
export function extractSalary(jobPosting: any, html: string): string | null {
  // 1. Structured JSON-LD MonetaryAmount
  const baseSalary = jobPosting?.baseSalary || jobPosting?.estimatedSalary;
  if (baseSalary) {
    const val = baseSalary.value || baseSalary;
    const currency = baseSalary.currency || val.currency || '$';
    const unitText = baseSalary.unitText || val.unitText || '';
    const cleanCurrency = currency === 'USD' ? '$' : currency + ' ';
    const cleanUnit = unitText ? ` / ${unitText.toLowerCase()}` : '';

    if (val.minValue && val.maxValue) {
      const min = typeof val.minValue === 'number' ? val.minValue.toLocaleString() : val.minValue;
      const max = typeof val.maxValue === 'number' ? val.maxValue.toLocaleString() : val.maxValue;
      return `${cleanCurrency}${min} - ${cleanCurrency}${max}${cleanUnit}`.trim();
    }
    if (val.value || typeof val === 'number') {
      const num = typeof (val.value ?? val) === 'number' ? (val.value ?? val).toLocaleString() : val.value ?? val;
      return `${cleanCurrency}${num}${cleanUnit}`.trim();
    }
  }

  // 2. Visible labeled salary disclosure element (e.g. Jane Street: <p class="salary-range-disclosure">Base salary is $300,000.</p>)
  const disclosureMatch = html.match(/class=["']salary-range-disclosure["'][^>]*>([^<]+)<\/p>/i);
  if (disclosureMatch && disclosureMatch[1]) {
    const text = disclosureMatch[1].trim();
    const clean = text.replace(/\.$/, ''); // strip trailing period
    return clean;
  }

  // 3. Location-specific compensation (e.g. Amazon: "Arlington, VA, USA - 109,395.00 USD Annually")
  const locationSalaryRegex = /(?:([A-Za-z\s,]+)\s*[-–]\s*)?\$?([0-9]{2,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)\s*(?:USD)?\s*(Annually|Hourly|Per Year|\/yr|\/year|\/hr)/gi;
  const matches = [...html.matchAll(locationSalaryRegex)];
  if (matches.length > 0) {
    const amounts = new Set<string>();
    const locations: string[] = [];
    let period = 'annually';

    for (const m of matches) {
      const loc = m[1]?.trim();
      const amt = m[2]?.trim();
      const p = m[3]?.trim();
      if (amt) {
        amounts.add('$' + amt.replace(/\.00$/, ''));
      }
      if (loc && (loc.includes('Seattle') || loc.includes('Arlington') || loc.includes('VA') || loc.includes('WA') || loc.includes('NY') || loc.includes('CA'))) {
        locations.push(loc.replace(/\s*,\s*USA$/i, ''));
      }
      if (p) period = p.toLowerCase();
    }

    if (amounts.size > 0) {
      const amtStr = [...amounts].join(' - ');
      if (locations.length > 0) {
        return `${amtStr} ${period} (${locations.join(' & ')})`;
      }
      return `${amtStr} ${period}`;
    }
  }

  // 4. Standard salary range regex: "$120,000 - $160,000 / year"
  const standardSalaryRegex = /(?:(\$|USD\s*|€|£)\s*(\d{2,3}(?:,\d{3})*(?:\.\d{2})?(?:[kK])?)\s*(?:[-–]|to)\s*(\$|USD\s*|€|£)?\s*(\d{2,3}(?:,\d{3})*(?:\.\d{2})?(?:[kK])?)(?:\s*(?:\/|\s+per\s+)?(yr|year|annum|hr|hour|mo|month|annually))?)/i;
  const stdMatch = html.match(standardSalaryRegex);
  if (stdMatch) {
    return stdMatch[0].trim();
  }

  // Never invent missing salary
  return null;
}

// Extract full job description text
export function extractDescription(jobPosting: any, html: string, metaMap: Record<string, string>): string | null {
  // 1. Structured JSON-LD description
  if (jobPosting?.description) {
    const desc = stripHtml(jobPosting.description);
    if (desc) return desc;
  }

  // 2. Visible job-content body
  const contentRegexes = [
    /<div[^>]*class=["'][^"']*job-content[^"']*["'][^>]*>([\s\S]*?)<div[^>]*class=["']footnotes/i,
    /<div[^>]*class=["'][^"']*(?:job-description|description-section|job-details-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<section[^>]*class=["'][^"']*(?:description|job-description)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
  ];

  for (const regex of contentRegexes) {
    const match = html.match(regex);
    if (match && match[1]) {
      const clean = stripHtml(match[1]);
      if (clean && clean.length > 20) return clean;
    }
  }

  // 3. Meta description fallback
  const rawDesc = metaMap['og:description'] || metaMap['description'] || metaMap['twitter:description'];
  if (rawDesc) {
    const clean = stripHtml(rawDesc);
    if (clean) return clean;
  }

  return null;
}

// Helper to find JobPosting in JSON-LD structure
function findJobPosting(data: any): any {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findJobPosting(item);
      if (found) return found;
    }
  } else if (typeof data === 'object') {
    if (data['@type'] === 'JobPosting') return data;
    if (data['@graph'] && Array.isArray(data['@graph'])) {
      return findJobPosting(data['@graph']);
    }
  }
  return null;
}

// ============================================================================
// 4. Main Serverless Request Handler
// ============================================================================

function getSupabaseCredentials(): { url: string; anonKey: string } {
  let url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '').trim();
  let anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();

  if (!url || !anonKey) {
    try {
      const envPath = path.resolve(process.cwd(), '.env.local');
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const eq = trimmed.indexOf('=');
          if (eq !== -1) {
            const k = trimmed.slice(0, eq).trim();
            const v = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, '');
            if (k === 'VITE_SUPABASE_URL' && !url) url = v;
            if (k === 'VITE_SUPABASE_ANON_KEY' && !anonKey) anonKey = v;
          }
        }
      }
    } catch {
      // Ignore reading error
    }
  }

  return {
    url: url.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, ''),
    anonKey,
  };
}

// ============================================================================
// 4. Main Serverless Request Handler
// ============================================================================

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Restricted CORS headers (no wildcards)
  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://jobtrack-xi-indol.vercel.app',
    /^https:\/\/jobtrack[a-z0-9-]*\.vercel\.app$/,
    /^http:\/\/localhost:\d+$/,
    /^http:\/\/127\.0\.0\.1:\d+$/,
  ];

  let isAllowedOrigin = false;
  if (typeof origin === 'string') {
    isAllowedOrigin = allowedOrigins.some((allowed) =>
      typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
    );
  }

  if (isAllowedOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  // 2. Authentication Verification
  const authHeader = req.headers.authorization || (req.headers as any).Authorization;
  const token =
    typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

  if (!token) {
    return res.status(401).json({
      error: 'Authentication required. Please sign in to import job details.',
    });
  }

  const { url: supabaseUrl, anonKey: supabaseAnonKey } = getSupabaseCredentials();

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    supabaseUrl.includes('your-project-id') ||
    supabaseAnonKey.includes('your-anon-public-key')
  ) {
    console.error('[Smart Job Import] Supabase authentication credentials are not configured in environment.');
    return res.status(500).json({
      error: 'Authentication service is not properly configured on the server.',
    });
  }

  let userId: string;
  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error: authError } = await supabase.auth.getUser(token);
    if (authError || !data?.user) {
      return res.status(401).json({
        error: 'Invalid or expired session. Please sign in again.',
      });
    }
    userId = data.user.id;
  } catch (err: any) {
    console.error('[Smart Job Import] Supabase token verification failed:', err?.message || 'Unknown auth error');
    return res.status(401).json({
      error: 'Authentication verification failed. Please sign in again.',
    });
  }

  // 3. In-memory Rate Limiting per User/IP
  const clientIp = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1')
    .toString()
    .split(',')[0]
    .trim();
  const rateLimitKey = `${userId}:${clientIp}`;
  const rateLimit = checkRateLimit(rateLimitKey);

  res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW.toString());
  res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());

  if (!rateLimit.allowed) {
    if (rateLimit.retryAfter) {
      res.setHeader('Retry-After', rateLimit.retryAfter.toString());
    }
    return res.status(429).json({
      error: 'Import rate limit exceeded. Please wait a minute before importing another job posting.',
    });
  }

  // 4. Input Validation & Safe Fetching
  try {
    const { url } = req.body || {};

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'A valid URL is required.' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.trim());
    } catch {
      return res.status(400).json({ error: 'Invalid URL format.' });
    }

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return res.status(400).json({ error: 'Only HTTP and HTTPS URLs are supported.' });
    }

    if (parsedUrl.username || parsedUrl.password) {
      return res.status(400).json({ error: 'URLs with embedded credentials are not allowed.' });
    }

    const defaultPort = parsedUrl.protocol === 'https:' ? 443 : 80;
    const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : defaultPort;
    if (port !== 80 && port !== 443) {
      return res.status(400).json({ error: `Non-standard port ${port} is blocked for security.` });
    }

    // Perform robust SSRF-safe fetch with IP pinning, multi-IP fallback, and redirect validation
    let fetchResult: SafeFetchResult;
    try {
      fetchResult = await safeFetchHtml(parsedUrl.toString());
    } catch (fetchErr: any) {
      const msg = fetchErr?.message || 'Unable to connect to website.';
      console.error(`[Smart Job Import] Outbound fetch error for ${parsedUrl.hostname}: ${msg}`);
      if (msg.includes('timed out')) {
        return res.status(504).json({ error: 'Request timed out while fetching the job posting.' });
      }
      if (
        msg.includes('blocked') ||
        msg.includes('private or reserved') ||
        msg.includes('credentials') ||
        msg.includes('Non-standard port') ||
        msg.includes('Only HTTP and HTTPS')
      ) {
        return res.status(400).json({ error: msg });
      }
      return res.status(502).json({
        error: `Unable to access the requested job posting (${msg}). The website may require login or blocked automated access.`,
      });
    }

    if (fetchResult.errorStatus) {
      console.warn(`[Smart Job Import] Remote server ${parsedUrl.hostname} returned HTTP ${fetchResult.errorStatus}`);
      return res.status(fetchResult.errorStatus).json({
        error: `Website responded with HTTP status ${fetchResult.errorStatus}. It may require login or blocked automated access.`,
      });
    }

    const html = fetchResult.body || '';
    const finalParsedUrl = new URL(fetchResult.finalUrl || parsedUrl.toString());

    // 5. Parse Structured Data JSON-LD
    const jsonLdRegex = /<script\s+[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let jsonLdMatch;
    let jobPosting: any = null;

    while ((jsonLdMatch = jsonLdRegex.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(jsonLdMatch[1].trim());
        const found = findJobPosting(parsed);
        if (found) {
          jobPosting = found;
          break;
        }
      } catch {
        // continue search
      }
    }

    // 6. Parse Meta Map
    const metaRegex = /<meta\s+[^>]*(?:name|property|id)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
    const metaRegexAlt = /<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property|id)=["']([^"']+)["'][^>]*>/gi;
    const metaMap: Record<string, string> = {};

    let mMatch;
    while ((mMatch = metaRegex.exec(html)) !== null) {
      metaMap[mMatch[1].toLowerCase()] = decodeHtmlEntities(mMatch[2].trim());
    }
    while ((mMatch = metaRegexAlt.exec(html)) !== null) {
      metaMap[mMatch[2].toLowerCase()] = decodeHtmlEntities(mMatch[1].trim());
    }

    // 7. Dissect HTML <title> tag
    const titleTagMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    const rawTitleTag = titleTagMatch ? titleTagMatch[1] : '';
    const dissectedTitle = parseDissectedTitle(rawTitleTag);

    // 8. Extract fields independently via hierarchy
    const company = extractCompany(jobPosting, html, metaMap, finalParsedUrl, dissectedTitle);
    const position = extractJobTitle(jobPosting, html, metaMap, dissectedTitle);
    const location = extractLocation(jobPosting, html, dissectedTitle);
    const salary = extractSalary(jobPosting, html);
    const description = extractDescription(jobPosting, html, metaMap);

    let employmentType: string | null = null;
    if (jobPosting?.employmentType) {
      const raw = Array.isArray(jobPosting.employmentType)
        ? jobPosting.employmentType.join(', ')
        : String(jobPosting.employmentType);
      employmentType = raw.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase());
    }

    return res.status(200).json({
      success: true,
      data: {
        company: company || '',
        position: position || '',
        location: location || '',
        salary: salary || '',
        description: description || '',
        employmentType: employmentType || '',
        url: finalParsedUrl.toString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: 'An unexpected error occurred while parsing the job posting.',
    });
  }
}
