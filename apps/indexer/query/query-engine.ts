import { textProcessor } from '../shared/text-processor.ts';
import type {
  ArticleRow,
  IndexMetadata,
  PostingRow,
  QueryOptions,
  ScoreBreakdown,
  SearchResult,
} from '../types/utils.ts';
import { DEFAULT_BM25_PARAMS, DEFAULT_WEIGHTS } from '../types/utils.ts';
import { BM25Scorer } from './bm25.ts';
import { ScoreNormalizer, type RawCandidateScore } from './normalizer.ts';
import  { D1Client,D2Client } from '../indexer/client.ts';

export class QueryEngine {
  private bm25: BM25Scorer;
  private normalizer: ScoreNormalizer;
  private d1:D1Client
  private d2:D2Client;

  constructor() {
    this.d1 =new D1Client();
    this.d2 = new D2Client();
    this.bm25 = new BM25Scorer(DEFAULT_BM25_PARAMS);
    this.normalizer = new ScoreNormalizer();
  }

  async search(query: string, options: QueryOptions = {}): Promise<SearchResult[]> {
    const {
      limit = 10,
      offset = 0,
      min_quality,
      min_authority,
      date_after,
      weights = DEFAULT_WEIGHTS,
      explain = false,
    } = options;

    // Step 1: Tokenize — same as local, pure computation
    const queryTerms = textProcessor.tokenizeQuery(query);
    if (queryTerms.length === 0) {
      console.warn('[D1QueryEngine] Query produced no tokens:', query);
      return [];
    }

    const statsResult = await this.d1.query(
      'SELECT total_documents, avg_document_length FROM index_metadata WHERE id = 1'
    )

    const stats = statsResult.results[0] as unknown as IndexMetadata | undefined;
    console.log("stats,statsResult",statsResult,stats)
    if (!stats || stats.total_documents === 0) {
      console.warn('[D1QueryEngine] No indexed documents found.');
      return [];
    }

    const postingResults = await this.d1.batch(
      queryTerms.map(term => ({
        sql: `
          SELECT
            p.doc_id,
            p.term_frequency,
            p.title_tf,
            p.content_tf,
            t.doc_freq,
            dl.doc_length
          FROM index_postings p
          JOIN index_terms t ON t.term_id = p.term_id
          JOIN index_doc_lengths dl ON dl.doc_id = p.doc_id
          WHERE t.term = ?
        `,
        params: [term],
      }))
    );

    // Step 4: Accumulate BM25 scores — identical math to local version
    const docScores = new Map<string, number>();
    for (const result of postingResults) {
      const postings = result.results as unknown as PostingRow[]
      for (const posting of postings) {
        const termScore = this.bm25.scoreTerm(
          posting.title_tf,
          posting.content_tf,
          posting.doc_length,
          stats.avg_document_length,
          stats.total_documents,
          posting.doc_freq
        )
        docScores.set(
          posting.doc_id,
          (docScores.get(posting.doc_id) ?? 0) + termScore
        )
      }
    }

    if (docScores.size === 0) return [];

    const candidateIds = [...docScores.keys()];
    const articleResult = await this.d2.query(
      `SELECT
        a.id, a.url, a.title, a.content, a.published_date,
        s.quality_score, s.authority_score, s.freshness_score
       FROM articles a
       LEFT JOIN signals s ON s.article_id = a.id
       WHERE a.id IN (SELECT value FROM json_each(?))`,
      [JSON.stringify(candidateIds)]
    )
    console.log("article result",articleResult)
    const articleMap = new Map<string, ArticleRow>(
      (articleResult.results as unknown as ArticleRow[]).map(a => [a.id, a])
    )

    // Step 6: Filter and build raw candidates
    const rawCandidates: RawCandidateScore[] = [];
    for (const [docId, bm25Raw] of docScores) {
      const article = articleMap.get(docId);
      if (!article) continue;

      if (min_quality  !== undefined && article.quality_score   < min_quality)  continue;
      if (min_authority !== undefined && article.authority_score < min_authority) continue;
      if (date_after && article.published_date) {
        if (new Date(article.published_date) < new Date(date_after)) continue;
      }

      rawCandidates.push({
        article_id:      docId,
        url:             article.url,
        title:           article.title,
        content:         article.content,
        published_date:  article.published_date,
        bm25_raw:        bm25Raw,
        quality_score:   article.quality_score,
        authority_score: article.authority_score,
        freshness_score: article.freshness_score,
      });
    }

    if (rawCandidates.length === 0) return [];

    const normalized = this.normalizer.normalize(rawCandidates);
    const scored = normalized
      .map(c => ({ c, final: this.normalizer.fuse(c, weights) }))
      .sort((a, b) => b.final - a.final)
      .slice(offset, offset + limit);

    return scored.map(({ c, final }) => {
      const snippet = textProcessor.extractSnippet(c.content, queryTerms);
      const scores: ScoreBreakdown = {
        bm25_raw:        c.bm25_raw,
        bm25_normalized: c.bm25_normalized,
        quality_score:   c.quality_score,
        authority_score: c.authority_score,
        freshness_score: c.freshness_decayed,
        final,
      }
      return {
        article_id:     c.article_id,
        url:            c.url,
        title:          c.title,
        snippet,
        published_date: c.published_date,
        scores:         explain ? scores : { ...scores },
        final_score:    final,
      };
    });
  }

  async suggest(query: string, limit: number = 6): Promise<string[]> {
    const queryTerms = textProcessor.tokenizeQuery(query);
    if (queryTerms.length === 0) return [];

    // Fetch matching doc IDs for all query terms in one batch
    const postingResults = await this.d1.batch(
      queryTerms.map(term => ({
        sql: `SELECT p.doc_id FROM index_postings p
              JOIN index_terms t ON t.term_id = p.term_id
              WHERE t.term = ?`,
        params: [term],
      }))
    );

    const matchingDocIds = new Set<string>();
    for (const result of postingResults) {
      (result.results as { doc_id: string }[]).forEach(r => matchingDocIds.add(r.doc_id));
    }

    if (matchingDocIds.size === 0) return [];

    const statsResult = await this.d1.query(
      'SELECT total_documents FROM index_metadata WHERE id = 1'
    );
    const stats = statsResult.results[0] as { total_documents: number };

    // Fetch co-occurring terms across all matching docs in one batch
    const termResults = await this.d1.batch(
      [...matchingDocIds].map(docId => ({
        sql: `SELECT t.term, t.doc_freq
              FROM index_postings p
              JOIN index_terms t ON t.term_id = p.term_id
              WHERE p.doc_id = ?`,
        params: [docId],
      }))
    );

    const coTermFreq = new Map<string, number>();
    for (const result of termResults) {
      for (const { term, doc_freq } of result.results as { term: string; doc_freq: number }[]) {
        if (queryTerms.includes(term)) continue;
        const idf = this.bm25.idf(stats.total_documents, doc_freq);
        if (idf < 0.5) continue;
        coTermFreq.set(term, (coTermFreq.get(term) ?? 0) + idf);
      }
    }

    return [...coTermFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }


}
