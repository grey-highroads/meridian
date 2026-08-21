import dns from "node:dns/promises";

function isPrivateAddress(address) {
  const normalized = String(address).toLowerCase();
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe80:")) return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  return (
    parts[0] === 10 ||
    parts[0] === 127 ||
    parts[0] === 0 ||
    (parts[0] === 169 && parts[1] === 254) ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168)
  );
}

export async function assertSafeRemoteUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("One of the source URLs is invalid.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Source URLs must use http or https.");
  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".local")) throw new Error("Local network URLs cannot be read as sources.");
  const records = await dns.lookup(hostname, { all: true });
  if (!records.length || records.some((record) => isPrivateAddress(record.address))) throw new Error("Private network URLs cannot be read as sources.");
  return url;
}

// Browser-like headers. Many CDNs and bot-protection layers serve different
// content (or block entirely) based on User-Agent and Accept headers.
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "identity",
  "Cache-Control": "no-cache",
};

// Known challenge-page signatures. When the extracted text matches one of
// these patterns and is very short, the page is likely a bot gate, not the
// real content.
const CHALLENGE_SIGNATURES = [
  /checking your browser/i,
  /please enable javascript/i,
  /just a moment/i,
  /access denied/i,
  /pardon our interruption/i,
  /verify you are human/i,
  /one more step/i,
  /attention required/i,
  /cloudflare/i,
  /incapsula/i,
  /datadome/i,
  /perimeterx/i,
];

function htmlToText(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#\d+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Extract meta-refresh URL from HTML. Ecommerce sites frequently use
// <meta http-equiv="refresh" content="0;url=..."> for locale or tracking
// redirects that plain HTTP redirect following misses.
function extractMetaRefresh(html, baseUrl) {
  const match = html.match(/<meta\s[^>]*http-equiv\s*=\s*["']?refresh["']?\s[^>]*content\s*=\s*["']?\d+\s*;\s*url\s*=\s*["']?([^"'\s>]+)/i);
  if (!match) return null;
  try {
    return new URL(match[1], baseUrl).toString();
  } catch {
    return null;
  }
}

// Detect whether a page looks like a bot-protection challenge or an empty
// JS-rendered shell rather than real content.
function looksLikeChallenge(text) {
  if (text.length > 1500) return false;
  return CHALLENGE_SIGNATURES.some((pattern) => pattern.test(text));
}

function looksLikeThinContent(text) {
  // A real product or brand page almost always has more than 200 characters
  // of visible text. Below that threshold, the page is likely a JS shell
  // that did not render, a redirect page, or a challenge.
  return text.length < 200;
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Firecrawl fallback for JS-rendered and bot-protected pages
// ---------------------------------------------------------------------------

async function readWithFirecrawl(url, fetchImpl) {
  const apiKey = typeof process !== "undefined" && process.env?.FIRECRAWL_API_KEY;
  if (!apiKey) return null;
  try {
    const response = await fetchImpl("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        url: url.toString(),
        formats: ["markdown"],
        waitFor: 3000,
        timeout: 30000,
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data.success && data.data?.markdown) {
      const content = data.data.markdown.trim().slice(0, 120_000);
      if (content.length < 100) return null;
      return content;
    }
    return null;
  } catch {
    return null;
  }
}

export async function readRemotePage(value, fetchImpl = fetch) {
  let current = await assertSafeRemoteUrl(value);
  let lastError = null;

  // Retry loop: up to 3 attempts with exponential backoff.
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) await wait(1000 * Math.pow(2, attempt - 1));
    try {
      const result = await readRemotePageOnce(current, fetchImpl);
      return result;
    } catch (error) {
      lastError = error;
      // Only retry on transient failures (timeouts, 429, 5xx).
      const transient = error.message?.includes("status 5") || error.message?.includes("status 429") || error.name === "TimeoutError" || error.name === "AbortError";
      if (!transient) break;
    }
  }

  // Plain fetch failed. If the failure looks like a rendering or bot-protection
  // problem, try Firecrawl before giving up. Firecrawl handles JS execution,
  // Cloudflare challenges, and complex redirect chains.
  const renderingFailure = lastError?.message?.includes("bot-protection") || lastError?.message?.includes("very little readable text") || lastError?.message?.includes("redirected too many times");
  if (renderingFailure) {
    const firecrawlResult = await readWithFirecrawl(current, fetchImpl);
    if (firecrawlResult) return firecrawlResult;
  }

  throw lastError;
}

async function readRemotePageOnce(startUrl, fetchImpl) {
  let current = startUrl;

  // Follow up to 8 redirects (ecommerce sites chain redirects through
  // tracking pixels, locale detection, cookie-setting hops, and CDN routing).
  for (let redirect = 0; redirect < 8; redirect += 1) {
    const response = await fetchImpl(current, {
      redirect: "manual",
      headers: BROWSER_HEADERS,
      signal: AbortSignal.timeout(20_000),
    });

    // HTTP redirect
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
      current = await assertSafeRemoteUrl(new URL(response.headers.get("location"), current).toString());
      continue;
    }

    if (!response.ok) throw new Error(`Could not read ${current.hostname} (status ${response.status}).`);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > 2_000_000) throw new Error(`The page at ${current.hostname} is too large to use directly.`);
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("text/") && !contentType.includes("json") && !contentType.includes("xml")) {
      throw new Error(`The URL at ${current.hostname} is not a readable web page. Upload the file instead.`);
    }
    const rawHtml = await response.text();
    if (Buffer.byteLength(rawHtml) > 2_000_000) throw new Error(`The page at ${current.hostname} is too large to use directly.`);

    // Check for meta-refresh redirect before stripping HTML.
    const metaTarget = extractMetaRefresh(rawHtml, current.toString());
    if (metaTarget) {
      current = await assertSafeRemoteUrl(metaTarget);
      continue;
    }

    const text = htmlToText(rawHtml).slice(0, 120_000);

    // If the page looks like a bot challenge or an empty shell, report it
    // clearly so the caller (or a future fallback renderer) can act on it.
    if (looksLikeChallenge(text)) {
      throw new Error(`The page at ${current.hostname} returned a bot-protection challenge instead of content. Try uploading the page content directly, or use a different URL for this source.`);
    }
    if (looksLikeThinContent(text)) {
      throw new Error(`The page at ${current.hostname} returned very little readable text (${text.length} characters). The site may require JavaScript to render. Try uploading the page content directly.`);
    }

    return text;
  }
  throw new Error("The source URL redirected too many times.");
}

export async function enrichUrlSources(sources, fetchImpl = fetch) {
  return Promise.all(
    sources.map(async (source) => {
      if (!source.url) return source;
      const webContent = await readRemotePage(source.url, fetchImpl);
      return { ...source, content: [source.content, webContent].filter(Boolean).join("\n\n") };
    }),
  );
}
