import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDbPath = path.join(__dirname, "..", "data", "search-engine.db");

/** Railway/Docker: set `DB_PATH` (e.g. `/data/search-engine.db`). */
export const DB_PATH = process.env.DB_PATH?.trim() || defaultDbPath;
