import { generateCrawlerHeaders } from "./fetcher";

// These domains are either blocked entirely or should be skipped.
// IMPORTANT: entries must be hostnames only, no protocol or path.
const BLOCKED_DOMAINS = new Set([
  "redis.io",
  "www.redis.io",
  "university.redis.io",
  "cloud.redis.io",
  // Cloud consoles — no crawlable content
  "console.cloud.google.com",
  "console.aws.amazon.com",
  "portal.azure.com",
  "cloud.google.com",
  "aws.amazon.com",
  "azure.microsoft.com",
]);

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsParsed {
  rules: RobotsRule[];
  crawlDelay: number | null;
  sitemaps: string[];
}

const EMPTY_ROBOTS: RobotsParsed = {
  rules: [],
  crawlDelay: null,
  sitemaps: [],
};

const CACHE_TTL_MS = 10 * 60 * 1000;
const ROBOTS_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;

export class RobotsTxt {
  private userAgent: string;
  private cache = new Map<string, { parsed: RobotsParsed; fetchedAt: number }>();
  private inFlight = new Map<string, Promise<RobotsParsed>>();

  constructor(userAgent = "*") {
    this.userAgent = userAgent;
  }

  private async fetchRobots(origin: string): Promise<RobotsParsed> {
    const cached = this.cache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.parsed;
    }

    const existing = this.inFlight.get(origin);
    if (existing) return existing;

    const promise = (async (): Promise<RobotsParsed> => {
      try {
        const robotsUrl = new URL("/robots.txt", origin).toString();
        console.log(`  [robots] fetching ${robotsUrl}`);

        const res = await fetch(robotsUrl, {
          headers: generateCrawlerHeaders(),
          // Don't let Bun follow redirects infinitely — cap it
          redirect: "follow",
          signal: AbortSignal.timeout(ROBOTS_TIMEOUT_MS),
        });

        if (!res.ok) {
          console.log(`  [robots] ${res.status} for ${origin} — treating as allow-all`);
          this.cache.set(origin, { parsed: EMPTY_ROBOTS, fetchedAt: Date.now() });
          return EMPTY_ROBOTS;
        }

        const text = await res.text();

        if (text.length > 100_000) {
          this.cache.set(origin, { parsed: EMPTY_ROBOTS, fetchedAt: Date.now() });
          return EMPTY_ROBOTS;
        }

        const parsed = this.parse(text);
        this.cache.set(origin, { parsed, fetchedAt: Date.now() });
        return parsed;
      } catch (err) {
        // Log and swallow — a broken robots.txt means allow-all, never crash
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  [robots] error for ${origin}: ${msg} — skipping, treating as allow-all`);
        this.cache.set(origin, { parsed: EMPTY_ROBOTS, fetchedAt: Date.now() });
        return EMPTY_ROBOTS;
      } finally {
        this.inFlight.delete(origin);
      }
    })();

    this.inFlight.set(origin, promise);
    return promise;
  }

  parse(robotsTxt: string): RobotsParsed {
    const lines = robotsTxt.split("\n").map((l) => l.trim());
    const rules: RobotsRule[] = [];
    let crawlDelay: number | null = null;
    const sitemaps: string[] = [];
    let activeAgent = false;

    for (const line of lines) {
      if (line.startsWith("#") || line === "") continue;

      const [directive, ...rest] = line.split(":");
      const value = rest.join(":").trim();
      const lower = directive.toLowerCase().trim();

      if (lower === "user-agent") {
        activeAgent =
          value === "*" || value.toLowerCase() === this.userAgent.toLowerCase();
        continue;
      }

      if (lower === "sitemap") {
        sitemaps.push(value);
        continue;
      }

      if (!activeAgent) continue;

      if (lower === "disallow" && value) {
        rules.push({ path: value, allow: false });
      } else if (lower === "allow" && value) {
        rules.push({ path: value, allow: true });
      } else if (lower === "crawl-delay") {
        const delay = parseFloat(value);
        if (!isNaN(delay)) crawlDelay = delay;
      }
    }

    return { rules, crawlDelay, sitemaps };
  }

  isAllowed(path: string, parsed: RobotsParsed): boolean {
    let bestMatch: RobotsRule | null = null;
    let bestLen = 0;

    for (const rule of parsed.rules) {
      if (path.startsWith(rule.path) && rule.path.length > bestLen) {
        bestMatch = rule;
        bestLen = rule.path.length;
      }
    }

    return bestMatch ? bestMatch.allow : true;
  }

  async canCrawl(url: string): Promise<{ allowed: boolean; delay: number }> {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase();

      // Block list check — hostname only, no protocol/path confusion
      if (BLOCKED_DOMAINS.has(hostname)) {
        console.log(`  [robots] ${hostname} is blocked — skipping`);
        return { allowed: false, delay: 0 };
      }

      const robots = await this.fetchRobots(parsed.origin);
      const allowed = this.isAllowed(parsed.pathname, robots);
      const delay = robots.crawlDelay ?? 1;
      return { allowed, delay };
    } catch (err) {
      // Malformed URL or anything unexpected — skip, never crash
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  [robots] canCrawl error for ${url}: ${msg} — skipping URL`);
      return { allowed: false, delay: 0 };
    }
  }
}