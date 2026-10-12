import type { VercelRequest, VercelResponse } from '@vercel/node';

// Private IP ranges and loopback check for SSRF prevention
function isPrivateOrReservedHost(hostname: string): boolean {
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
    // 169.254.0.0/16 (Link-local / AWS instance metadata)
    if (octets[0] === 169 && octets[1] === 254) return true;
    // 0.0.0.0/8
    if (octets[0] === 0) return true;
  }

  return false;
}

// Decode basic HTML entities
function decodeHtmlEntities(text: string): string {
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
function stripHtml(html: string): string {
  if (!html) return '';
  const noTags = html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ');
  return decodeHtmlEntities(noTags).replace(/\s+/g, ' ').trim();
}

// Format salary from JSON-LD MonetaryAmount
function formatJsonLdSalary(baseSalary: any): string | null {
  if (!baseSalary) return null;
  const value = baseSalary.value || baseSalary;
  const currency = baseSalary.currency || value.currency || '$';
  const unitText = baseSalary.unitText || value.unitText || '';

  const cleanCurrency = currency === 'USD' ? '$' : currency + ' ';
  const cleanUnit = unitText ? ` / ${unitText.toLowerCase()}` : '';

  if (typeof value === 'number' || typeof value === 'string') {
    const num = typeof value === 'number' ? value.toLocaleString() : value;
    return `${cleanCurrency}${num}${cleanUnit}`.trim();
  }

  if (value.minValue && value.maxValue) {
    const min = typeof value.minValue === 'number' ? value.minValue.toLocaleString() : value.minValue;
    const max = typeof value.maxValue === 'number' ? value.maxValue.toLocaleString() : value.maxValue;
    return `${cleanCurrency}${min} - ${cleanCurrency}${max}${cleanUnit}`.trim();
  }

  if (value.value) {
    const val = typeof value.value === 'number' ? value.value.toLocaleString() : value.value;
    return `${cleanCurrency}${val}${cleanUnit}`.trim();
  }

  return null;
}

// Format location from JSON-LD PostalAddress
function formatJsonLdLocation(location: any): string | null {
  if (!location) return null;

  if (typeof location === 'string') return location.trim();

  // If array of locations
  if (Array.isArray(location)) {
    return formatJsonLdLocation(location[0]);
  }

  const address = location.address || location;
  if (typeof address === 'string') return address.trim();

  const parts = [
    address.addressLocality,
    address.addressRegion,
    address.addressCountry?.name || address.addressCountry,
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(', ');

  if (location.name) return location.name.trim();

  return null;
}

// Helper to find JobPosting within JSON-LD structure
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

// Fallback HTML extractor using OpenGraph / Meta tags / title
function extractFromHtmlFallback(html: string) {
  const result: {
    company?: string;
    position?: string;
    description?: string;
    location?: string;
    salary?: string;
    employmentType?: string;
  } = {};

  // Extract meta tags: <meta (property|name)="xyz" content="abc">
  const metaRegex = /<meta\s+[^>]*(?:name|property)=["']([^"']+)["'][^>]*content=["']([^"']*)["'][^>]*>/gi;
  const metaRegexAlt = /<meta\s+[^>]*content=["']([^"']*)["'][^>]*(?:name|property)=["']([^"']+)["'][^>]*>/gi;

  const metaMap: Record<string, string> = {};

  let match;
  while ((match = metaRegex.exec(html)) !== null) {
    metaMap[match[1].toLowerCase()] = decodeHtmlEntities(match[2].trim());
  }
  while ((match = metaRegexAlt.exec(html)) !== null) {
    metaMap[match[2].toLowerCase()] = decodeHtmlEntities(match[1].trim());
  }

  // Position / Title
  const ogTitle = metaMap['og:title'] || metaMap['twitter:title'];
  if (ogTitle) {
    // Often "Senior Engineer at Acme Corp" or "Acme Corp hiring Senior Engineer" or "Senior Engineer - Acme Corp"
    if (ogTitle.includes(' at ')) {
      const parts = ogTitle.split(' at ');
      result.position = parts[0].trim();
      result.company = parts[1].replace(/\s*[-|·].*$/, '').trim();
    } else if (ogTitle.includes(' - ')) {
      const parts = ogTitle.split(' - ');
      result.position = parts[0].trim();
      result.company = parts[parts.length - 1].trim();
    } else if (ogTitle.includes(' | ')) {
      const parts = ogTitle.split(' | ');
      result.position = parts[0].trim();
      result.company = parts[parts.length - 1].trim();
    } else {
      result.position = ogTitle.trim();
    }
  }

  // Check <title> tag if position not set
  if (!result.position) {
    const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(html);
    if (titleMatch) {
      const rawTitle = decodeHtmlEntities(titleMatch[1].trim());
      if (rawTitle.includes(' at ')) {
        const parts = rawTitle.split(' at ');
        result.position = parts[0].trim();
        result.company = parts[1].replace(/\s*[-|·].*$/, '').trim();
      } else if (rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        result.position = parts[0].trim();
        result.company = parts[parts.length - 1].trim();
      } else {
        result.position = rawTitle;
      }
    }
  }

  // Company from meta
  if (!result.company) {
    result.company =
      metaMap['og:site_name'] ||
      metaMap['application-name'] ||
      metaMap['twitter:site'] ||
      metaMap['author'];
  }

  // Description
  const rawDesc = metaMap['og:description'] || metaMap['description'] || metaMap['twitter:description'];
  if (rawDesc) {
    result.description = stripHtml(rawDesc);
  }

  // Simple regex for salary pattern if mentioned in description
  const salaryRegex = /(?:(\$|USD\s*|€|£)\s*(\d{2,3}(?:,\d{3})*(?:\.\d{2})?(?:[kK])?)\s*(?:-|to)\s*(\$|USD\s*|€|£)?\s*(\d{2,3}(?:,\d{3})*(?:\.\d{2})?(?:[kK])?)(?:\s*(?:\/|\s+per\s+)?(yr|year|annum|hr|hour|mo|month))?)/i;
  if (result.description) {
    const salaryMatch = result.description.match(salaryRegex);
    if (salaryMatch) {
      result.salary = salaryMatch[0].trim();
    }
  }

  return result;
}

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

    // Fetch the URL with timeout, size limit and safe redirect checking
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 9000); // 9 second timeout

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

    // Ensure content is HTML
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
      return res.status(400).json({ error: 'The provided URL does not return an HTML web page.' });
    }

    // Read response with size limit (max 3MB)
    const reader = response.body?.getReader();
    let receivedLength = 0;
    const chunks: Uint8Array[] = [];
    const MAX_BYTES = 3 * 1024 * 1024; // 3MB

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

    // 1. Structured Data Extraction: Look for schema.org JobPosting
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
        // Continue searching other json-ld blocks
      }
    }

    // Initialize extracted data
    let company: string | null = null;
    let position: string | null = null;
    let location: string | null = null;
    let salary: string | null = null;
    let description: string | null = null;
    let employmentType: string | null = null;

    if (jobPosting) {
      // Extract from structured JobPosting
      position = jobPosting.title ? decodeHtmlEntities(jobPosting.title).trim() : null;

      if (jobPosting.hiringOrganization) {
        if (typeof jobPosting.hiringOrganization === 'string') {
          company = decodeHtmlEntities(jobPosting.hiringOrganization).trim();
        } else if (jobPosting.hiringOrganization.name) {
          company = decodeHtmlEntities(jobPosting.hiringOrganization.name).trim();
        }
      }

      location = formatJsonLdLocation(jobPosting.jobLocation);
      salary = formatJsonLdSalary(jobPosting.baseSalary || jobPosting.estimatedSalary);

      if (jobPosting.description) {
        description = stripHtml(jobPosting.description);
      }

      if (jobPosting.employmentType) {
        if (Array.isArray(jobPosting.employmentType)) {
          employmentType = jobPosting.employmentType.join(', ');
        } else {
          employmentType = String(jobPosting.employmentType);
        }
      }
    }

    // 2. Fallback to HTML OpenGraph/meta tags for any missing fields
    const fallback = extractFromHtmlFallback(html);

    if (!position && fallback.position) position = fallback.position;
    if (!company && fallback.company) company = fallback.company;
    if (!description && fallback.description) description = fallback.description;
    if (!location && fallback.location) location = fallback.location;
    if (!salary && fallback.salary) salary = fallback.salary;
    if (!employmentType && fallback.employmentType) employmentType = fallback.employmentType;

    // Normalization & sanity checks
    if (employmentType) {
      employmentType = employmentType.replace(/_/g, ' ').toLowerCase();
      // Capitalize words
      employmentType = employmentType.replace(/\b\w/g, (c) => c.toUpperCase());
    }

    // If company is still empty, fallback to domain name
    if (!company) {
      const domain = parsedUrl.hostname.replace(/^www\./, '');
      const parts = domain.split('.');
      if (parts.length > 1) {
        company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      }
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
