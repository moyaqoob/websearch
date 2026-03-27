import Database from "bun:sqlite";
import { textProcessor } from "../shared/text-processor.ts";
import type {
  ArticleRow,
  CorpusStats,
  IndexedArticle,
  PostingRow,
  QueryOptions,
  ScoreBreakdown,
  SearchResult,
} from "../types/utils.ts";
import { DEFAULT_BM25_PARAMS, DEFAULT_WEIGHTS } from "../types/utils.ts";
import { BM25Scorer } from "./bm25.ts";
import { ScoreNormalizer, type RawCandidateScore } from "./normalizer.ts";

export type Statement = ReturnType<Database["query"]>;

export class QueryEngine {
  private db: Database;
  private bm25: BM25Scorer;
  private normalizer: ScoreNormalizer;

  private stmtCorpusStats: Statement;
  private stmtPostingsForTerm: Statement;
  private stmtArticlesByIds: Statement;
  private stmtDocLength: Statement;

  constructor(db: Database) {
    this.db = db;
    this.bm25 = new BM25Scorer(DEFAULT_BM25_PARAMS);
    this.normalizer = new ScoreNormalizer();

    this.stmtCorpusStats = this.db.prepare(`
      SELECT total_documents, avg_document_length
      FROM index_metadata WHERE id = 1
    `);

    this.stmtPostingsForTerm = this.db.prepare(`
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
    `);

    this.stmtArticlesByIds = this.db.prepare(`
      SELECT 
        a.id,
        a.url,
        a.title,
        a.content,
        a.published_date,
        s.quality_score,
        s.authority_score,
        s.freshness_score
      FROM articles a
      LEFT JOIN signals s ON s.article_id = a.id
      WHERE a.id IN (SELECT value FROM json_each(?))
    `);

    this.stmtDocLength = this.db.prepare(`
      SELECT doc_length FROM index_doc_lengths WHERE doc_id = ?
    `);
  }

  /**
   * Execute a search query and return ranked results.
   *
   * @param query   - Raw query string from the user
   * @param options - Filtering, pagination, weight overrides
   */
  search(query: string, options: QueryOptions = {}): SearchResult[] {
    const {
      limit = 10,
      offset = 0,
      min_quality,
      min_authority,
      date_after,
      weights = DEFAULT_WEIGHTS,
      explain = false,
    } = options;

    // Step 1: Tokenize query
    const queryTerms = textProcessor.tokenizeQuery(query);

    if (queryTerms.length === 0) {
      console.warn(
        "[QueryEngine] Query produced no tokens after processing:",
        query,
      );
      return [];
    }

    // Step 2: Fetch corpus stats
    const stats = this.stmtCorpusStats.get() as CorpusStats | undefined;
    if (!stats || stats.total_documents === 0) {
      console.warn(
        "[QueryEngine] No indexed documents found. Run the indexer first.",
      );
      return [];
    }

    // Step 3 & 4: Fetch posting lists and accumulate BM25 scores
    // docScores: docId → accumulated BM25 score across all query terms
    const docScores = new Map<number, number>();

    for (const term of queryTerms) {
      const postings = this.stmtPostingsForTerm.all(term) as PostingRow[];

      for (const posting of postings) {
        const termScore = this.bm25.scoreTerm(
          posting.title_tf,
          posting.content_tf,
          posting.doc_length,
          stats.avg_document_length,
          stats.total_documents,
          posting.doc_freq,
        );

        // Accumulate score across query terms (standard BM25 for multi-term)
        docScores.set(
          posting.doc_id,
          (docScores.get(posting.doc_id) ?? 0) + termScore,
        );
      }
    }

    if (docScores.size === 0) {
      return []; // No documents match any query term
    }

    // Step 5: Fetch article metadata for all candidate docs
    const candidateIds = [...docScores.keys()];
    const articles = this.fetchArticles(candidateIds);
    const articleMap = new Map<number, ArticleRow>(
      articles.map((a) => [a.id, a])
    );

    // Step 6: Apply pre-normalization filters and build candidates
    const rawCandidates: RawCandidateScore[] = [];

    for (const [docId, bm25Raw] of docScores) {
      const article = articleMap.get(docId);
      if (!article) continue; // Stale index entry — article was deleted

      // Filters
      if (min_quality !== undefined && article.quality_score < min_quality)
        continue;
      if (
        min_authority !== undefined &&
        article.authority_score < min_authority
      )
        continue;
      if (date_after && article.published_date) {
        if (new Date(article.published_date) < new Date(date_after)) continue;
      }

      rawCandidates.push({
        article_id: article.id,
        url: article.url,
        title: article.title,
        content: article.content,
        published_date: article.published_date,
        bm25_raw: bm25Raw,
        quality_score: article.quality_score,
        authority_score: article.authority_score,
        freshness_score: article.freshness_score,
      });
    }

    if (rawCandidates.length === 0) return [];

    // Step 7: Normalize BM25 within candidate set
    const normalized = this.normalizer.normalize(rawCandidates);

    // Step 8: Compute final fused scores
    const scored = normalized.map((c) => ({
      candidate: c,
      finalScore: this.normalizer.fuse(c, weights),
    }));

    // Step 9: Sort descending by final score
    scored.sort((a, b) => b.finalScore - a.finalScore);

    // Step 10: Slice to page, extract snippets, build results
    const page = scored.slice(offset, offset + limit);

    return page.map(({ candidate: c, finalScore }) => {
      const snippet = textProcessor.extractSnippet(c.content, queryTerms);

      const scores: ScoreBreakdown = {
        bm25_raw: c.bm25_raw,
        bm25_normalized: c.bm25_normalized,
        quality_score: c.quality_score,
        authority_score: c.authority_score,
        freshness_score: c.freshness_decayed,
        final: finalScore,
      };

      return {
        article_id: c.article_id,
        url: c.url,
        title: c.title,
        snippet,
        published_date: c.published_date,
        scores: explain ? scores : { ...scores }, // always include when explain=true
        final_score: finalScore,
      };
    });
  }

  /**
   * Fetch articles for a list of IDs using SQLite's json_each trick.
   * This avoids building a dynamic IN clause with string interpolation
   * (a SQL injection risk) while still fetching all articles in one query.
   */
  private fetchArticles(ids: number[]): ArticleRow[] {
    if (ids.length === 0) return [];
    return this.stmtArticlesByIds.all(JSON.stringify(ids)) as ArticleRow[];
  }

  /**
   * Suggest related queries based on co-occurring terms in the index.
   * Simple but effective: find terms that frequently appear alongside
   * the query terms.
   *
   * This is a good starting point. Production search engines use
   * query logs and click data for this — which you'll have eventually.
   */
  suggest(query: string, limit: number = 5): string[] {
    const queryTerms = textProcessor.tokenizeQuery(query);
    if (queryTerms.length === 0) return [];

    // Find docs that match the query, then find other high-IDF terms in those docs
    const matchingDocIds = new Set<number>();
    for (const term of queryTerms) {
      const postings = this.stmtPostingsForTerm.all(term) as PostingRow[];
      postings.forEach((p) => matchingDocIds.add(p.doc_id));
    }

    if (matchingDocIds.size === 0) return [];

    // Find other terms in these docs (exclude query terms themselves)
    const coTermFreq = new Map<string, number>();
    const stats = this.stmtCorpusStats.get() as CorpusStats;

    for (const docId of matchingDocIds) {
      const terms = this.db
        .prepare(
          `
          SELECT t.term, t.doc_freq
          FROM index_postings p
          JOIN index_terms t ON t.term_id = p.term_id
          WHERE p.doc_id = ?
        `,
        )
        .all(docId) as { term: string; doc_freq: number }[];

      for (const { term, doc_freq } of terms) {
        if (queryTerms.includes(term)) continue;
        // Weight by IDF — prefer discriminative terms, not "the", "and" equivalents
        const idf = this.bm25.idf(stats.total_documents, doc_freq);
        if (idf < 0.5) continue; // Skip near-stopword terms
        coTermFreq.set(term, (coTermFreq.get(term) ?? 0) + idf);
      }
    }

    return [...coTermFreq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([term]) => term);
  }

  /**
   * Get index health metrics.
   * Useful for monitoring: are docs being indexed? Is the index stale?
   */
  healthCheck(): {
    indexed_docs: number;
    avg_doc_length: number;
    vocabulary_size: number;
    last_updated: string;
    unindexed_docs: number;
  } {
    const meta = this.db
      .prepare("SELECT * FROM index_metadata WHERE id = 1")
      .get() as {
      total_documents: number;
      avg_document_length: number;
      total_terms: number;
      last_updated: string;
    };

    const unindexed = this.db
      .prepare("SELECT COUNT(*) as count FROM articles WHERE is_indexed = 0")
      .get() as { count: number };

    return {
      indexed_docs: meta.total_documents,
      avg_doc_length: Math.round(meta.avg_document_length),
      vocabulary_size: meta.total_terms,
      last_updated: meta.last_updated,
      unindexed_docs: unindexed.count,
    };
  }
}
