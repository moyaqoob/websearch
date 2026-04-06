import type { Database } from 'bun:sqlite';
import type {
  IndexedArticle,
  IndexingResult,
  IndexingError,
  TokenWithMetadata,
} from '../types/utils.ts';
import { textProcessor } from '../shared/text-processor.ts';
import { INDEX_SCHEMA_SQL } from '../shared/schema.ts';
import type { Statement } from '../query/query-engine.ts';

interface PreparedStatements {
  upsertTerm: Statement;
  getTermId: Statement;
  insertPosting: Statement;
  deletePostingsForDoc: Statement;
  decrementDocFreq: Statement;
  upsertDocLength: Statement;
  markArticleIndexed: Statement;
  getUnindexedArticles: Statement;
  getIndexedHashForDoc: Statement;
  updateCorpusStats: Statement;
  getDocLength: Statement;
}


export class Indexer {
  private db: Database;
  private stmts!: PreparedStatements;

  constructor(db: Database) {
    this.db = db;
    this.initialize();
  }

  private initialize(): void {
    this.db.exec(INDEX_SCHEMA_SQL);

    this.stmts = {
      upsertTerm: this.db.prepare(`
        INSERT INTO index_terms (term, doc_freq)
        VALUES ($term, 1)
        ON CONFLICT(term) DO UPDATE SET doc_freq = doc_freq + 1
        RETURNING term_id
      `),

      getTermId: this.db.prepare(`
        SELECT term_id FROM index_terms WHERE term = ?
      `),

      insertPosting: this.db.prepare(`
        INSERT OR REPLACE INTO index_postings
          (term_id, doc_id, term_frequency, title_tf, content_tf, positions_json)
        VALUES ($term_id, $doc_id, $term_frequency, $title_tf, $content_tf, $positions_json)
      `),

      deletePostingsForDoc: this.db.prepare(`
        DELETE FROM index_postings WHERE doc_id = ?
      `),

      decrementDocFreq: this.db.prepare(`
        UPDATE index_terms
        SET doc_freq = MAX(0, doc_freq - 1)
        WHERE term_id IN (
          SELECT term_id FROM index_postings WHERE doc_id = ?
        )
      `),

      upsertDocLength: this.db.prepare(`
        INSERT OR REPLACE INTO index_doc_lengths (doc_id, doc_length, indexed_at)
        VALUES ($doc_id, $doc_length, datetime('now'))
      `),

      // ── your actual table and column names ──────────────────
      markArticleIndexed: this.db.prepare(`
        UPDATE articles SET is_indexed = 1 WHERE id = ?
      `),

      // JOIN articles with signals to get scores in one query
      getUnindexedArticles: this.db.prepare(`
        SELECT
          a.id, a.url, a.url_normalized, a.domain,
          a.title, a.content, a.is_indexed,
          a.crawl_timestamp, a.content_hash,
          s.quality_score, s.authority_score, s.freshness_score
        FROM articles a
        JOIN signals s ON s.article_id = a.id
        WHERE a.is_indexed = 0
        ORDER BY s.authority_score DESC, s.quality_score DESC
        LIMIT $limit OFFSET $offset
      `),

      getIndexedHashForDoc: this.db.prepare(`
        SELECT content_hash FROM articles WHERE id = ? AND is_indexed = 1
      `),

      updateCorpusStats: this.db.prepare(`
        UPDATE index_metadata SET
          total_documents     = (SELECT COUNT(*) FROM index_doc_lengths),
          avg_document_length = (SELECT COALESCE(AVG(doc_length), 0) FROM index_doc_lengths),
          total_terms         = (SELECT COUNT(*) FROM index_terms),
          last_updated        = datetime('now')
        WHERE id = 1
      `),

      getDocLength: this.db.prepare(`
        SELECT doc_length FROM index_doc_lengths WHERE doc_id = ?
      `),
    };
  }

  async indexAll(options: { batchSize?: number } = {}): Promise<IndexingResult> {
    const { batchSize = 5000 } = options;
    const startTime = Date.now();
    const errors: IndexingError[] = [];
    let processed = 0, indexed = 0, skipped = 0, offset = 0;

    // get total count upfront so we can show progress
    const total = (this.db.prepare(`
      SELECT COUNT(*) as count
      FROM articles a
      JOIN signals s ON s.article_id = a.id
      WHERE a.is_indexed = 0
        AND a.content IS NOT NULL
        AND LENGTH(a.content) > 50
    `).get() as { count: number }).count;

    if (total === 0) {
      console.log('[Indexer] No unindexed articles found.');
      return { articles_processed: 0, articles_indexed: 0, articles_skipped: 0, errors: [], duration_ms: 0 };
    }

    console.log(`\n[Indexer] Starting — ${total.toLocaleString()} articles to process\n`);

    while (true) {
      const articles = this.stmts.getUnindexedArticles.all({
        $limit: batchSize,
        $offset: offset,
      }) as IndexedArticle[];

      if (articles.length === 0) break;

      const batchNum = Math.floor(offset / batchSize) + 1;
      const totalBatches = Math.ceil(total / batchSize);
      console.log(`[Batch ${batchNum}/${totalBatches}] Processing ${articles.length} articles...`);

      for (const article of articles) {
        try {
          const result = this.indexArticle(article);
          if (result === 'indexed') {
            indexed++;
            console.log(`  ✓ [${indexed + skipped}/${total}] ${article.url}`);
          } else {
            skipped++;
            console.log(`  ○ [${indexed + skipped}/${total}] SKIPPED — ${article.url}`);
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors.push({ article_id: article.id, url: article.url, error: message });
          console.log(`  ✗ [${processed + 1}/${total}] ERROR — ${article.url}`);
          console.log(`      ${message}`);
        }
        processed++;
      }
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processed / Number(elapsed)).toFixed(0);
      console.log(`\n[Batch ${batchNum}/${totalBatches}] Done — ${indexed} indexed, ${skipped} skipped, ${errors.length} errors | ${rate} articles/sec | ${elapsed}s elapsed\n`);

      offset += batchSize;
    }

    this.stmts.updateCorpusStats.run();

    const duration_ms = Date.now() - startTime;

    console.log('─'.repeat(60));
    console.log(`[Indexer] Complete`);
    console.log(`  Total processed : ${processed.toLocaleString()}`);
    console.log(`  Indexed         : ${indexed.toLocaleString()}`);
    console.log(`  Skipped         : ${skipped.toLocaleString()}`);
    console.log(`  Errors          : ${errors.length}`);
    console.log(`  Duration        : ${(duration_ms / 1000).toFixed(2)}s`);
    console.log(`  Avg speed       : ${(processed / (duration_ms / 1000)).toFixed(0)} articles/sec`);
    console.log('─'.repeat(60));

    if (errors.length > 0) {
      console.log('\n[Indexer] Failed articles:');
      errors.forEach(e => console.log(`  ✗ ${e.url}\n    ${e.error}`));
    }

    return { articles_processed: processed, articles_indexed: indexed, articles_skipped: skipped, errors, duration_ms };
  }


  indexArticle(article: IndexedArticle): 'indexed' | 'skipped' {
    if (article.is_indexed === 1) {
      const existing = this.stmts.getIndexedHashForDoc.get(article.id) as
        | { content_hash: string } | undefined;
      if (existing?.content_hash === article.content_hash) return 'skipped';
      this.removeFromIndex(article.id);
    }

    const { tokens, docLength } = textProcessor.tokenizeDocument(
      article.title || '',
      article.content || ''
    );

    if (docLength === 0) return 'skipped';

    const termMap = this.buildTermMap(tokens);

    this.db.transaction(() => {
      for (const [term, data] of termMap) {
        const row = this.stmts.upsertTerm.get({ $term: term }) as { term_id: number };

        this.stmts.insertPosting.run({
          $term_id:        row.term_id,
          $doc_id:         article.id,   // string — bun:sqlite handles it fine
          $term_frequency: data.positions.length,
          $title_tf:       data.title_tf,
          $content_tf:     data.content_tf,
          $positions_json: JSON.stringify(data.positions),
        });
      }

      this.stmts.upsertDocLength.run({
        $doc_id:     article.id,
        $doc_length: docLength,
      });

      this.stmts.markArticleIndexed.run(article.id);
    })();

    return 'indexed';
  }

  removeFromIndex(docId: string): void {
    this.db.transaction(() => {
      this.stmts.decrementDocFreq.run(docId);
      this.stmts.deletePostingsForDoc.run(docId);
    })();
  }

  private buildTermMap(tokens: TokenWithMetadata[]) {
    const map = new Map<string, { positions: number[]; title_tf: number; content_tf: number }>();

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

  rebuildIndex(): void {
    console.log('[Indexer] Full rebuild — resetting flags...');
    this.db.transaction(() => {
      this.db.prepare('UPDATE articles SET is_indexed = 0').run();
      this.db.prepare('DELETE FROM index_postings').run();
      this.db.prepare('DELETE FROM index_terms').run();
      this.db.prepare('DELETE FROM index_doc_lengths').run();
    })();
    console.log('[Indexer] Reset complete. Call indexAll() to rebuild.');
  }

  getStats() {
    return this.db.prepare('SELECT * FROM index_metadata WHERE id = 1').get() as {
      total_documents: number;
      avg_document_length: number;
      total_terms: number;
      last_updated: string;
    };
  }
}
