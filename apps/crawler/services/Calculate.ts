import { createHash } from "crypto";
import { randomUUID } from "crypto";
import type { CrawledArticle, CrawledSignal } from "../utils";
import {
  type SourceTierConfig,
  type TierDetectionResult,
  type GateResult,
  type ExtractedSignals,
  RELEVANCE_KEYWORDS,
  type Source_Name,
  type AuthorityLevel,
  type ContentDomain,
  SOURCE_CONFIG,
} from "../utils/config";

// What Calculate returns — both tables ready for Store
export interface CalculateResult {
  article: CrawledArticle;
  signals: CrawledSignal;
}

export class Calculate {
  private readonly tierConfig: typeof SOURCE_CONFIG;
  private readonly exactDomainMap = new Map<string, Source_Name>();
  private readonly suffixMatchers: Array<{ suffix: string; tier: Source_Name }> = [];

  constructor(config: typeof SOURCE_CONFIG = SOURCE_CONFIG) {
    this.tierConfig = config;
    this.buildDomainIndex();
  }


  calculate(extracted: Partial<CrawledArticle>, url: string): CalculateResult | null {
    const tierDetection = this.DetectTier(url);

    // Gate: is this article worth storing at all?
    const gateResult = this.applyGateFiltering(extracted, tierDetection);
    if (!gateResult.passed) {
      console.log(`[Calculate] REJECTED — ${url} — ${gateResult.reason}`);
      return null;
    }

    const articleId = extracted.id ?? randomUUID();
    const content = extracted.content ?? "";
    const normalizedUrl = this.normalizeUrl(url);

    const article: CrawledArticle = {
      id: articleId,
      url,
      url_normalized: normalizedUrl,
      domain: tierDetection.domain,
      title: extracted.title ?? "",
      content,
      is_indexed: 0,                                    // indexer hasn't touched this yet
      crawl_timestamp: extracted.crawl_timestamp ?? new Date().toISOString(),
      published_date: extracted.published_date ?? null,
      content_hash: this.hashContent(content),
    };

    const signals: CrawledSignal = {
      article_id: articleId,
      authority_score: tierDetection.config.authorityScore,
      quality_score: this.calculateQualityScore(extracted),
      readability_score: this.calculateReadabilityScore(content),
      freshness_score: this.calculateFreshnessScore(extracted.published_date),
      popularity_score: this.calculatePopularityScore(extracted, tierDetection),
    };

    return { article, signals };
  }

  private buildDomainIndex(): void {
    this.exactDomainMap.clear();
    this.suffixMatchers.length = 0;

    for (const [tier, config] of Object.entries(this.tierConfig) as Array<[Source_Name, SourceTierConfig]>) {
      for (const rawDomain of config.domains) {
        const normalizedDomain = this.normalizeDomain(rawDomain);
        if (!normalizedDomain) continue;

        this.exactDomainMap.set(normalizedDomain, tier);
        this.suffixMatchers.push({ suffix: normalizedDomain, tier });
      }
    }

    this.suffixMatchers.sort((a, b) => b.suffix.length - a.suffix.length);
  }

  DetectTier(url: string): TierDetectionResult {
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
      tier: "UNKNOWN",
      config: this.tierConfig.UNKNOWN,
      domain,
    };
  }

  private applyGateFiltering(
    article: Partial<CrawledArticle>,
    tierDetection: TierDetectionResult,
  ): GateResult {
    const {config } = tierDetection;

    if (!article.title || article.title.trim().length < 3) {
      return { passed: false, reason: "Missing usable title" };
    }

    if (!article.content || article.content.trim().length < 50) {
      return { passed: false, reason: "Empty or near-empty content" };
    }

    const qualityScore = this.calculateQualityScore(article);
    if (qualityScore < config.minQualityScore) {
      return {
        passed: false,
        reason: `Quality score ${qualityScore} below tier minimum ${config.minQualityScore}`,
      };
    }

    // keyword relevance used as gate only — is this article even on-topic?
    const relevanceScore = this.calculateKeywordRelevanceScore(article);
    if (relevanceScore < 5) {
      return {
        passed: false,
        reason: `Relevance score ${relevanceScore} too low — off-topic content`,
      };
    }

    return { passed: true };
  }

  private calculateQualityScore(article: Partial<CrawledArticle>): number {
    const content = article.content ?? "";
    const title = article.title ?? "";
    let score = 0;

    const codeCount = this.countCodeBlocks(content);
    if (codeCount >= 1) score += 20;
    if (codeCount >= 2) score += 10;
    if (codeCount >= 3) score += 5;

    if (title.trim().length >= 3) score += 8;
    if (this.hasComplexityAnalysis(content)) score += 15;
    if (this.hasAlgorithmicContent(content)) score += 12;
    if (this.hasExplanations(content)) score += 8;
    if (this.hasStructuredContent(content)) score += 7;

    return Math.min(100, score);
  }

  private calculateReadabilityScore(content: string): number {
    const normalized = this.normalizeText(content);
    if (normalized.length < 100) return 0;

    const sentences = Math.max(
      1,
      normalized.split(/[.!?]+/).filter((s) => s.trim().length > 0).length,
    );
    const words = normalized.split(/\s+/).filter(Boolean);
    const wordCount = Math.max(1, words.length);
    const syllableCount = this.estimateSyllables(normalized);

    const gradeLevel =
      0.39 * (wordCount / sentences) + 11.8 * (syllableCount / wordCount) - 15.59;

    return Math.round(Math.max(0, Math.min(100, 100 - gradeLevel * 5)) * 100) / 100;
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

  private calculatePopularityScore(
    article: Partial<CrawledArticle>,
    tierDetection: TierDetectionResult,
  ): number {
    let score = 0;
    const { authority, primaryDomain} = tierDetection.config;
  
    const authorityBonus: Record<AuthorityLevel, number> = {
      CANONICAL:     40,
      INSTITUTIONAL: 35,
      ESTABLISHED:   25,
      COMMUNITY:     10,
      UNKNOWN:        0,
    };
    score += authorityBonus[authority];
  
   
    const domainBonus: Record<ContentDomain, number> = {
      SYSTEM_DESIGN:       15,
      DSA:                 12,
      LANGUAGE_SPECIFIC:    8,
      GENERAL_ENGINEERING:  5,
    };
    score += domainBonus[primaryDomain];
  
  
    const content = article.content ?? "";
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    if (wordCount > 2000) score += 20;
    else if (wordCount > 1000) score += 12;
    else if (wordCount > 500)  score +=  6;
  
    const codeBlocks = this.countCodeBlocks(content);
    if (codeBlocks >= 3) score += 15;
    else if (codeBlocks >= 1) score +=  8;
  
    if (this.hasComplexityAnalysis(content)) score += 10;
    if (this.hasStructuredContent(content))  score +=  5;
  
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


  private hashContent(content: string): string {
    return createHash("sha256")
      .update(this.normalizeText(content).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      .digest("hex");
  }

  private normalizeUrl(url: string): string {
    try {
      const u = new URL(url);
      u.hash = "";
      u.searchParams.sort();
      return u.toString().toLowerCase().replace(/\/$/, "");
    } catch {
      return url.toLowerCase().trim();
    }
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
    return text.match(new RegExp(`\\b${escaped}\\b`, "g"))?.length ?? 0;
  }

  private estimateSyllables(text: string): number {
    return text.match(/[aeiouy]+/gi)?.length ?? 0;
  }
}

export default Calculate;