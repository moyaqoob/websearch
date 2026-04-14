import path from "path";

export const DB_PATH = process.env.DB_PATH
  ?? path.join(import.meta.dir, "..", "data", "search-engine.db");
