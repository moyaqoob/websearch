import { tmpdir } from "node:os";
import { DB_PATH } from "./types/config";

// src/index.ts
import { Database } from "bun:sqlite";
import { Indexer } from "./indexer/indexer.ts";
import { INDEX_SCHEMA_SQL } from "./shared/schema.ts";
import { ensureDbPresent } from "./shared/ensure-db.ts";

await ensureDbPresent();

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA temp_store = FILE");
if (process.platform === "win32") {
  const dir = tmpdir().replace(/\\/g, "/");
  db.run(`PRAGMA temp_store_directory = '${dir}'`);
}
db.run("PRAGMA cache_size = -65536");
db.run("PRAGMA foreign_keys = ON");
db.run(INDEX_SCHEMA_SQL);

const indexer = new Indexer(db);

console.log("[Indexer] Starting...");
const result = await indexer.indexAll();
console.log(
  `[Indexer] Done. ${result.articles_indexed} indexed, ${result.errors.length} errors in ${result.duration_ms}ms`,
);

db.close();
