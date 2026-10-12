import type { VercelRequest, VercelResponse } from '@vercel/node';

// ============================================================================
// 1. SSRF & Security Protections
// ============================================================================

export function isPrivateOrReservedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (
    lower === 'localhost' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal') ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1'
  ) {
    return true;
  }

  // IPv4 regex check
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = lower.match(ipv4Regex);
  if (match) {
    const octets = match.slice(1, 5).map(Number);
    if (octets.some((n) => n < 0 || n > 255)) return true;

    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) return true;
    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) return true;
    // 172.16.0.0/12 (Private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) return true;
    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) return true;
    // 169.254.0.0/16 (Link-local / AWS metadata)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 0.0.0.0/8
    if (octets[0] === 0) return true;
  }

  return false;
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

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

    if (isPrivateOrReservedHost(parsedUrl.hostname)) {
      return res.status(400).json({ error: 'Access to private or internal network addresses is blocked.' });
    }

    // Fetch with timeout, user agent, safe redirect checking, and 3MB size limit
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000);

    let response: Response;
    try {
      response = await fetch(parsedUrl.toString(), {
        signal: controller.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 (JobTrack/1.0 JobBot)',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        return res.status(504).json({ error: 'Request timed out while fetching the job posting.' });
      }
      return res.status(502).json({ error: `Unable to connect to the requested website: ${fetchErr.message}` });
    } finally {
      clearTimeout(timeout);
    }

    // Check redirect target
    if (response.url) {
      const redirectUrl = new URL(response.url);
      if (isPrivateOrReservedHost(redirectUrl.hostname)) {
        return res.status(400).json({ error: 'Redirect to private network address blocked.' });
      }
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: `Website responded with HTTP status ${response.status} (${response.statusText}). It may require login or blocked the request.`,
      });
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(400).json({ error: 'The provided URL does not return an HTML web page.' });
    }

    // Read response with 3MB safety limit
    const reader = response.body?.getReader();
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    const MAX_BYTES = 3 * 1024 * 1024;

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          receivedLength += value.length;
          if (receivedLength > MAX_BYTES) {
            reader.cancel();
            break;
          }
          chunks.push(value);
        }
      }
    }

    const fullBuffer = new Uint8Array(receivedLength);
    let offset = 0;
    for (const chunk of chunks) {
      fullBuffer.set(chunk, offset);
      offset += chunk.length;
    }
    const html = new TextDecoder('utf-8').decode(fullBuffer);

    // 1. Structured Data JSON-LD
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

    // 2. Parse Meta Map
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

    // 3. Dissect HTML <title> tag
    const titleTagMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    const rawTitleTag = titleTagMatch ? titleTagMatch[1] : '';
    const dissectedTitle = parseDissectedTitle(rawTitleTag);

    // 4. Extract fields independently via hierarchy
    const company = extractCompany(jobPosting, html, metaMap, parsedUrl, dissectedTitle);
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
        url: parsedUrl.toString(),
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: `Unexpected error parsing job posting: ${err.message || 'Unknown error'}`,
    });
  }
}
