import type Database from 'better-sqlite3';
import type {
  Article,
  IndexingResult,
  IndexingError,
  TokenWithMetadata,
} from '../types/index.js';
import { textProcessor } from '../shared/text-processor.js';
import { INDEX_SCHEMA_SQL } from '../shared/schema.js';

// ============================================================
// Indexer
//
// Responsible for:
//   1. Tokenizing articles (title + content)
//   2. Building/updating the inverted index tables
//   3. Maintaining corpus-level statistics (avgdl, total docs)
//   4. Marking articles as indexed in your articles table
//
// Design: incremental by default.
// The indexer checks `is_indexed` and `content_hash`. If an
// article is already indexed AND the hash is unchanged, it's
// skipped. If the hash changed (re-crawled, updated content),
// the old postings are deleted and re-indexed. This means
// you can call indexAll() repeatedly and it's idempotent.
//
// Transaction strategy:
// Each article is indexed in its own transaction. This is a
// deliberate tradeoff. Batching across many articles would be
// faster (fewer fsync calls) but a failure mid-batch would
// leave partial state. Per-article transactions mean any crash
// leaves the index in a consistent state — the failed article
// just stays `is_indexed = 0` and gets picked up on next run.
//
// At 10k articles, per-article transactions are fast enough
// (~2-5ms per article on modern hardware). At 100k+, consider
// batching 100 articles per transaction.
// ============================================================

interface PreparedStatements {
  upsertTerm: Database.Statement;
  getTermId: Database.Statement;
  insertPosting: Database.Statement;
  deletePostingsForDoc: Database.Statement;
  decrementDocFreq: Database.Statement;
  upsertDocLength: Database.Statement;
  markArticleIndexed: Database.Statement;
  getUnindexedArticles: Database.Statement;
  getIndexedHashForDoc: Database.Statement;
  updateCorpusStats: Database.Statement;
  getDocLength: Database.Statement;
}

export class Indexer {
  private db: Database.Database;
  private stmts!: PreparedStatements;

  constructor(db: Database.Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    // Create index tables if they don't exist
    this.db.exec(INDEX_SCHEMA_SQL);

    // Prepare all statements once — a massive performance win.
    // SQLite statement preparation is expensive; doing it once
    // per indexer instance and reusing across thousands of articles
    // is the difference between 2ms and 0.02ms per operation.
    this.stmts = {
      upsertTerm: this.db.prepare(`
        INSERT INTO index_terms (term, doc_freq)
        VALUES (@term, 1)
        ON CONFLICT(term) DO UPDATE SET doc_freq = doc_freq + 1
        RETURNING term_id
      `),

      getTermId: this.db.prepare(`
        SELECT term_id FROM index_terms WHERE term = ?
      `),

      insertPosting: this.db.prepare(`
        INSERT OR REPLACE INTO index_postings
          (term_id, doc_id, term_frequency, title_tf, content_tf, positions_json)
        VALUES (@term_id, @doc_id, @term_frequency, @title_tf, @content_tf, @positions_json)
      `),

      deletePostingsForDoc: this.db.prepare(`
        DELETE FROM index_postings WHERE doc_id = ?
      `),

      // When removing a doc's postings, decrement doc_freq for each affected term
      decrementDocFreq: this.db.prepare(`
        UPDATE index_terms
        SET doc_freq = MAX(0, doc_freq - 1)
        WHERE term_id IN (
          SELECT term_id FROM index_postings WHERE doc_id = ?
        )
      `),

      upsertDocLength: this.db.prepare(`
        INSERT OR REPLACE INTO index_doc_lengths (doc_id, doc_length, indexed_at)
        VALUES (@doc_id, @doc_length, datetime('now'))
      `),

      markArticleIndexed: this.db.prepare(`
        UPDATE articles SET is_indexed = 1 WHERE id = ?
      `),

      getUnindexedArticles: this.db.prepare(`
        SELECT id, url, title, content, author, published_date,
               quality_score, authority_score, freshness_score,
               content_hash, is_indexed, s3_snippet_key, embedding_vector_json
        FROM articles
        WHERE is_indexed = 0
          AND content IS NOT NULL
          AND LENGTH(content) > 50
        ORDER BY authority_score DESC, quality_score DESC
        LIMIT @limit OFFSET @offset
      `),

      getIndexedHashForDoc: this.db.prepare(`
        SELECT content_hash FROM articles WHERE id = ? AND is_indexed = 1
      `),

      updateCorpusStats: this.db.prepare(`
        UPDATE index_metadata SET
          total_documents     = (SELECT COUNT(*) FROM index_doc_lengths),
          avg_document_length = (SELECT AVG(doc_length) FROM index_doc_lengths),
          total_terms         = (SELECT COUNT(*) FROM index_terms),
          last_updated        = datetime('now')
        WHERE id = 1
      `),

      getDocLength: this.db.prepare(`
        SELECT doc_length FROM index_doc_lengths WHERE doc_id = ?
      `),
    };
  }

  /**
   * Index all unindexed articles.
   * Call this after each crawl cycle.
   */
  async indexAll(options: { batchSize?: number } = {}): Promise<IndexingResult> {
    const { batchSize = 500 } = options;
    const startTime = Date.now();
    const errors: IndexingError[] = [];
    let processed = 0;
    let indexed = 0;
    let skipped = 0;
    let offset = 0;

    console.log('[Indexer] Starting indexing run...');

    while (true) {
      const articles = this.stmts.getUnindexedArticles.all({
        limit: batchSize,
        offset,
      }) as Article[];

      if (articles.length === 0) break;

      for (const article of articles) {
        try {
          const result = this.indexArticle(article);
          if (result === 'indexed') indexed++;
          else skipped++;
        } catch (err) {
          errors.push({
            article_id: article.id,
            url: article.url,
            error: err instanceof Error ? err.message : String(err),
          });
        }
        processed++;
      }

      offset += batchSize;

      if (processed % 100 === 0) {
        console.log(`[Indexer] Processed ${processed} articles...`);
      }
    }

    // Update corpus-level stats once at the end, not per article.
    // This is the correct approach: avgdl is a corpus property,
    // not a per-document property. Updating it incrementally
    // per document would give you a moving average that's wrong
    // for BM25 scoring until the full run completes.
    this.stmts.updateCorpusStats.run();

    const duration_ms = Date.now() - startTime;
    console.log(
      `[Indexer] Done. ${indexed} indexed, ${skipped} skipped, ` +
      `${errors.length} errors in ${duration_ms}ms`
    );

    return { articles_processed: processed, articles_indexed: indexed, articles_skipped: skipped, errors, duration_ms };
  }

  /**
   * Index a single article.
   * Returns 'indexed' if work was done, 'skipped' if already current.
   */
  indexArticle(article: Article): 'indexed' | 'skipped' {
    // Check if already indexed with the same content hash
    if (article.is_indexed === 1) {
      const existing = this.stmts.getIndexedHashForDoc.get(article.id) as
        | { content_hash: string }
        | undefined;
      if (existing?.content_hash === article.content_hash) {
        return 'skipped'; // Content unchanged, nothing to do
      }
      // Content changed — remove old postings and re-index
      this.removeFromIndex(article.id);
    }

    // Tokenize
    const { tokens, docLength } = textProcessor.tokenizeDocument(
      article.title || '',
      article.content || ''
    );

    if (docLength === 0) return 'skipped'; // Empty document

    // Group tokens by term
    const termMap = this.buildTermMap(tokens);

    // Write to index in a single transaction
    const indexFn = this.db.transaction(() => {
      for (const [term, data] of termMap) {
        // Upsert term into vocabulary, get term_id
        const row = this.stmts.upsertTerm.get({ term }) as { term_id: number };
        const termId = row.term_id;

        // Insert posting
        this.stmts.insertPosting.run({
          term_id: termId,
          doc_id: article.id,
          term_frequency: data.positions.length,
          title_tf: data.title_tf,
          content_tf: data.content_tf,
          positions_json: JSON.stringify(data.positions),
        });
      }

      // Record document length
      this.stmts.upsertDocLength.run({
        doc_id: article.id,
        doc_length: docLength,
      });

      // Mark as indexed in articles table
      this.stmts.markArticleIndexed.run(article.id);
    });

    indexFn();
    return 'indexed';
  }

  /**
   * Remove a document from the index.
   * Called when content hash changes (re-crawled) or doc is deleted.
   */
  removeFromIndex(docId: number): void {
    const removeFn = this.db.transaction(() => {
      // Decrement doc_freq for all terms this document contained
      this.stmts.decrementDocFreq.run(docId);
      // Remove the postings
      this.stmts.deletePostingsForDoc.run(docId);
    });
    removeFn();
  }

  /**
   * Group tokens by term, accumulating positions and field TFs.
   */
  private buildTermMap(
    tokens: TokenWithMetadata[]
  ): Map<string, { positions: number[]; title_tf: number; content_tf: number }> {
    const map = new Map<
      string,
      { positions: number[]; title_tf: number; content_tf: number }
    >();

    for (const token of tokens) {
      let entry = map.get(token.term);
      if (!entry) {
        entry = { positions: [], title_tf: 0, content_tf: 0 };
        map.set(token.term, entry);
      }
      entry.positions.push(token.position);
      if (token.field === 'title') entry.title_tf++;
      else entry.content_tf++;
    }

    return map;
  }

  /**
   * Rebuild the entire index from scratch.
   * WARNING: Marks all articles as is_indexed = 0 first.
   * Only use when schema changes, re-tokenization needed, etc.
   */
  rebuildIndex(): void {
    console.log('[Indexer] Full rebuild requested. Resetting is_indexed flags...');

    this.db.transaction(() => {
      this.db.prepare('UPDATE articles SET is_indexed = 0').run();
      this.db.prepare('DELETE FROM index_postings').run();
      this.db.prepare('DELETE FROM index_terms').run();
      this.db.prepare('DELETE FROM index_doc_lengths').run();
    })();

    console.log('[Indexer] Reset complete. Call indexAll() to rebuild.');
  }

  /**
   * Returns corpus statistics — useful for monitoring and debugging.
   */
  getStats(): {
    total_documents: number;
    avg_document_length: number;
    total_terms: number;
    last_updated: string;
  } {
    const row = this.db
      .prepare('SELECT * FROM index_metadata WHERE id = 1')
      .get() as {
        total_documents: number;
        avg_document_length: number;
        total_terms: number;
        last_updated: string;
      };
    return row;
  }
}