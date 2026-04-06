import { SOURCE_CONFIG, type AuthorityLevel } from "../utils/config";

// ---------------------------------------------------------------------------
// URL DISCARD PATTERNS — structural noise, never articles
// ---------------------------------------------------------------------------

export const DISCARD_URL_PATTERNS: RegExp[] = [
  /\/m\/signin/,
  /\/m\/logout/,
  /\/m\/signup/,
  /\/m\/connect/,
  /\/m\/register/,
  /operation=(login|register|logout)/,
  /sitemap\.xml/,
  /\/feed\/?$/,
  /\.rss$/,
  /\.atom$/,
  /\/tag\//,
  /\/topic\//,
  /\/explore-topics/,
  /\/search\?/,
  /\/tagged\//,
  /\/archive\//,
  /\/page\/\d+/,
  /[?&]page=\d+/,
  /[?&]source=top_nav/,
  /[?&]source=.*nav/,
  /[?&]source=login/,
  /[?&]source=topic_portal/,
  /\/category\//,
  /\/categories\//,
  /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|pdf|zip)$/i,
  /^https?:\/\/[^/]+\/\d+\/?$/,
];

export const GENERIC_PATH_BLOCKLIST: RegExp[] = [
  /\/about\/?$/,
  /\/contact\/?$/,
  /\/careers?\/?$/,
  /\/jobs\/?$/,
  /\/pricing\/?$/,
  /\/terms\/?$/,
  /\/privacy\/?$/,
  /\/legal\/?$/,
  /\/press\/?$/,
  /\/login\/?$/,
  /\/logout\/?$/,
  /\/signup\/?$/,
  /\/register\/?$/,
  /\/subscribe\/?$/,
  /\/newsletter\/?$/,
];

// DSA_URL_SIGNALS only used for COMMUNITY/UNKNOWN sources
// CANONICAL and INSTITUTIONAL sources are trusted unconditionally on path
export const DSA_URL_SIGNALS: RegExp[] = [
  /\/problems?\//,
  /\/algorithms?\//,
  /\/data-structures?\//,
  /\/dynamic-programming/,
  /\/graph/,
  /\/tree/,
  /\/sorting/,
  /\/searching/,
  /\/system-design/,
  /\/distributed/,
  /\/interview/,
  /\/solutions?\//,
  /\/tutorials?\//,
  /\/learn\//,
  /\/courses?\//,
  /\/articles?\//,
];

const TRACKING_PARAMS = new Set([
  "source",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

// ---------------------------------------------------------------------------
// DOMAIN LOOKUP TABLES — built once at module load from SOURCE_CONFIG
// ---------------------------------------------------------------------------

// Every known domain across all source profiles
const ALL_KNOWN_DOMAINS = new Set(
  Object.values(SOURCE_CONFIG)
    .flatMap((config) => config.domains)
    .map((domain) => normalizeHostname(domain)),
);

// High-trust sources — CANONICAL and INSTITUTIONAL authority
// These get through without DSA_URL_SIGNALS matching
// Derived from authority level, not hardcoded tier names
const HIGH_AUTHORITY_DOMAINS = new Set(
  Object.values(SOURCE_CONFIG)
    .filter((config) => 
      config.authority === "CANONICAL" || 
      config.authority === "INSTITUTIONAL"
    )
    .flatMap((config) => config.domains)
    .map((domain) => normalizeHostname(domain)),
);

// Medium trust — ESTABLISHED authors, known publications
// Still trusted on path but monitored more carefully
const ESTABLISHED_DOMAINS = new Set(
  Object.values(SOURCE_CONFIG)
    .filter((config) => config.authority === "ESTABLISHED")
    .flatMap((config) => config.domains)
    .map((domain) => normalizeHostname(domain)),
);

// ---------------------------------------------------------------------------
// NORMALIZATION
// ---------------------------------------------------------------------------

export function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^www\./, "");
}

export function normalizeQueueUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    for (const key of TRACKING_PARAMS) {
      parsed.searchParams.delete(key);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// DOMAIN CLASSIFICATION
// ---------------------------------------------------------------------------

export function getAuthorityLevel(hostname: string): AuthorityLevel | null {
  const normalized = normalizeHostname(hostname);

  for (const [, config] of Object.entries(SOURCE_CONFIG)) {
    for (const domain of config.domains) {
      const nd = normalizeHostname(domain);
      if (normalized === nd || normalized.endsWith(`.${nd}`)) {
        return config.authority;
      }
    }
  }

  return null; // not in config at all
}

export function isKnownDomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const domain of ALL_KNOWN_DOMAINS) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) return true;
  }
  return false;
}

export function isHighAuthorityDomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const domain of HIGH_AUTHORITY_DOMAINS) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) return true;
  }
  return false;
}

export function isEstablishedDomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const domain of ESTABLISHED_DOMAINS) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// MEDIUM — platform-specific article detection
// Medium is a platform, not a source. Only accept article-shaped URLs.
// ---------------------------------------------------------------------------

export function isMediumArticleUrl(url: string): boolean {
  const path = new URL(url).pathname;
  return (
    /^\/@[^/]+\/[^/]+$/.test(path) ||
    /^\/[^@m][^/]*\/[^/]{20,}$/.test(path)
  );
}

// ---------------------------------------------------------------------------
// CORE DISCARD LOGIC
// ---------------------------------------------------------------------------

export function shouldDiscardUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    if (!parsed.hostname.includes(".")) return true;
    return DISCARD_URL_PATTERNS.some((pattern) => pattern.test(url));
  } catch {
    return true;
  }
}

// ---------------------------------------------------------------------------
// MAIN GATE — is this URL worth queueing?
//
// Decision tree:
//   1. Hard discard? → reject
//   2. Generic path (about, careers...)? → reject
//   3. Medium but not article-shaped? → reject
//   4. Not from known domain AND not same origin? → reject
//   5. CANONICAL or INSTITUTIONAL domain? → accept unconditionally
//   6. ESTABLISHED domain? → accept if not generic path (already checked)
//   7. COMMUNITY or UNKNOWN? → require DSA_URL_SIGNALS match
// ---------------------------------------------------------------------------

export function isLikelyArticleUrl(url: string, sourceDomain: string): boolean {
  if (shouldDiscardUrl(url)) return false;

  const parsed = new URL(url);
  const hostname = normalizeHostname(parsed.hostname);
  const normalizedSource = normalizeHostname(sourceDomain);
  const pathAndQuery = parsed.pathname + parsed.search;
  const isRootPath = parsed.pathname === "/" || parsed.pathname === "";

  // Medium is a platform — apply article shape detection
  if (hostname.includes("medium.com") && !isMediumArticleUrl(url)) {
    return false;
  }

  // Don't follow links off-domain to unknown territory
  if (hostname !== normalizedSource && !isKnownDomain(hostname)) {
    return false;
  }

  // Generic paths are noise regardless of domain authority
  if (GENERIC_PATH_BLOCKLIST.some((pattern) => pattern.test(parsed.pathname))) {
    return false;
  }

  // CANONICAL + INSTITUTIONAL: trust the source, accept root paths too
  // e.g. https://netflixtechblog.com is itself a listing of articles
  if (isHighAuthorityDomain(hostname)) {
    return true;
  }

  // ESTABLISHED authors: same — trust the domain including root
  if (isEstablishedDomain(hostname)) {
    return true;
  }

  // For COMMUNITY/UNKNOWN: reject bare root paths — no signal to judge
  if (isRootPath) {
    return false;
  }

  // COMMUNITY + UNKNOWN: require URL to signal relevance before queueing
  return DSA_URL_SIGNALS.some((signal) => signal.test(pathAndQuery));
}