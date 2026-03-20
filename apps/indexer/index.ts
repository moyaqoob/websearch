import { Database } from "bun:sqlite";
import { type ArticleRow } from "./services/fetcher";
import { Tokenizer } from "./services/tokenizer";
import { response } from "express";

const DB_PATH =
  process.env.INDEXER_DB_PATH ?? "../crawler/data/search-engine.db";

interface Posting {
  articleId: string;
  tf: number;
  positions: number[];
}

function initIndexSchema(db: Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS terms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      term TEXT UNIQUE NOT NULL
    )

    CREATE TABLE IF NOT EXISTS postings (
      term_id INTEGER NOT NULL,
      article_id TEXT NOT NULL,
      term_frequency REAL NOT NULL,
      tf_idf REAL NOT NULL DEFAULT 0,
      positions_json TEXT NOT NULL,
      field TEXT NOT NULL DEFAULT 'content',
      PRIMARY KEY (term_id, article_id, field),
      FOREIGN KEY (term_id) REFERENCES terms(id),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    )

    CREATE TABLE IF NOT EXISTS index_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )

    CREATE INDEX IF NOT EXISTS idx_postings_article ON postings(article_id);
    CREATE INDEX IF NOT EXISTS idx_postings_tfidf ON postings(tf_idf DESC);
    CREATE INDEX IF NOT EXISTS idx_terms_term ON terms(term);
  `);
}

function buildInvertedIndex(
  articles: ArticleRow[],
  tokenizer: Tokenizer,
): { termPostings: Map<string, Posting[]>; fieldTag: string } {
  const termPostings = new Map<string, Posting[]>();

  for (const article of articles) {
    const text = `${article.title} ${article.title} ${article.snippet} ${article.content}`;
    const tokens = tokenizer.tokenize(text);

    const termCounts = new Map<
      string,
      { count: number; positions: number[] }
    >();
    for (const { word, position } of tokens) {
      const entry = termCounts.get(word);
      if (entry) {
        entry.count++;
        entry.positions.push(position);
      } else {
        termCounts.set(word, { count: 1, positions: [position] });
      }
    }

    const totalTerms = tokens.length || 1;
    for (const [term, { count, positions }] of termCounts) {
      const tf = count / totalTerms;

      if (!termPostings.has(term)) {
        termPostings.set(term, []);
      }
      termPostings.get(term)!.push({
        articleId: article.id,
        tf,
        positions,
      });
    }
  }

  return { termPostings, fieldTag: "content" };
}

function computeTfIdf(
  termPostings: Map<string, Posting[]>,
  totalDocs: number,
): Map<
  string,
  { articleId: string; tf: number; tfIdf: number; positions: number[] }[]
> {
  const result = new Map<
    string,
    { articleId: string; tf: number; tfIdf: number; positions: number[] }[]
  >();

  for (const [term, postings] of termPostings) {
    const df = postings.length;
    const idf = Math.log(1 + totalDocs / (1 + df));

    result.set(
      term,
      postings.map((p) => ({
        articleId: p.articleId,
        tf: p.tf,
        tfIdf: p.tf * idf,
        positions: p.positions,
      })),
    );
  }

  return result;
}

function persistIndex(
  db: Database,
  scored: Map<
    string,
    { articleId: string; tf: number; tfIdf: number; positions: number[] }[]
  >,
  field: string,
) {
  const getTermId = db.prepare(
    `INSERT INTO terms (term) VALUES (?) ON CONFLICT(term) DO UPDATE SET term=term RETURNING id`,
  );
  const insertPosting = db.prepare(`
    INSERT INTO postings (term_id, article_id, term_frequency, tf_idf, positions_json, field)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(term_id, article_id, field) DO UPDATE SET
      term_frequency = excluded.term_frequency,
      tf_idf = excluded.tf_idf,
      positions_json = excluded.positions_json
  `);

  const tx = db.transaction(() => {
    for (const [term, postings] of scored) {
      const row = getTermId.get(term) as { id: number };
      const termId = row.id;

      for (const p of postings) {
        insertPosting.run(
          termId,
          p.articleId,
          p.tf,
          p.tfIdf,
          JSON.stringify(p.positions),
          field,
        );
      }
    }
  });

  tx();
}

function updateMeta(db: Database, totalDocs: number, totalTerms: number) {
  const upsert = db.prepare(
    `INSERT INTO index_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  const tx = db.transaction(() => {
    upsert.run("total_documents", String(totalDocs));
    upsert.run("total_terms", String(totalTerms));
    upsert.run("last_indexed_at", new Date().toISOString());
  });
  tx();
}

// async function main() {
//   console.log("\n" + "=".repeat(70));
//   console.log("INDEXER - BUILDING INVERTED INDEX");
//   console.log("=".repeat(70));

//   const db = new Database(DB_PATH);
//   db.exec("PRAGMA journal_mode = WAL;");
//   db.exec("PRAGMA foreign_keys = ON;");

//   initIndexSchema(db);

//   const fetcher = new Fetcher(db);
//   const tokenizer = new Tokenizer();

//   const totalArticles = fetcher.countTotal();
//   const unindexedCount = fetcher.countUnindexed();

//   console.log(`Total articles in DB : ${totalArticles}`);
//   console.log(`Un-indexed articles  : ${unindexedCount}`);

//   if (unindexedCount === 0) {
//     console.log("\nNothing to index. Exiting.");
//     db.close();
//     return;
//   }

//   const BATCH_SIZE = 500;
//   let processed = 0;
//   let batchNum = 0;

//   while (true) {
//     const articles = fetcher.fetchUnindexed(BATCH_SIZE);
//     if (articles.length === 0) break;

//     batchNum++;
//     console.log(`\nBatch ${batchNum}: indexing ${articles.length} articles...`);

//     const totalDocsForIdf = totalArticles;

//     const { termPostings, fieldTag } = buildInvertedIndex(articles, tokenizer);
//     console.log(`  Unique terms extracted: ${termPostings.size}`);

//     const scored = computeTfIdf(termPostings, totalDocsForIdf);

//     persistIndex(db, scored, fieldTag);
//     console.log(`  Postings written to DB`);

//     const ids = articles.map((a) => a.id);
//     fetcher.markIndexed(ids);
//     console.log(`  Marked ${ids.length} articles as indexed`);

//     processed += articles.length;
//   }

//   updateMeta(db, totalArticles, processed);

//   const termCount = (db.prepare(`SELECT COUNT(*) as cnt FROM terms`).get() as { cnt: number }).cnt;
//   const postingCount = (db.prepare(`SELECT COUNT(*) as cnt FROM postings`).get() as { cnt: number }).cnt;

//   console.log(`\n${"=".repeat(70)}`);
//   console.log(`INDEXING COMPLETE`);
//   console.log(`  Articles indexed : ${processed}`);
//   console.log(`  Unique terms     : ${termCount}`);
//   console.log(`  Total postings   : ${postingCount}`);
//   console.log("=".repeat(70));

//   db.close();
// }

async function main() {
  const res = await fetch("https://redis.io/blog",{
    headers:{
      "User-Agent": "Mozilla/5.0 (X11; Fedora; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.199 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      Connection: "keep-alive",
    },
    redirect:"follow"
    
  });
  const html =  await res.text()
  console.log( html.length);
}
main().catch(console.error);
