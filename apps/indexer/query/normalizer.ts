// ============================================================
// Score Normalizer
//
// This is the piece most search engine tutorials skip, and
// it's the piece that will make or break your ranking quality.
//
// The problem:
//   - BM25 scores are unbounded. A document might score 0.3 or
//     it might score 12.7, depending on the query, corpus size,
//     and document length. The "max" BM25 score you've ever
//     seen will increase as your corpus grows.
//   - quality_score, authority_score, freshness_score are all [0,1].
//   - If you naively combine these: final = 0.6*bm25 + 0.2*quality,
//     then quality is irrelevant because bm25=8.4 dwarfs quality=0.85.
//
// The solution: Min-Max normalization within each result set.
//   normalized = (score - min) / (max - min)
//
// Why within result set, not globally?
//   Global normalization would require knowing the max BM25 score
//   across all possible queries — impossible without exhaustive
//   search. Per-query normalization is the practical standard.
//   Lucene does this. Elasticsearch does this.
//
// Edge case: if all BM25 scores are equal (e.g., single result),
//   min == max, division by zero. We handle this by returning 0.5
//   (middle of the normalized range) to preserve ordering with
//   the other signals.
//
// Freshness decay:
//   We apply exponential decay to freshness_score rather than
//   using the raw value. A document published yesterday should
//   score much higher than one from 2 years ago, but the raw
//   storage value might just be a float that doesn't capture
//   this curve well. We compute decay here from published_date
//   if available, falling back to stored freshness_score.
// ============================================================

export interface RawCandidateScore {
    article_id: number;
    url: string;
    title: string;
    content: string;
    author: string | null;
    published_date: string | null;
    bm25_raw: number;
    quality_score: number;
    authority_score: number;
    freshness_score: number;
  }
  
  export interface NormalizedScore {
    article_id: number;
    url: string;
    title: string;
    content: string;
    author: string | null;
    published_date: string | null;
    bm25_raw: number;
    bm25_normalized: number;
    quality_score: number;
    authority_score: number;
    freshness_score: number;
    freshness_decayed: number;
  }
  
  // Half-life for freshness decay: 365 days...
  const FRESHNESS_HALF_LIFE_DAYS = 365;
  
  export class ScoreNormalizer {
    /**
     * Normalize BM25 scores within a candidate set and compute
     * freshness decay. Returns enhanced candidates ready for
     * fusion scoring.
     */
    normalize(candidates: RawCandidateScore[]): NormalizedScore[] {
      if (candidates.length === 0) return [];
  
      // Compute BM25 range within this result set
      const bm25Scores = candidates.map((c) => c.bm25_raw);
      const bm25Min = Math.min(...bm25Scores);
      const bm25Max = Math.max(...bm25Scores);
      const bm25Range = bm25Max - bm25Min;
  
      const now = Date.now();
  
      return candidates.map((c) => {
        // BM25 normalization
        const bm25Normalized =
          bm25Range > 1e-10
            ? (c.bm25_raw - bm25Min) / bm25Range
            : 0.5; // All scores equal — tie-break with other signals
  
        // Freshness decay from published_date (more accurate than stored score)
        const freshnessDecayed = this.computeFreshnessDecay(
          c.published_date,
          c.freshness_score,
          now
        );
  
        return {
          ...c,
          bm25_normalized: bm25Normalized,
          freshness_decayed: freshnessDecayed,
        };
      });
    }
  
    /**
     * Compute the final composite score for a single candidate.
     * Weighted linear combination of normalized signals.
     *
     * Weights must sum to 1.0 for the output to remain in [0,1].
     */
    fuse(
      candidate: NormalizedScore,
      weights: { bm25: number; quality: number; authority: number; freshness: number }
    ): number {
      return (
        weights.bm25 * candidate.bm25_normalized +
        weights.quality * candidate.quality_score +
        weights.authority * candidate.authority_score +
        weights.freshness * candidate.freshness_decayed
      );
    }
  
    /**
     * Exponential freshness decay.
     * Returns a value in [0, 1] that decreases with document age.
     *
     * f(t) = 2^(-t / half_life)
     *
     * Where t = days since published.
     * At t=0 (today): f = 1.0
     * At t=half_life: f = 0.5
     * At t=2*half_life: f = 0.25
     */
    private computeFreshnessDecay(
      publishedDate: string | null,
      storedFreshnessScore: number,
      nowMs: number
    ): number {
      if (!publishedDate) {
        // No date available — use stored score as-is
        return storedFreshnessScore;
      }
  
      const published = new Date(publishedDate).getTime();
      if (isNaN(published)) return storedFreshnessScore;
  
      const ageMs = nowMs - published;
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
  
      if (ageDays < 0) return 1.0; // Future date (data error) — treat as fresh
  
      return Math.pow(2, -ageDays / FRESHNESS_HALF_LIFE_DAYS);
    }
  }
  
  export const scoreNormalizer = new ScoreNormalizer();