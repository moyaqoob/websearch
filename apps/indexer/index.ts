import {Database} from 'bun:sqlite';
import { D1Client } from './indexer/client.ts';
import 'dotenv/config';
import { Indexer } from './indexer/indexer.ts';

const LOCAL_DB_PATH = process.env.LOCAL_DB_PATH ?? './data/search-engine.db';


const d1 = new D1Client();

const indexer = new Indexer(localDb, d1);
const concurrency = Number(process.env.INDEXER_CONCURRENCY ?? '6');

console.log('[Boot] Starting indexing run...');
const result = await indexer.indexAll({ batchSize: 47000, concurrency });

console.log('[Boot] Done.', result);
