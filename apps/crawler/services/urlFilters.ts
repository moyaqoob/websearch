import { TIER_CONFIG } from "./Calculate";

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
  /\/blog\/?$/,
  /\/articles\/?$/,
  /\.(css|js|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|pdf|zip)$/i,
  /\/\d+\/?$/,
];

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

const TRACKING_PARAMS = new Set([
  "source",
  "ref",
  "utm_source",
  "utm_medium",
  "utm_campaign",
]);

const KNOWN_TIER_DOMAINS = new Set(
  Object.entries(TIER_CONFIG)
    .filter(([tier]) => tier !== "TIER_6_UNKNOWN")
    .flatMap(([, config]) => config.domains)
    .map((domain) => normalizeHostname(domain)),
);

const TIER1_DOMAINS = new Set(
  TIER_CONFIG.TIER_1_PREMIUM.domains.map((domain) => normalizeHostname(domain)),
);

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

    const normalized = parsed.toString().replace(/\/$/, "");
    return normalized;
  } catch {
    return url;
  }
}

export function shouldDiscardUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return true;
    if (parsed.pathname === "/" || parsed.pathname === "") return true;
    if (!parsed.hostname.includes(".")) return true;
    return DISCARD_URL_PATTERNS.some((pattern) => pattern.test(url));
  } catch {
    return true;
  }
}

export function isMediumArticleUrl(url: string): boolean {
  const path = new URL(url).pathname;
  return /^\/@[^/]+\/[^/]+$/.test(path) || /^\/[^@m][^/]*\/[^/]{20,}$/.test(path);
}

export function isKnownTierDomain(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const domain of KNOWN_TIER_DOMAINS) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

export function isInTier1(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  for (const domain of TIER1_DOMAINS) {
    if (normalized === domain || normalized.endsWith(`.${domain}`)) {
      return true;
    }
  }
  return false;
}

export function isLikelyArticleUrl(url: string, sourceDomain: string): boolean {
  if (shouldDiscardUrl(url)) return false;

  const parsed = new URL(url);
  const hostname = normalizeHostname(parsed.hostname);
  const normalizedSource = normalizeHostname(sourceDomain);

  if (hostname.includes("medium.com") && !isMediumArticleUrl(url)) {
    return false;
  }

  if (hostname !== normalizedSource && !isKnownTierDomain(hostname)) {
    return false;
  }

  if (GENERIC_PATH_BLOCKLIST.some((pattern) => pattern.test(parsed.pathname))) {
    return false;
  }

  if (isInTier1(hostname)) {
    return true;
  }

  return DSA_URL_SIGNALS.some((signal) =>
    signal.test(parsed.pathname + parsed.search),
  );
}
