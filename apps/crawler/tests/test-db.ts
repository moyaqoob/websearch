import { db } from "../database/db";


function runTest() {
  try {
    console.log("DB path opened successfully");

    // check tables
    const tables = db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table'`)
      .all();

    console.log("Tables:", tables);

    // insert test row
    const insert = db.prepare(`
      INSERT INTO articles (
        id,
        url,
        url_normalized,
        domain,
        title,
        snippet,
        content,
        word_count,
        crawl_timestamp,
        quality_score,
        readability_score,
        authority_score,
        freshness_score,
        popularity_score,
        content_hash
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
      )
      `);
      
      insert.run(
        crypto.randomUUID(),
        "https://example.com",
        "https://example.com",
        "example.com",
        "Example Title",
        "Example snippet",
        "Example content",
        10,
        new Date().toISOString(),
        0,
        0,
        0,
        0,
        0,
        "hash123"
      );
//     console.log("Insert success");
//     const schema = db.prepare(`PRAGMA table_info(articles)`).all();
// console.log(schema);

    // read rows
    const rows = db.prepare(`SELECT * FROM articles; `).all();
    db.prepare("DELETE FROM articles WHERE id != (SELECT id FROM articles ORDER BY id LIMIT 1);")

    console.log("Queue rows:", rows);

  } catch (err) {
    console.error("DB test failed:", err);
  }
}

runTest();