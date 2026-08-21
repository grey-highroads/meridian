# URL Reading Reliability: Firecrawl Fallback

Status: Implemented. Firecrawl fallback ships alongside the Tier 1 hardening.

## Problem

Ecommerce and modern marketing sites frequently fail URL reading during brand source ingestion. The failure modes fall into three categories:

**Bot protection.** Cloudflare, DataDome, PerimeterX, and similar services return a JavaScript challenge page instead of content. The server-side fetch receives a 200 OK with a page that says "Checking your browser" rather than the brand's product information.

**JavaScript-rendered content.** Single-page applications and React/Next.js sites return an HTML shell with no visible text. The actual product descriptions, claims, and brand copy are loaded by JavaScript after the initial HTML response. Server-side fetch gets the shell, not the content.

**Redirect chains.** Ecommerce sites chain redirects through locale detection, A/B testing, tracking pixels, cookie-setting hops, and CDN routing. A single product URL may pass through 6-10 hops before reaching the final page, some of which are JavaScript-based (window.location) rather than HTTP 3xx.

## What was just shipped (Tier 1)

`src/brand-brain/source-reader.js` was hardened with:

- Browser-like User-Agent and Accept headers (Chrome on macOS)
- Meta-refresh redirect detection and following
- Redirect limit increased from 4 to 8
- Retry with exponential backoff (3 attempts) for transient failures (5xx, 429, timeouts)
- Timeout increased from 15s to 20s
- Challenge-page detection (Cloudflare, DataDome, PerimeterX, Incapsula signatures)
- Thin-content detection (pages returning under 200 characters of visible text)
- Specific error messages telling the user what happened and suggesting upload as an alternative

These changes improve reliability for sites that serve real content to browser-like requests but do not require JavaScript execution. They do not solve bot protection or JS-rendered content.

## What to build next: Firecrawl as a fallback renderer

Firecrawl (firecrawl.dev) is a web scraping API that handles JavaScript rendering, bot protection, and content extraction. It returns clean markdown from any URL.

### Integration pattern

The source reader should try the improved plain fetch first (fast, no external dependency, no per-call cost). If the result triggers challenge detection or thin-content detection, retry through Firecrawl before failing.

```
readRemotePage(url)
  |
  try plain fetch (current code)
  |
  success with real content? -> return
  |
  challenge or thin content detected?
  |
  yes -> try Firecrawl
  |       |
  |       success? -> return markdown content
  |       |
  |       fail? -> throw with specific guidance
  |
  no (other error) -> throw original error
```

### Firecrawl API call

```javascript
const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.FIRECRAWL_API_KEY}`,
  },
  body: JSON.stringify({
    url: targetUrl,
    formats: ["markdown"],
    waitFor: 3000,
    timeout: 30000,
  }),
});

const data = await response.json();
if (data.success && data.data?.markdown) {
  return data.data.markdown.slice(0, 120_000);
}
```

### Where to put it

Add a `readWithFirecrawl(url)` function to `src/brand-brain/source-reader.js`. Call it from `readRemotePageOnce` when challenge or thin-content detection fires, before throwing. Gate it on `process.env.FIRECRAWL_API_KEY` being set. When the key is not set, throw the existing error message (the user sees "try uploading directly").

### Environment setup

Add `FIRECRAWL_API_KEY` to:
- `.env.local` for local development
- Vercel project environment variables for production
- The README's environment variable documentation

### Cost and limits

Firecrawl's free tier includes 500 credits. Each scrape is 1 credit. At the scale BWS operates (brand onboarding, not high-volume crawling), 500 free calls covers months of usage. Paid plans start at $19/month for 3,000 credits.

The fallback pattern means Firecrawl is only called when plain fetch fails, so the majority of URLs (static pages, blogs, about pages, PDF-hosted brand guides) never hit the API.

### What this does NOT solve

- Sites that require authentication (login walls, gated content). These need the user to upload the content directly.
- Sites that block all automated access including Firecrawl. These exist but are rare.
- Large multi-page crawls (scraping an entire site). BWS reads individual URLs, not site trees.

### Alternatives considered

**Puppeteer/Playwright on Vercel.** Possible with `@sparticuz/chromium` but adds 50MB to the serverless function, increases cold start times significantly, and requires careful memory management. The maintenance burden is high relative to the problem size.

**Browserless.io.** Similar API to Firecrawl but more infrastructure-focused. Better for high-volume scraping than occasional brand source reading.

**Jina Reader (r.jina.ai).** Simpler API (just prepend the URL) but less reliable on heavily protected sites. No JavaScript wait option. Could be a lighter alternative if Firecrawl's cost becomes a concern.

### Files to change

1. `src/brand-brain/source-reader.js` (add `readWithFirecrawl`, call from `readRemotePageOnce`)
2. `.env.example` or README (document the new env var)
3. Vercel project settings (add the key)

The code is implemented. The remaining setup is adding FIRECRAWL_API_KEY to .env.local and Vercel project environment variables. When the key is not set, the fallback is silently skipped and the user sees the original error suggesting they upload content directly.
