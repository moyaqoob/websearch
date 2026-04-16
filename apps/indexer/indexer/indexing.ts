import {Database} from 'bun:sqlite';
import { D1Client } from './client.ts';
import 'dotenv/config';
import { Indexer } from './indexer.ts';




const indexer = new Indexer();
const concurrency = Number(process.env.INDEXER_CONCURRENCY ?? '6');

console.log('[Boot] Starting indexing run...');
const result = await indexer.indexAll({ batchSize: 47000, concurrency });

console.log('[Boot] Done.', result);
