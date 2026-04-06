import { DB_PATH } from "./types/config";

// src/index.ts
import { Database } from "bun:sqlite";
import { Indexer } from "./indexer/indexer.ts";
import { INDEX_SCHEMA_SQL } from "./shared/schema.ts";
import { ensureDbPresent } from "./shared/ensure-db.ts";

await ensureDbPresent();

const db = new Database(DB_PATH);
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA temp_store = FILE"); // use file-based temp, not memory
db.run('PRAGMA temp_store_directory = "E:\\\\temp"'); // point it at E: drive
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
