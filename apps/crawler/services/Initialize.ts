import Database from "better-sqlite3";


class Initialize {
    private db: Database.Database;
    private config: any;
  
    constructor() {
      // Step 1.1: Open database
      this.db = new Database('./data/search-engine.db');
      console.log('✅ Stage 1.1: Database connection opened');
  
      // Step 1.2: Configure crawler settings
      this.config = {
        maxConcurrentCrawls: 2,
        crawlDelayMs: 3000,
        requestTimeoutMs: 15000,
        maxPagesPerDomain: 1000,
        minContentLength: 400,
      };
      console.log('✅ Stage 1.2: Configuration loaded', this.config);
  
      // Step 1.3: Create tables if not exist
      this.createTables();
      console.log('✅ Stage 1.3: Tables verified');
  
      // Step 1.4: Add seed URLs to queue
      const seedUrls = [
        'https://www.geeksforgeeks.org/data-structures/',
        'https://www.baeldung.com/algorithms',
        'https://medium.com/tag/system-design',
      ];
      
      this.addToQueue(seedUrls);
      console.log('✅ Stage 1.4: Seed URLs queued', seedUrls.length);
    }
  
    private createTables() {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS articles (
          id TEXT PRIMARY KEY,
          url TEXT UNIQUE NOT NULL,
          url_normalized TEXT,
          domain TEXT NOT NULL,
          title TEXT NOT NULL,
          snippet TEXT,
          content TEXT,
          word_count INTEGER,
          author TEXT,
          published_date TEXT,
          updated_date TEXT,
          crawl_timestamp TEXT,
          category TEXT,
          difficulty TEXT,
          quality_score INTEGER,
          readability_score INTEGER,
          authority_score INTEGER,
          freshness_score INTEGER,
          popularity_score INTEGER,
          content_hash TEXT UNIQUE,
          is_indexed INTEGER DEFAULT 0,
          s3_snippet_key TEXT,
          s3_content_key TEXT,
          embedding_vector_json TEXT
        );
  
        CREATE TABLE IF NOT EXISTS url_queue (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          url TEXT UNIQUE NOT NULL,
          domain TEXT,
          priority INTEGER DEFAULT 0,
          added_timestamp TEXT DEFAULT CURRENT_TIMESTAMP
        );
      `);
    }
  
    private addToQueue(urls: string[]) {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO url_queue (url, domain, priority)
        VALUES (?, ?, ?)
      `);
  
      urls.forEach(url => {
        const domain = new URL(url).hostname;
        stmt.run(url, domain, 0);
      });
    }
  
    getQueueSize(): number {
      const result = this.db.prepare('SELECT COUNT(*) as count FROM url_queue').get() as any;
      return result.count;
    }
  
    getNextUrl(): string | null {
      const result = this.db.prepare(`
        SELECT url FROM url_queue
        ORDER BY priority DESC, rowid ASC
        LIMIT 1
      `).get() as any;
  
      if (result) {
        this.db.prepare('DELETE FROM url_queue WHERE url = ?').run(result.url);
        return result.url;
      }
      return null;
    }
  }