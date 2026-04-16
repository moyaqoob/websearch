

import express, {type Request,type Response } from 'express';
import { QueryEngine } from './query/query-engine';
import { SearchEngine } from './search-engine';
import 'dotenv/config';

const queryEngine = new QueryEngine();
const searchEngine = new SearchEngine();
const PORT = 3001;
// console.log(`[API] Index health:`, await queryEngine.healthCheck());

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

app.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string)?.trim();
  console.log("query",q)
  if (!q) {
    res.status(400).json({ error: 'Missing query parameter: q' });
    return;
  }

  const limit   = clamp(Number(req.query.limit  ?? 10), 1, 50);
  const offset  = clamp(Number(req.query.offset ?? 0),  0, 1000);
  const explain = req.query.explain === 'true';

  const results = await searchEngine.search(q, { limit, offset, explain });

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
  res.status(200).json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`[API] Listening on http://localhost:${PORT}`)
});

function clamp(n: number, min: number, max: number): number {
  return Number.isNaN(n) ? min : Math.min(Math.max(n, min), max)
}
