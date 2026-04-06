import express, {type Request,type Response } from 'express';
import Database from 'bun:sqlite';
import { Indexer } from './indexer/indexer';
import { QueryEngine } from './query/query-engine';
import { INDEX_SCHEMA_SQL } from './shared/schema';
import { DB_PATH } from './types/config';
import { ensureDbPresent } from './shared/ensure-db';

const PORT    = Number(process.env.PORT ?? 3000);

await ensureDbPresent();
const db = new Database(DB_PATH);
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA cache_size = -65536');
db.run('PRAGMA foreign_keys = ON');
db.exec(INDEX_SCHEMA_SQL)

const queryEngine = new QueryEngine(db);

console.log(`[API] Connected to ${DB_PATH}`);
console.log(`[API] Index health:`, queryEngine.healthCheck());

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get('/search', (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  console.log("query",q)
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }

  const limit   = clamp(Number(req.query.limit  ?? 10), 1, 50);
  const offset  = clamp(Number(req.query.offset ?? 0),  0, 1000);
  const explain = req.query.explain === 'true';

  const results = queryEngine.search(q, { limit, offset, explain });

  res.json({
    query:   q,
    total:   results.length,
    results: results.map(r => ({
      title:   r.title,
      url:     r.url,
      snippet: r.snippet,
      date:    r.published_date ?? undefined,
      score:   Number(r.final_score.toFixed(4)),
      ...(explain ? { breakdown: r.scores } : {}),
    })),
  });
});

app.get('/health', (_req: Request, res: Response) => {
  res.json(queryEngine.healthCheck());
});

app.listen(PORT, () => {
  console.log(`[API] Listening on http://localhost:${PORT}`)
});

function clamp(n: number, min: number, max: number): number {
  return Number.isNaN(n) ? min : Math.min(Math.max(n, min), max)
}
