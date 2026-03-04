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
      INSERT OR IGNORE INTO queue(url)
      VALUES (?)
    `);

    insert.run("https://example.com");

    console.log("Insert success");

    // read rows
    const rows = db.prepare(`SELECT * FROM queue`).all();

    console.log("Queue rows:", rows);

  } catch (err) {
    console.error("DB test failed:", err);
  }
}

runTest();