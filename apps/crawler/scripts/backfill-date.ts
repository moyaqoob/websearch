// backfill-dates.ts
// Crash-safe date backfiller with domain skipping, progress persistence, and last_crawled_at
//
// Usage:
//   bun run backfill-dates.ts
//   bun run backfill-dates.ts --from=2740   # resume from a specific ID
//
// Progress is saved to ./backfill-progress.json after every batch.
// Kill it anytime — rerun and it picks up exactly where it left off.

import { Database } from 'bun:sqlite';
import { existsSync, readFileSync, writeFileSync } from 'fs';

// ===== CONFIG =====
const DB_PATH       = process.env.DB_PATH;
const PROGRESS_FILE = './backfill-progress.json';
const BATCH_SIZE    = 200;
const CONCURRENCY   = 8;
const TIMEOUT_MS    = 12_000;
const SLEEP_MS      = 80;

// Domains that NEVER have dates in HTML — skip them entirely to save time.
// Based on observed output: ○ no date pattern.
const SKIP_DOMAIN_SUBSTRINGS = [
  'algo.monster',
  'doc.rust-lang.org',
  'docs.cloud.google.com',
  'docs.pingcap.com',
  'www.cockroachlabs.com/docs',
  'clickhouse.com/docs',
  'www.mongodb.com/docs',
  'peps.python.org',
  'bytebytego.com/guides',
  'usaco.guide',
  'javascript.info',
  'realpython.com/lessons',
  'realpython.com/videos',
  'interviewbit.com/courses',
  'www.educative.io/courses',
  'abseil.io/fast',
  'martinfowler.com/bliki',
  'martinfowler.com/fragments',
  'cp-algorithms.com',
  'cassandra.apache.org/doc',
  'www.hellointerview.com/learn',
  'www.hellointerview.com/guides',
  'visualgo.net',
  'mail.python.org',
  'blog.rust-lang.org/inside-rust',
  'docs.microsoft.com',
  'www.geeksforgeeks.org/quizzes',
  'www.cockroachlabs.com/glossary',
  'www.cockroachlabs.com/blog',    // remove this line if cockroach blog posts do have dates
  'engineering.grab.com/tags',
  'engineering.zalando.com/tags',
  'slack.engineering/advancing',
  'bugs.python.org',
];

function shouldSkip(url: string): boolean {
  return SKIP_DOMAIN_SUBSTRINGS.some(s => url.includes(s));
}

// ===== PROGRESS =====
interface Progress {
  lastProcessedId: number;
  success: number;
  notFound: number;
  skipped: number;
  errors: number;
}

function loadProgress(): Progress {
  // CLI override: --from=12345
  const fromArg = process.argv.find(a => a.startsWith('--from='));
  if (fromArg) {
    const id = parseInt(fromArg.split('=')[1], 10);
    console.log(`[progress] CLI override: starting from id=${id}`);
    return { lastProcessedId: id, success: 0, notFound: 0, skipped: 0, errors: 0 };
  }

  if (existsSync(PROGRESS_FILE)) {
    try {
      const p = JSON.parse(readFileSync(PROGRESS_FILE, 'utf-8')) as Progress;
      console.log(`[progress] Resuming from id=${p.lastProcessedId} (success=${p.success}, skipped=${p.skipped}, errors=${p.errors})`);
      return p;
    } catch {
      console.warn('[progress] Could not parse progress file, starting fresh.');
    }
  }
  return { lastProcessedId: 0, success: 0, notFound: 0, skipped: 0, errors: 0 };
}

function saveProgress(p: Progress) {
  writeFileSync(PROGRESS_FILE, JSON.stringify(p, null, 2));
}

// ===== DATE EXTRACTION =====
function extractDate(html: string): string | null {
  const patterns = [
    /<meta[^>]+property="article:modified_time"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+property="article:modified_time"/i,
    /<meta[^>]+property="og:updated_time"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+property="og:updated_time"/i,
    /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+property="article:published_time"/i,
    /<meta[^>]+name="publish[^"]*"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+name="publish[^"]*"/i,
    /<meta[^>]+name="date"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+name="date"/i,
    /<meta[^>]+itemprop="dateModified"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+itemprop="dateModified"/i,
    /<meta[^>]+itemprop="datePublished"[^>]+content="([^"]+)"/i,
    /<meta[^>]+content="([^"]+)"[^>]+itemprop="datePublished"/i,
    /"dateModified"\s*:\s*"([^"]+)"/i,
    /"datePublished"\s*:\s*"([^"]+)"/i,
    /<time[^>]+datetime="([^"]+)"/i,
    /published[_-]?date["']?\s*[:=]\s*["']([0-9]{4}-[0-9]{2}-[0-9]{2})/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      const date = new Date(match[1]);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }

  return null;
}

// ===== DB SETUP =====
const db = new Database(DB_PATH);
db.run('PRAGMA journal_mode = WAL');
db.run('PRAGMA synchronous = NORMAL');

// Add last_crawled_at column if it doesn't exist yet
try {
  db.run(`ALTER TABLE articles ADD COLUMN last_crawled_at TEXT`);
  console.log('[db] Added last_crawled_at column.');
} catch {
  // Already exists — fine.
}

const selectBatch = db.prepare(`
  SELECT id, url FROM articles
  WHERE published_date IS NULL
    AND (last_crawled_at IS NULL)
    AND id > ?
  ORDER BY id ASC
  LIMIT ?
`);

const updateFound = db.prepare(`
  UPDATE articles
  SET published_date = ?, last_crawled_at = datetime('now')
  WHERE id = ?
`);

const updateNotFound = db.prepare(`
  UPDATE articles
  SET last_crawled_at = datetime('now')
  WHERE id = ?
`);

// ===== WORKER =====
async function processArticle(
  article: { id: number; url: string },
  index: number,
  batchTotal: number,
  p: Progress
) {
  const { id, url } = article;

  if (shouldSkip(url)) {
    updateNotFound.run(id);
    p.skipped++;
    // Don't log every skip — too noisy. Uncomment if you want visibility:
    // console.log(`  - [${index}/${batchTotal}] SKIP — ${url}`);
    return;
  }

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DateBot/1.0)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) {
      updateNotFound.run(id);
      p.errors++;
      console.log(`  ✗ [${index}/${batchTotal}] ${res.status} — ${url}`);
      return;
    }

    // Only read first 20KB — dates are always in <head>
    const reader = res.body?.getReader();
    let html = '';
    if (reader) {
      while (html.length < 20_000) {
        const { done, value } = await reader.read();
        if (done) break;
        html += new TextDecoder().decode(value);
      }
      reader.cancel();
    }

    const date = extractDate(html);

    if (date) {
      updateFound.run(date, id);
      p.success++;
      console.log(`  ✓ [${index}/${batchTotal}] ${date} — ${url}`);
    } else {
      updateNotFound.run(id);
      p.notFound++;
      console.log(`  ○ [${index}/${batchTotal}] no date — ${url}`);
    }

  } catch (e: any) {
    updateNotFound.run(id);
    p.errors++;
    const reason = e?.name === 'TimeoutError' ? 'TIMEOUT' : 'ERROR';
    console.log(`  ✗ [${index}/${batchTotal}] ${reason} — ${url}`);
  }

  await Bun.sleep(SLEEP_MS);
}

// ===== MAIN =====
async function main() {
  const progress = loadProgress();
  let { lastProcessedId } = progress;

  // Graceful shutdown: save progress on SIGINT (Ctrl+C) or SIGTERM
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[${signal}] Saving progress at id=${lastProcessedId}...`);
    saveProgress(progress);
    console.log(`  Resume with: bun run backfill-dates.ts --from=${lastProcessedId}`);
    db.close();
    process.exit(0);
  };
  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  console.log(`\n[start] DB: ${DB_PATH} | batch: ${BATCH_SIZE} | concurrency: ${CONCURRENCY}`);
  console.log(`[start] Starting from id > ${lastProcessedId}\n`);

  while (!shuttingDown) {
    const batch = selectBatch.all(lastProcessedId, BATCH_SIZE) as { id: number; url: string }[];

    if (batch.length === 0) {
      console.log('\n[done] No more articles to process.');
      break;
    }

    const batchMaxId = batch[batch.length - 1].id;
    console.log(`\n[batch] ids ${batch[0].id}–${batchMaxId} (${batch.length} items)`);

    let cursor = 0;

    async function worker() {
      while (cursor < batch.length && !shuttingDown) {
        const i = cursor++;
        await processArticle(batch[i], i + 1, batch.length, progress);
      }
    }

    await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

    lastProcessedId = batchMaxId;
    progress.lastProcessedId = lastProcessedId;
    saveProgress(progress);

    console.log(
      `[progress] saved @ id=${lastProcessedId} | ✓${progress.success} ○${progress.notFound} -${progress.skipped} ✗${progress.errors}`
    );
  }

  saveProgress(progress);
  console.log(`\n[summary] ✓ found: ${progress.success} | ○ no date: ${progress.notFound} | - skipped: ${progress.skipped} | ✗ errors: ${progress.errors}`);
  console.log(`[summary] Progress saved to ${PROGRESS_FILE}`);
  db.close();
}

await main();