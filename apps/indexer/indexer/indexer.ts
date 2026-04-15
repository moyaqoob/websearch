import { D1Client } from './client.ts';
import { textProcessor } from '../shared/text-processor.ts';
import type { IndexedArticle, IndexingResult, IndexingError, TokenWithMetadata } from '../types/utils.ts';
import {Database} from "bun:sqlite"
// ── The indexer reads articles from local SQLite ──────────────
// ── and writes index tables to Cloudflare D1    ──────────────

export class Indexer {
  // D1 can enforce lower SQL variable caps than local SQLite.
  // Keep this conservative to avoid "too many SQL variables".
  private static readonly TERM_LOOKUP_CHUNK_SIZE = 50;
  private static readonly STATS_UPDATE_EVERY_BATCHES = 5;
  private localDb:Database;
  private d1: D1Client;

  constructor(localDb: Database, d1: D1Client) {
    this.localDb = localDb;
    this.d1 = d1;
  }

  async indexAll(options: { batchSize?: number; concurrency?: number } = {}): Promise<IndexingResult> {
    const { batchSize = 100, concurrency = 6 } = options;
    // D1 has rate limits — 100 per batch is safe
    const startTime = Date.now();
    const errors: IndexingError[] = [];
    let processed = 0, indexed = 0, skipped = 0, offset = 0;

    const { count } = this.localDb.prepare(`
      SELECT COUNT(*) as count
      FROM articles a
      JOIN signals s ON s.article_id = a.id
      WHERE a.is_indexed = 0
        AND a.content IS NOT NULL
        AND LENGTH(a.content) > 50
    `).get() as { count: number };

    if (count === 0) {
      console.log('[D1 Indexer] No unindexed articles found.');
      return { articles_processed: 0, articles_indexed: 0, articles_skipped: 0, errors: [], duration_ms: 0 };
    }

    console.log(`\n[D1 Indexer] Starting — ${count.toLocaleString()} articles to index into D1\n`);

    const getArticles = this.localDb.prepare(`
      SELECT
        a.id, a.url, a.url_normalized, a.domain,
        a.title, a.content, a.is_indexed,
        a.crawl_timestamp, a.published_date, a.content_hash,
        s.quality_score, s.authority_score, s.freshness_score
      FROM articles a
      JOIN signals s ON s.article_id = a.id
      WHERE a.is_indexed = 0
        AND a.content IS NOT NULL
        AND LENGTH(a.content) > 50
      ORDER BY s.authority_score DESC, s.quality_score DESC
      LIMIT ? OFFSET ?
    `);

    const markIndexed = this.localDb.prepare(`
      UPDATE articles SET is_indexed = 1 WHERE id = ?
    `);

    let batchNumber = 0;
    while (true) {
      const articles = getArticles.all(batchSize, offset) as IndexedArticle[];
      if (articles.length === 0) break;

      let nextIndex = 0;
      const workers = Array.from({ length: Math.min(concurrency, articles.length) }, async () => {
        while (true) {
          const currentIndex = nextIndex++;
          if (currentIndex >= articles.length) break;
          const article = articles[currentIndex];
          try {
            await this.indexArticle(article);
            markIndexed.run(article.id);
            indexed++;
            console.log(`  ✓ [${indexed + skipped}/${count}] ${article.url}`);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            errors.push({ article_id: article.id, url: article.url, error: message });
            console.log(`  ✗ [${processed + 1}/${count}] ERROR — ${article.url}`);
            console.log(`      ${message}`);
          }
          processed++;
        }
      });
      await Promise.all(workers);

      offset += batchSize;
      batchNumber++;

      // Updating stats every batch adds extra D1 writes and slows indexing.
      if (batchNumber % Indexer.STATS_UPDATE_EVERY_BATCHES === 0) {
        await this.updateCorpusStats();
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const rate = (processed / Number(elapsed)).toFixed(0);
      console.log(`\n[Batch] ${processed}/${count} done — ${rate} articles/sec — ${elapsed}s elapsed\n`);
    }

    // Ensure metadata is up-to-date when run completes.
    await this.updateCorpusStats();

    const duration_ms = Date.now() - startTime;
    console.log('─'.repeat(60));
    console.log(`[D1 Indexer] Complete`);
    console.log(`  Indexed  : ${indexed.toLocaleString()}`);
    console.log(`  Skipped  : ${skipped.toLocaleString()}`);
    console.log(`  Errors   : ${errors.length}`);
    console.log(`  Duration : ${(duration_ms / 1000).toFixed(2)}s`);
    console.log('─'.repeat(60));

    return { articles_processed: processed, articles_indexed: indexed, articles_skipped: skipped, errors, duration_ms };
  }

  private async indexArticle(article: IndexedArticle): Promise<void> {
    const { tokens, docLength } = textProcessor.tokenizeDocument(
      article.title || '',
      article.content || ''
    );

    if (docLength === 0) return;

    const termMap = this.buildTermMap(tokens);

    const statements: { sql: string; params: unknown[] }[] = [];

    for (const [term, data] of termMap) {
      statements.push({
        sql: `INSERT INTO index_terms (term, doc_freq)
              VALUES (?, 1)
              ON CONFLICT(term) DO UPDATE SET doc_freq = doc_freq + 1`,
        params: [term],
      })
    }

    // Execute term upserts
    if (statements.length > 0) {
      await this.d1.batch(statements);
    }

    const terms = [...termMap.keys()];
    const termRows: { term_id: number; term: string }[] = [];
    for (let i = 0; i < terms.length; i += Indexer.TERM_LOOKUP_CHUNK_SIZE) {
      const termChunk = terms.slice(i, i + Indexer.TERM_LOOKUP_CHUNK_SIZE);
      const placeholders = termChunk.map(() => '?').join(', ');
      const result = await this.d1.query(
        `SELECT term_id, term FROM index_terms WHERE term IN (${placeholders})`,
        termChunk
      )
      termRows.push(...(result.results as { term_id: number; term: string }[]));
    }

    const termIdMap = new Map(termRows.map(r => [r.term, r.term_id]));

    const postingStatements: { sql: string; params: unknown[] }[] = [];

    for (const [term, data] of termMap) {
      const termId = termIdMap.get(term);
      if (!termId) continue;

      postingStatements.push({
        sql: `INSERT OR REPLACE INTO index_postings
                (term_id, doc_id, term_frequency, title_tf, content_tf, positions_json)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          termId,
          article.id,
          data.positions.length,
          data.title_tf,
          data.content_tf,
          JSON.stringify(data.positions),
        ],
      });
    }

    // Insert doc length
    postingStatements.push({
      sql: `INSERT OR REPLACE INTO index_doc_lengths (doc_id, doc_length, indexed_at)
            VALUES (?, ?, datetime('now'))`,
      params: [article.id, docLength],
    });

    if (postingStatements.length > 0) {
      await this.d1.batch(postingStatements);
    }
  }

  private async updateCorpusStats(): Promise<void> {
    await this.d1.query(`
      UPDATE index_metadata SET
        total_documents     = (SELECT COUNT(*) FROM index_doc_lengths),
        avg_document_length = (SELECT COALESCE(AVG(doc_length), 0) FROM index_doc_lengths),
        total_terms         = (SELECT COUNT(*) FROM index_terms),
        last_updated        = datetime('now')
      WHERE id = 1
    `);
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
}
