import { createHash } from "crypto";
import type { CrawledArticle, RankedArticle, SearchPrecision } from "../utils";

// ============================================================================
// TYPES
// ============================================================================

interface SourceTierConfig {
  name: string;
  domains: string[];
  authorityScore: number;
  minQualityScore: number;
  minWordCount: number;
  requireCodeExamples: boolean;
  requireAuthor: boolean;
  searchPrecision: SearchPrecision;
}

interface TierDetectionResult {
  tier: TierName;
  config: SourceTierConfig;
  domain: string;
}

interface GateResult {
  passed: boolean;
  reason?: string;
}

interface ExtractedSignals {
  authority_score: number;
  quality_score: number;
  keyword_relevance_score: number;
  freshness_score: number;
  readability_score: number;
  content_hash: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RELEVANCE_KEYWORDS: Array<{ term: string; weight: number }> = [
  { term: "algorithm", weight: 1.8 },
  { term: "data structure", weight: 1.8 },
  { term: "binary search", weight: 2.2 },
  { term: "dynamic programming", weight: 2.4 },
  { term: "graph", weight: 1.5 },
  { term: "tree", weight: 1.4 },
  { term: "heap", weight: 1.5 },
  { term: "hash map", weight: 1.6 },
  { term: "complexity", weight: 1.7 },
  { term: "time complexity", weight: 2.1 },
  { term: "space complexity", weight: 2.1 },
  { term: "system design", weight: 2.3 },
  { term: "distributed systems", weight: 2.3 },
  { term: "scalability", weight: 1.9 },
  { term: "caching", weight: 1.7 },
  { term: "microservices", weight: 1.8 },
  { term: "database", weight: 1.5 },
  { term: "sql", weight: 1.3 },
  { term: "consistency", weight: 1.6 },
  { term: "replication", weight: 1.6 },
];

// ============================================================================
// TIER CONFIG
//
// Gate philosophy per tier:
//
//   TIER_1/TIER_2 — sources are pre-vetted by reputation. Gates are loose.
//   The authority score (92-95) already carries the trust signal. We do not
//   need minQualityScore or requireAuthor to do double duty here. A 300-word
//   LeetCode problem page with one code block is exactly the article we want.
//
//   TIER_3/TIER_4 — moderate gates. These sources are good but not curated.
//   A quality floor of 40 filters pure spam without touching real content.
//
//   TIER_5/TIER_6 — tight gates. Unknown blogs need to earn their place.
//   Higher minQualityScore, requireAuthor, requireCodeExamples all apply.
// ============================================================================

export const TIER_CONFIG = {
  TIER_1_PREMIUM: {
    name: "Premium Algorithm Sources",
    domains: [
      "algo.monster",
      "algoexpert.io",
      "baeldung.com",
      "careercup.com",
      "codeforces.com",
      "cp-algorithms.com",
      "geeksforgeeks.org",
      "interviewbit.com",
      "leetcode.com",
      "neetcode.io",
      "thealgorithms.github.io",
      "usaco.guide",
    ],
    authorityScore: 95,
    minQualityScore: 20,
    minWordCount: 100,
    requireCodeExamples: true,
    requireAuthor: false,
    searchPrecision: "HIGH" as SearchPrecision,
  },
  TIER_2_SYSTEM_DESIGN: {
    name: "Tech Company Engineering Blogs",
    domains: [
      "airbnb.engineering",
      "allthingsdistributed.com",
      "aphyr.com",
      "architecturenotes.co",
      "aws.amazon.com",
      "brooker.co.za",
      "bytebytego.com",
      "canvatechblog.com",
      "cloud.google.com",
      "developer.squareup.com",
      "devblog.paypal.com",
      "doordash.engineering",
      "dropbox.tech",
      "eng.lyft.com",
      "eng.uber.com",
      "engineering.atspotify.com",
      "engineering.fb.com",
      "engineering.grab.com",
      "engineering.gusto.com",
      "engineering.hellofresh.com",
      "engineering.khanacademy.org",
      "engineering.monzo.com",
      "engineering.pinterest.com",
      "engineering.prezi.com",
      "engineering.razorpay.com",
      "engineering.squarespace.com",
      "engineering.zalando.com",
      "engineeringblog.yelp.com",
      "hellointerview.com",
      "highscalability.com",
      "martin.kleppmann.com",
      "martinfowler.com",
      "medium.engineering",
      "netflixtechblog.com",
      "pragmaticengineer.com",
      "robinhood.engineering",
      "shopify.engineering",
      "slack.engineering",
      "staffeng.com",
      "systemdesign.one",
      "tech.deliveroo.com",
      "tech.instacart.com",
      "tech.trivago.com",
      "technology.riotgames.com",
      "the-paper-trail.org",
      "wix.engineering",
    ],
    authorityScore: 92,
    minQualityScore: 25,
    minWordCount: 300,
    requireCodeExamples: false,
    requireAuthor: false,
    searchPrecision: "VERY_HIGH" as SearchPrecision,
  },
  TIER_3_EDUCATION: {
    name: "Curated Educational Platforms",
    domains: [
      "codesignal.com",
      "coursera.org",
      "dev.to",
      "educative.io",
      "hashnode.com",
      "interviewready.io",
      "javatpoint.com",
      "pluralsight.com",
      "programiz.com",
      "realpython.com",
      "scaler.com",
      "tutorialspoint.com",
      "udacity.com",
      "visualgo.net",
    ],
    authorityScore: 80,
    minQualityScore: 35,
    minWordCount: 250,
    requireCodeExamples: true,
    requireAuthor: false,
    searchPrecision: "HIGH" as SearchPrecision,
  },
  TIER_4_COMMUNITY: {
    name: "Community & Technical Sites",
    domains: [
      "abseil.io",
      "cassandra.apache.org",
      "clickhouse.com",
      "cockroachlabs.com",
      "css-tricks.com",
      "doc.rust-lang.org",
      "docs.microsoft.com",
      "javascript.info",
      "mongodb.com",
      "pingcap.com",
      "planetscale.com",
      "python.org",
      "redis.io",
      "rust-lang.org",
      "stackoverflow.com",
      "tigerbeetle.com",
    ],
    authorityScore: 75,
    minQualityScore: 30,
    minWordCount: 150,
    requireCodeExamples: true,
    requireAuthor: false,
    searchPrecision: "MEDIUM" as SearchPrecision,
  },
  TIER_5_BLOGS: {
    name: "Individual Tech Blogs",
    domains: [
      "blog.cleancoder.com",
      "blog.cloudflare.com",
      "fasterthanli.me",
      "joelonsoftware.com",
      "lemire.me",
      "medium.com",
      "muratbuffalo.blogspot.com",
      "newsletter.pragmaticengineer.com",
      "notes.eatonphil.com",
      "paulgraham.com",
      "substack.com",
      "wordpress.com",
    ],
    authorityScore: 60,
    minQualityScore: 50,
    minWordCount: 500,
    requireCodeExamples: true,
    requireAuthor: true,
    searchPrecision: "MEDIUM" as SearchPrecision,
  },
  TIER_6_UNKNOWN: {
    name: "Unknown Sources",
    domains: [],
    authorityScore: 40,
    minQualityScore: 65,
    minWordCount: 700,
    requireCodeExamples: true,
    requireAuthor: true,
    searchPrecision: "LOW" as SearchPrecision,
  },
} satisfies Record<string, SourceTierConfig>;

type TierName = keyof typeof TIER_CONFIG;

// ============================================================================
// CALCULATE CLASS
// ============================================================================

export class Calculate {
  private readonly tierConfig: typeof TIER_CONFIG;
  private readonly exactDomainMap = new Map<string, TierName>();
  private readonly suffixMatchers: Array<{ suffix: string; tier: TierName }> = [];

  constructor(config: typeof TIER_CONFIG = TIER_CONFIG) {
    this.tierConfig = config;
    this.buildDomainIndex();
  }

  // --------------------------------------------------------------------------
  // PUBLIC API
  // --------------------------------------------------------------------------

  calculate(extracted: Partial<CrawledArticle>, url: string): RankedArticle | null {
    const tierDetection = this.detectTier(url);
    const gateResult = this.applyGateFiltering(extracted, tierDetection);

    if (!gateResult.passed) {
      return null;
    }

    const signals = this.extractSignals(extracted, tierDetection);
    const rankingScore = this.calculateWeightedRanking(signals);

    return {
      ...extracted,
      tier: tierDetection.tier,
      source_tier: tierDetection.tier,
      content_hash: signals.content_hash,
      authority_score: signals.authority_score,
      quality_score: signals.quality_score,
      keyword_relevance_score: signals.keyword_relevance_score,
      freshness_score: signals.freshness_score,
      readability_score: signals.readability_score,
      popularity_score: rankingScore,
      ranking_score: rankingScore,
    };
  }

  getTierInfo(): typeof TIER_CONFIG {
    return this.tierConfig;
  }

  checkUrl(url: string): { tier: TierName; config: SourceTierConfig } {
    const detection = this.detectTier(url);
    return { tier: detection.tier, config: detection.config };
  }

  // --------------------------------------------------------------------------
  // DOMAIN INDEX
  // --------------------------------------------------------------------------

  private buildDomainIndex(): void {
    this.exactDomainMap.clear();
    this.suffixMatchers.length = 0;

    for (const [tier, config] of Object.entries(this.tierConfig) as Array<[TierName, SourceTierConfig]>) {
      for (const rawDomain of config.domains) {
        const normalizedDomain = this.normalizeDomain(rawDomain);
        if (!normalizedDomain) continue;

        this.exactDomainMap.set(normalizedDomain, tier);
        this.suffixMatchers.push({ suffix: normalizedDomain, tier });
      }
    }

    this.suffixMatchers.sort((a, b) => b.suffix.length - a.suffix.length);
  }

  private detectTier(url: string): TierDetectionResult {
    const domain = this.normalizeDomain(new URL(url).hostname);
    const exactTier = this.exactDomainMap.get(domain);

    if (exactTier) {
      return { tier: exactTier, config: this.tierConfig[exactTier], domain };
    }

    for (const matcher of this.suffixMatchers) {
      if (domain === matcher.suffix || domain.endsWith(`.${matcher.suffix}`)) {
        return { tier: matcher.tier, config: this.tierConfig[matcher.tier], domain };
      }
    }

    return {
      tier: "TIER_6_UNKNOWN",
      config: this.tierConfig.TIER_6_UNKNOWN,
      domain,
    };
  }

  // --------------------------------------------------------------------------
  // GATE FILTERING
  // --------------------------------------------------------------------------

  private applyGateFiltering(
    article: Partial<CrawledArticle>,
    tierDetection: TierDetectionResult,
  ): GateResult {
    const { config } = tierDetection;

    // Hard gates — apply to all tiers regardless of config
    if (!article.title || article.title.trim().length < 3) {
      return { passed: false, reason: "Missing usable title" };
    }

    if (!article.content || article.content.trim().length < 50) {
      return { passed: false, reason: "Empty or near-empty content" };
    }

    // Soft gates — thresholds vary per tier
    if ((article.word_count ?? 0) < config.minWordCount) {
      return { passed: false, reason: `Word count ${article.word_count} below tier minimum ${config.minWordCount}` };
    }

    const qualityScore = this.calculateQualityScore(article);
    if (qualityScore < config.minQualityScore) {
      return { passed: false, reason: `Quality score ${qualityScore} below tier minimum ${config.minQualityScore}` };
    }

    if (config.requireAuthor && !article.author) {
      return { passed: false, reason: "Missing author attribution" };
    }

    if (config.requireCodeExamples && !this.hasCodeExamples(article.content ?? "")) {
      return { passed: false, reason: "Missing code examples" };
    }

    return { passed: true };
  }

  // --------------------------------------------------------------------------
  // SIGNAL EXTRACTION
  // --------------------------------------------------------------------------

  private extractSignals(
    article: Partial<CrawledArticle>,
    tierDetection: TierDetectionResult,
  ): ExtractedSignals {
    return {
      authority_score: tierDetection.config.authorityScore,
      quality_score: this.calculateQualityScore(article),
      keyword_relevance_score: this.calculateKeywordRelevanceScore(article),
      freshness_score: this.calculateFreshnessScore(article.published_date),
      readability_score: this.calculateReadabilityScore(article.content ?? ""),
      content_hash: this.hashNormalizedContent(article.content ?? ""),
    };
  }

  private calculateWeightedRanking(signals: ExtractedSignals): number {
    const score =
      signals.authority_score         * 0.30 +
      signals.quality_score           * 0.30 +
      signals.keyword_relevance_score * 0.20 +
      signals.freshness_score         * 0.15 +
      signals.readability_score       * 0.05;

    return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
  }

  // --------------------------------------------------------------------------
  // INDIVIDUAL SIGNAL CALCULATIONS
  // --------------------------------------------------------------------------

  private calculateQualityScore(article: Partial<CrawledArticle>): number {
    const content = article.content ?? "";
    const title = article.title ?? "";
    let score = 0;

    const codeCount = this.countCodeBlocks(content);
    if (codeCount >= 1) score += 20;
    if (codeCount >= 2) score += 10;
    if (codeCount >= 3) score += 5;

    if (title.trim().length >= 3) score += 8;

    if ((article.word_count ?? 0) >= 100) score += 5;
    if ((article.word_count ?? 0) >= 300) score += 5;
    if ((article.word_count ?? 0) >= 700) score += 5;

    if (this.hasComplexityAnalysis(content)) score += 15;
    if (this.hasAlgorithmicContent(content)) score += 12;
    if (this.hasExplanations(content)) score += 8;
    if (this.hasStructuredContent(content)) score += 7;
    if (article.author) score += 5;

    return Math.min(100, score);
  }

  private calculateKeywordRelevanceScore(article: Partial<CrawledArticle>): number {
    const title = this.normalizeText(article.title ?? "");
    const content = this.normalizeText(article.content ?? "");

    let weightedHits = 0;

    for (const keyword of RELEVANCE_KEYWORDS) {
      const titleHits = this.countOccurrences(title, keyword.term);
      const contentHits = this.countOccurrences(content, keyword.term);
      weightedHits +=
        Math.log1p(titleHits * 3) * keyword.weight +
        Math.log1p(contentHits) * keyword.weight;
    }

    const scaled = (Math.log1p(weightedHits) / Math.log1p(20)) * 100;
    return Math.round(Math.max(0, Math.min(100, scaled)) * 100) / 100;
  }

  private calculateFreshnessScore(publishedDate: string | null | undefined): number {
    if (!publishedDate) return 60;

    const published = new Date(publishedDate);
    if (Number.isNaN(published.getTime())) return 60;

    const daysOld = (Date.now() - published.getTime()) / (1000 * 60 * 60 * 24);

    if (daysOld < 7)    return 100;
    if (daysOld < 30)   return 90;
    if (daysOld < 90)   return 80;
    if (daysOld < 365)  return 70;
    if (daysOld < 1000) return 60;
    return 40;
  }

  private calculateReadabilityScore(content: string): number {
    const normalized = this.normalizeText(content);
    if (normalized.length < 100) return 0;

    const sentences = Math.max(
      1,
      normalized.split(/[.!?]+/).filter((part) => part.trim().length > 0).length,
    );
    const words = normalized.split(/\s+/).filter(Boolean);
    const wordCount = Math.max(1, words.length);
    const syllableCount = this.estimateSyllables(normalized);

    const gradeLevel =
      0.39 * (wordCount / sentences) +
      11.8 * (syllableCount / wordCount) -
      15.59;

    const score = 100 - gradeLevel * 5;
    return Math.round(Math.max(0, Math.min(100, score)) * 100) / 100;
  }

  // --------------------------------------------------------------------------
  // CONTENT ANALYSIS HELPERS
  // --------------------------------------------------------------------------

  private hasCodeExamples(content: string): boolean {
    return this.countCodeBlocks(content) > 0;
  }

  private countCodeBlocks(content: string): number {
    return (
      (content.match(/<code[^>]*>[\s\S]*?<\/code>/gi) ?? []).length +
      (content.match(/```[\s\S]*?```/g) ?? []).length +
      (content.match(/<pre[^>]*>[\s\S]*?<\/pre>/gi) ?? []).length
    );
  }

  private hasAlgorithmicContent(content: string): boolean {
    return /algorithm|data structure|graph|tree|heap|hash|distributed|system design/i.test(content);
  }

  private hasExplanations(content: string): boolean {
    return /how .* work|explain|understand|step by step|approach|intuition/i.test(content);
  }

  private hasComplexityAnalysis(content: string): boolean {
    return /time complexity|space complexity|big o|o\s*\(|efficient/i.test(content);
  }

  private hasStructuredContent(content: string): boolean {
    return (
      /(^|\n)\s*[-*]\s+\w/m.test(content) ||
      /(^|\n)\s*\d+\.\s+\w/m.test(content) ||
      /(^|\n)\s*#{1,6}\s+\w/m.test(content)
    );
  }

  // --------------------------------------------------------------------------
  // TEXT UTILITIES
  // --------------------------------------------------------------------------

  private hashNormalizedContent(content: string): string {
    return createHash("sha256")
      .update(this.normalizeContentForHashing(content))
      .digest("hex");
  }

  private normalizeContentForHashing(content: string): string {
    return this.normalizeText(content)
      .replace(/<[^>]+>/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private normalizeText(value: string): string {
    return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
  }

  private normalizeDomain(domain: string): string {
    return domain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/^www\./, "")
      .split("/")[0];
  }

  private countOccurrences(text: string, term: string): number {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const matches = text.match(new RegExp(`\\b${escaped}\\b`, "g"));
    return matches ? matches.length : 0;
  }

  private estimateSyllables(text: string): number {
    return text.match(/[aeiouy]+/gi)?.length ?? 0;
  }
}

export default Calculate;