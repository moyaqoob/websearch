import { generateCrawlerHeaders } from "./fetcher";

const httpFetch = globalThis.fetch;

interface RobotsRule {
  path: string;
  allow: boolean;
}

interface RobotsParsed {
  rules: RobotsRule[];
  crawlDelay: number | null;
  sitemaps: string[];
}

const EMPTY_ROBOTS: RobotsParsed = { rules: [], crawlDelay: null, sitemaps: [] };
const cache = new Map<string, { parsed: RobotsParsed; fetchedAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export class RobotsTxt {
  private userAgent: string;

  constructor(userAgent = "*") {
    this.userAgent = userAgent;
  }

  async fetchRobots(domain: string): Promise<RobotsParsed> {
    const cached = cache.get(domain);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
      return cached.parsed;
    }

    try {
      const origin = domain.startsWith("http") ? domain : `https://${domain}`;
      const robotsUrl = new URL("/robots.txt", origin).toString();

      const res = await httpFetch(robotsUrl, {
        headers: generateCrawlerHeaders(),
        redirect: "follow",
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        cache.set(domain, { parsed: EMPTY_ROBOTS, fetchedAt: Date.now() });
        return EMPTY_ROBOTS;
      }

      const text = await res.text();
      const parsed = this.parse(text);
      cache.set(domain, { parsed, fetchedAt: Date.now() });
      return parsed;
    } catch {
      cache.set(domain, { parsed: EMPTY_ROBOTS, fetchedAt: Date.now() });
      return EMPTY_ROBOTS;
    }
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
        activeAgent = value === "*" || value.toLowerCase() === this.userAgent.toLowerCase();
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
      const robots = await this.fetchRobots(parsed.origin);
      const allowed = this.isAllowed(parsed.pathname, robots);
      const delay = robots.crawlDelay ?? 1;
      return { allowed, delay };
    } catch {
      return { allowed: true, delay: 1 };
    }
  }
}
