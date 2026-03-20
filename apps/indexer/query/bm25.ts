import type { BM25Params } from '../types/utils.ts';
import { DEFAULT_BM25_PARAMS } from '../types/utils.ts';

// ============================================================
// BM25 Scorer
//
// BM25 (Best Match 25) is the ranking function that won
// information retrieval. It's used by Elasticsearch,
// Lucene, Solr, and every serious text search system.
// It improves over TF-IDF in two ways:
//
//   1. Term Frequency Saturation: TF-IDF scales linearly
//      with term frequency. If "binary search" appears 10
//      times, TF-IDF gives 10x the score of 1 appearance.
//      But the 10th occurrence tells you much less than the
//      1st. BM25 saturates — after a point, more occurrences
//      barely increase the score. Controlled by k1.
//
//   2. Document Length Normalization: A long article that
//      mentions "cache" 5 times is less relevant than a short
//      focused article that mentions it 3 times. BM25 normalizes
//      by document length relative to corpus average. Controlled
//      by b (0 = no normalization, 1 = full normalization).
//
// The formula for a query term t in document d:
//
//   score(t,d) = IDF(t) × [ tf(t,d) × (k1 + 1) ]
//                          ─────────────────────────────────────
//                          [ tf(t,d) + k1 × (1 - b + b × (|d| / avgdl)) ]
//
// Where:
//   IDF(t) = log((N - n(t) + 0.5) / (n(t) + 0.5) + 1)
//   N      = total documents in corpus
//   n(t)   = documents containing term t
//   tf(t,d) = term frequency in document d (we weight title higher)
//   |d|    = document length in tokens
//   avgdl  = average document length across corpus
//
// Field-weighted TF:
//   We give title occurrences 3x weight. This is a standard
//   trick (Elasticsearch uses 2.2x by default). The intuition:
//   if a term appears in the title, the article is almost
//   certainly about that term, not just mentioning it.
// ============================================================

const TITLE_WEIGHT = 3.0;
const CONTENT_WEIGHT = 1.0;

export class BM25Scorer {
  private params: BM25Params;

  constructor(params: BM25Params = DEFAULT_BM25_PARAMS) {
    this.params = params;
  }

  /**
   * Compute IDF for a term.
   *
   * Using Robertson's IDF formula (not the classic log(N/df)):
   *   IDF = log((N - df + 0.5) / (df + 0.5) + 1)
   *
   * The +1 at the end prevents negative IDF for very common terms
   * (which would happen if df > N/2 with the classic formula).
   * Lucene uses this variant.
   */
  idf(totalDocs: number, docFreq: number): number {
    if (docFreq === 0) return 0;
    return Math.log(
      (totalDocs - docFreq + 0.5) / (docFreq + 0.5) + 1
    );
  }

  /**
   * Compute field-weighted TF.
   * Combines title and content frequencies with different weights.
   */
  weightedTF(titleTF: number, contentTF: number): number {
    return titleTF * TITLE_WEIGHT + contentTF * CONTENT_WEIGHT;
  }

  /**
   * Compute BM25 score for a single (term, document) pair.
   *
   * @param titleTF     - term occurrences in title
   * @param contentTF   - term occurrences in content
   * @param docLength   - document length in tokens
   * @param avgDocLength - corpus average document length
   * @param totalDocs   - total documents in corpus
   * @param docFreq     - number of documents containing this term
   */
  scoreTerm(
    titleTF: number,
    contentTF: number,
    docLength: number,
    avgDocLength: number,
    totalDocs: number,
    docFreq: number
  ): number {
    const { k1, b } = this.params;
    const idf = this.idf(totalDocs, docFreq);
    const tf = this.weightedTF(titleTF, contentTF);

    // Length normalization factor
    // When b=0: no normalization (length doesn't matter)
    // When b=1: full normalization (long docs heavily penalized)
    const normFactor = 1 - b + b * (docLength / avgDocLength);

    // BM25 term score
    const tfNormalized = (tf * (k1 + 1)) / (tf + k1 * normFactor);

    return idf * tfNormalized;
  }

  /**
   * Compute total BM25 score for a document given multiple query terms.
   * Score is the sum of per-term scores (standard BM25).
   */
  scoreDocument(
    termScores: number[]
  ): number {
    return termScores.reduce((sum, s) => sum + s, 0);
  }
}

export const bm25Scorer = new BM25Scorer();