import Database from "bun:sqlite";
import { D2Client } from "../indexer/client";
import type { IndexedArticle, ResultArticle } from "../types/utils";

const LOCAL_DB_PATH = "./data/search-engine.db";
const BATCH_SIZE = 50;

async function migrateArticles() {
  const localDb = new Database(LOCAL_DB_PATH, { readonly: true });
  const d1 = new D2Client();

  console.log("[Migration] Fetching indexed articles...");

  const rows = localDb.prepare(`
    SELECT
      a.id,
      a.url,
      a.url_normalized,
      a.domain,
      a.title,
      a.content,
      a.content_hash,
      a.is_indexed,
      a.crawl_timestamp,
      a.published_date,
      s.quality_score,
      s.readability_score,
      s.authority_score,
      s.freshness_score,
      s.popularity_score,
      s.computed_at
    FROM articles a
    LEFT JOIN signals s ON s.article_id = a.id
    WHERE a.is_indexed = 1
  `).all() as ResultArticle[];

  console.log(`[Migration] Found ${rows.length} indexed articles`);

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const articleStatements = batch.map(row => ({
      sql: `
        INSERT OR REPLACE INTO articles (
          id, url, url_normalized, domain, title, content,
          content_hash, is_indexed, crawl_timestamp, published_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        row.id,
        row.url,
        row.url_normalized,
        row.domain,
        row.title,
        row.content,
        row.content_hash,
        row.is_indexed,
        row.crawl_timestamp,
        row.published_date,
      ],
    }));

    const signalStatements = batch.map(row => ({
      sql: `
        INSERT OR REPLACE INTO signals (
          article_id,
          quality_score,
          readability_score,
          authority_score,
          freshness_score,
          popularity_score,
          computed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      params: [
        row.id,
        row.quality_score ?? 0,
        row.readability_score ?? 0,
        row.authority_score ?? 0,
        row.freshness_score ?? 0,
        row.popularity_score ?? 0,
        row.computed_at ?? null,
      ],
    }));

    try {
      await d1.batch([...articleStatements, ...signalStatements]);
      console.log(`[Migration] Inserted ${i + batch.length}/${rows.length}`);
    } catch (err) {
      console.error("[Migration] Batch failed:", err);
      throw err;
    }
  }

  console.log("[Migration] Done ✅");
}

migrateArticles().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
