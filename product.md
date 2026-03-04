# Search Engine: Product Analysis & Crawling Implementation Guide

## PART 1: UNDERSTAND THE FULL PROBLEM (Product Perspective)

### 1.1 Define Your Core Problem Statement

**Before building anything, answer these questions:**

1. **Who are your users?**
   - Computer science students learning algorithms?
   - Software engineers preparing for interviews?
   - Professionals implementing system designs?
   - Academic researchers?
   - All of the above?

2. **What specific pain point are you solving?**
   - "I search for algorithms and get 100 irrelevant results"
   - "I want to compare implementations of the same algorithm in different languages"
   - "I need explanations at my skill level (beginner/intermediate/expert)"
   - "I want code snippets with complexity analysis side-by-side"
   - "I want to find system design patterns by architectural requirement"

3. **Why existing solutions don't work for them?**
   - Google results are too broad and noisy
   - YouTube is overwhelming and time-consuming
   - Blogs are scattered across 100 different domains
   - No single place aggregates multiple explanations
   - Results aren't tailored to depth level (beginner vs expert)

4. **What does success look like?**
   - Users save 30 minutes per search vs Google
   - Users find the exact explanation they need (not 10 wrong ones)
   - Users find code in their preferred language
   - Users understand complexity trade-offs
   - Users find related concepts automatically

### 1.2 Product Requirements (Not Technical Yet)

**Functional Requirements:**

1. Users can search for algorithms/system design topics
2. Users see relevant results ranked by usefulness
3. Users see multiple explanations at different depths
4. Users can filter by language, difficulty, complexity
5. Users can compare implementations side-by-side
6. Users see code snippets with syntax highlighting
7. Users can navigate to the original source
8. Users get autocomplete suggestions while typing

**Non-Functional Requirements:**

1. Search results return in <500ms
2. Works offline after initial crawl (browser-based, no server calls needed)
3. Works with just 10GB of data
4. Doesn't violate copyright or terms of service
5. Can be updated weekly with new content
6. Supports at least 100,000 documents

### 1.3 Define Your Scope (MVP vs Future)

**MVP (Minimum Viable Product):**

- Search algorithms by name
- Return top 10 results
- Show snippet with link to original
- Works offline
- Support: Python, Java, JavaScript
- ~1000 documents indexed

**Phase 2 (After MVP works):**

- Filter by language, difficulty, complexity
- Autocomplete suggestions
- Show multiple explanations for same concept
- Code comparison (side-by-side)
- ~10,000 documents

**Phase 3+ (Long-term):**

- System design patterns search
- Interactive complexity visualizer
- User accounts and saved snippets
- Personalized recommendations
- ~100,000+ documents

### 1.4 Data Collection Strategy

**Where will content come from?**

For **Algorithms Focus**:

- LeetCode solutions/editorials
- GeeksforGeeks articles
- CodeSignal tutorials
- HackerRank tutorials
- Baeldung (algorithms section)
- Medium (algorithm articles)
- YouTube transcripts (optional)

For **System Design Focus**:

- System Design Primer
- Alex Xu's blog
- Designing Data-Intensive Applications (excerpts)
- Stripe engineering blog
- Uber engineering blog
- AWS architecture docs
- Medium system design articles

For **Hybrid** (recommended):

- Mix of both, start with algorithms, add system design later

**Sample size calculation for 10GB:**

- 1 article ≈ 50KB (with metadata)
- 10GB = 10,240 MB ÷ 50KB = ~200,000 articles possible
- But realistically: 2,000-5,000 high-quality articles is better than 200,000 low-quality ones

### 1.5 User Journey Map

```
User Goal: Find explanation of Binary Search Tree

1. DISCOVERY
   User opens your search engine app
   Sees search box
   Types "binary search tree"

2. SEARCH
   Gets autocomplete suggestions:
   - "binary search tree"
   - "binary tree"
   - "binary search"

3. RESULTS
   Sees 10 results ranked by relevance:
   1. Binary Search Tree - GeeksforGeeks (beginner explanation)
   2. BST Operations - Baeldung (intermediate code)
   3. Binary Search Tree in Python - LeetCode editorial
   4. BST Interview Questions - Medium
   5. ... etc

4. FILTERING (optional)
   User clicks "Filter by language: Python"
   Now sees only Python implementations

5. SELECTION
   User clicks result #2
   Sees full content in your app OR redirected to original site

6. ENGAGEMENT
   User reads explanation
   Sees code snippet with complexity: O(log n) search, O(n) space
   Clicks "See in original" to read full article
   Returns to search for next concept

SUCCESS METRICS:
- User found what they needed
- User spent <5 minutes on search + reading
- User didn't bounce to Google
```

### 1.6 Key Decision: Depth of Content

**You need to decide: How much content do you store?**

**Option A: Snippets Only** (Recommended for 10GB)

```
Store in DB:
- Title
- URL
- First 300 words (snippet)
- Complexity (if available)
- Language
- Publish date
- Author

Total per article: ~5KB
10GB = ~2M articles

When user clicks: Redirect to original site
```

**Option B: Full Content** (More useful but uses more space)

```
Store in DB:
- Everything above +
- Full article text
- Code blocks with syntax highlighting
- Images descriptions
- Section headers

Total per article: ~50KB
10GB = ~200K articles

When user clicks: Show full content in your UI
```

**Option C: Hybrid** (Best balance)

```
Store in DB:
- Snippets for all articles (~5KB each)
- Full content for top 1000 articles (~50KB each)

Total: 1000 × 50KB + 199K × 5KB = ~1GB
Leaves 9GB for future expansion, images, cache

When user clicks:
- Top 1000: Show in your UI
- Others: Redirect to original
```

### Recommendation: Start with Option A (Snippets)

- Fits 10GB easily
- Good user experience (they still see source link)
- Faster to crawl and index
- Legal/copyright friendly
- Once you have momentum, upgrade to Option C

---

## PART 2: CRAWLING IMPLEMENTATION (Step-by-Step)

### 2.1 Crawling Architecture

```
┌─────────────────────────────────────────────────┐
│          CRAWLING PIPELINE                      │
├─────────────────────────────────────────────────┤
│                                                 │
│  1. URL Queue                                   │
│     ├─ Seed URLs (hand-picked blog articles)   │
│     └─ Discovered URLs (from internal links)   │
│                                                 │
│  2. Fetcher                                     │
│     ├─ Download HTML                           │
│     ├─ Handle errors/redirects                 │
│     └─ Rate limiting                           │
│                                                 │
│  3. Parser                                      │
│     ├─ Extract title, content, metadata        │
│     ├─ Remove noise (ads, navigation)          │
│     └─ Validate quality                        │
│                                                 │
│  4. Storage                                     │
│     ├─ Save to database                        │
│     └─ Mark as crawled                         │
│                                                 │
│  5. Deduplication                              │
│     ├─ Check if already crawled                │
│     └─ Avoid duplicates                        │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 2.2 Step-by-Step Implementation Plan

#### Step 1: Set Up Project Structure

```
search-engine/
├── crawler/
│   ├── crawler.js (main crawler logic)
│   ├── fetcher.js (HTTP requests)
│   ├── parser.js (HTML parsing)
│   ├── storage.js (database operations)
│   └── config.js (URLs, timeouts, limits)
├── data/
│   ├── crawled.json (database of articles)
│   ├── queue.json (URLs to crawl)
│   └── seen_urls.json (deduplication)
├── logs/
│   └── crawler.log (crawl statistics)
└── package.json
```

#### Step 2: Define Seed URLs

These are the starting points. You manually choose 10-20 URLs:

```javascript
// crawler/config.js
const SEED_URLS = [
  // GeeksforGeeks (Algorithms)
  "https://www.geeksforgeeks.org/data-structures/",
  "https://www.geeksforgeeks.org/fundamentals-of-algorithms/",

  // Baeldung (Algorithms & Data Structures)
  "https://www.baeldung.com/algorithms",
  "https://www.baeldung.com/java-algorithms-interview-questions",

  // LeetCode Discussions (Solutions)
  "https://leetcode.com/problems/two-sum/discuss/",

  // Medium (Algorithm articles)
  "https://medium.com/tag/algorithms",

  // Codechef/CodeSignal
  // ... more URLs
];

const CRAWL_CONFIG = {
  MAX_CONCURRENT_CRAWLS: 3, // Don't hammer servers
  REQUEST_TIMEOUT_MS: 10000, // 10 second timeout
  CRAWL_DELAY_MS: 2000, // 2 second delay between requests
  MAX_PAGES_PER_DOMAIN: 500, // Max pages from one site
  MIN_CONTENT_LENGTH: 300, // Minimum article length
};
```

#### Step 3: Implement URL Fetcher

```javascript
// crawler/fetcher.js
const axios = require("axios");

async function fetchPage(url) {
  try {
    // Check robots.txt first
    if (await isDisallowed(url)) {
      return { success: false, reason: "robots.txt disallowed" };
    }

    // Fetch with timeout and user agent
    const response = await axios.get(url, {
      timeout: CRAWL_CONFIG.REQUEST_TIMEOUT_MS,
      headers: {
        "User-Agent": "SearchEngine-Crawler/1.0 (+http://yoursite.com/crawler)",
      },
      maxRedirects: 3,
    });

    return {
      success: true,
      html: response.data,
      url: response.config.url, // Final URL after redirects
      statusCode: response.status,
    };
  } catch (error) {
    return {
      success: false,
      reason: error.message,
      statusCode: error.response?.status,
    };
  }
}

async function isDisallowed(url) {
  // Parse domain
  const domain = new URL(url).hostname;

  // Check robots.txt (simplified)
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const robots = await axios.get(robotsUrl, { timeout: 5000 });
    const path = new URL(url).pathname;

    // Simple check (real implementation needs parser library)
    return robots.data.includes(`Disallow: ${path}`);
  } catch {
    // If no robots.txt, assume allowed
    return false;
  }
}

module.exports = { fetchPage };
```

#### Step 4: Implement HTML Parser

```javascript
// crawler/parser.js
const cheerio = require("cheerio");
const crypto = require("crypto");

function parseArticle(html, url) {
  const $ = cheerio.load(html);

  // Extract title
  const title =
    $("h1").first().text().trim() || $("title").text().trim() || "Untitled";

  // Extract main content
  // Strategy: Look for common content containers
  let content = "";
  const selectors = [
    "article",
    ".post-content",
    ".article-content",
    ".entry-content",
    '[class*="content"]',
    "main",
  ];

  for (let selector of selectors) {
    const element = $(selector).first();
    if (element.length) {
      content = element.text();
      break;
    }
  }

  if (!content) {
    // Fallback: take body text
    content = $("body").text();
  }

  // Clean content
  content = content
    .replace(/\s+/g, " ") // Remove extra whitespace
    .trim();

  // Extract metadata
  const publishDate = extractDate($);
  const author = extractAuthor($);

  // Extract code snippets
  const codeBlocks = extractCodeSnippets($);

  // Extract topic tags if available
  const topics = extractTopics($);

  // Calculate word count
  const wordCount = content.split(/\s+/).length;

  // Create document ID (hash of URL)
  const docId = crypto.createHash("sha256").update(url).digest("hex");

  return {
    id: docId,
    url: url,
    title: title,
    content: content.substring(0, 5000), // Limit to 5000 chars for snippets
    fullContent: content,
    author: author,
    publishDate: publishDate,
    wordCount: wordCount,
    topics: topics,
    codeBlocks: codeBlocks,
    crawlTimestamp: new Date().toISOString(),
    domain: new URL(url).hostname,
    quality: calculateQualityScore(content, wordCount),
  };
}

function extractDate($) {
  // Try common date selectors
  const selectors = [
    "time",
    ".published-date",
    ".post-date",
    ".article-date",
    '[class*="date"]',
  ];

  for (let selector of selectors) {
    const dateStr =
      $(selector).first().attr("datetime") || $(selector).first().text();
    if (dateStr) {
      return new Date(dateStr).toISOString().split("T")[0];
    }
  }

  return new Date().toISOString().split("T")[0];
}

function extractAuthor($) {
  const selectors = [
    '[rel="author"]',
    ".author-name",
    ".post-author",
    '[class*="author"]',
  ];

  for (let selector of selectors) {
    const author = $(selector).first().text().trim();
    if (author) return author;
  }

  return "Unknown";
}

function extractCodeSnippets($) {
  const snippets = [];

  $("pre code, code.language-*").each((i, elem) => {
    const code = $(elem).text();
    const language = detectLanguage(code);

    if (code.length > 20) {
      // Only store meaningful snippets
      snippets.push({
        code: code.substring(0, 1000),
        language: language,
      });
    }
  });

  return snippets.slice(0, 5); // Max 5 snippets
}

function extractTopics($) {
  const topics = [];

  // Look for tags
  $('.tag, .category, [class*="tag"], [class*="category"]').each((i, elem) => {
    const topic = $(elem).text().trim();
    if (topic && topic.length < 50) {
      topics.push(topic.toLowerCase());
    }
  });

  return [...new Set(topics)].slice(0, 10); // Unique, max 10
}

function calculateQualityScore(content, wordCount) {
  let score = 0;

  // Length score
  if (wordCount > 500) score += 30;
  if (wordCount > 1000) score += 20;
  if (wordCount > 2000) score += 20;

  // Technical content score (heuristic)
  const technicalKeywords = [
    "algorithm",
    "data structure",
    "complexity",
    "code",
    "function",
    "class",
  ];
  const keywordMatches = technicalKeywords.filter((kw) =>
    content.toLowerCase().includes(kw),
  ).length;

  score += Math.min(keywordMatches * 10, 40);

  // Structure score (look for headings)
  const headingCount = (content.match(/#+\s|<h[1-6]/g) || []).length;
  if (headingCount > 3) score += 10;

  return Math.min(score, 100);
}

function detectLanguage(code) {
  // Simple heuristic
  if (code.includes("class ") && code.includes("public ")) return "java";
  if (code.includes("def ") || code.includes("import ")) return "python";
  if (
    code.includes("function ") ||
    code.includes("const ") ||
    code.includes("=>")
  )
    return "javascript";
  if (code.includes("fn ") || code.includes("let ")) return "rust";
  if (code.includes("#include")) return "cpp";

  return "unknown";
}

module.exports = { parseArticle };
```

#### Step 5: Implement Storage

```javascript
// crawler/storage.js
const fs = require("fs");
const path = require("path");

class CrawlerStorage {
  constructor() {
    this.articlesFile = path.join(__dirname, "../data/crawled.json");
    this.queueFile = path.join(__dirname, "../data/queue.json");
    this.seenFile = path.join(__dirname, "../data/seen_urls.json");

    this.articles = this.loadJSON(this.articlesFile, []);
    this.queue = this.loadJSON(this.queueFile, []);
    this.seenUrls = this.loadJSON(this.seenFile, {});
  }

  loadJSON(filePath, defaultValue) {
    try {
      if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, "utf-8"));
      }
    } catch (error) {
      console.error(`Error loading ${filePath}:`, error.message);
    }
    return defaultValue;
  }

  saveJSON(filePath, data) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
    } catch (error) {
      console.error(`Error saving ${filePath}:`, error.message);
    }
  }

  // Add article to database
  addArticle(article) {
    // Check if already exists
    if (this.seenUrls[article.url]) {
      return { success: false, reason: "URL already crawled" };
    }

    // Add to articles
    this.articles.push(article);
    this.seenUrls[article.url] = article.id;

    // Save to disk
    this.save();

    return { success: true, docId: article.id };
  }

  // Check if URL already crawled
  hasSeenUrl(url) {
    return !!this.seenUrls[url];
  }

  // Add URLs to crawl queue
  addToQueue(urls) {
    for (let url of urls) {
      if (!this.hasSeenUrl(url) && !this.queue.includes(url)) {
        this.queue.push(url);
      }
    }
    this.save();
  }

  // Get next URL to crawl
  getNextUrl() {
    return this.queue.shift();
  }

  // Get statistics
  getStats() {
    return {
      articlesCount: this.articles.length,
      queueSize: this.queue.length,
      totalSizeKB: (JSON.stringify(this.articles).length / 1024).toFixed(2),
      domains: new Set(this.articles.map((a) => a.domain)).size,
      lastUpdated: new Date().toISOString(),
    };
  }

  // Save all data to disk
  save() {
    this.saveJSON(this.articlesFile, this.articles);
    this.saveJSON(this.queueFile, this.queue);
    this.saveJSON(this.seenFile, this.seenUrls);
  }
}

module.exports = { CrawlerStorage };
```

#### Step 6: Main Crawler Loop

```javascript
// crawler/crawler.js
const { fetchPage } = require("./fetcher");
const { parseArticle } = require("./parser");
const { CrawlerStorage } = require("./storage");
const { SEED_URLS, CRAWL_CONFIG } = require("./config");

class Crawler {
  constructor() {
    this.storage = new CrawlerStorage();
    this.domainCounts = {}; // Track pages per domain
    this.stats = {
      crawled: 0,
      failed: 0,
      skipped: 0,
      startTime: Date.now(),
    };
  }

  async initialize() {
    // Add seed URLs to queue
    console.log("Initializing crawler with seed URLs...");
    this.storage.addToQueue(SEED_URLS);
  }

  async crawlOne() {
    // Get next URL
    const url = this.storage.getNextUrl();
    if (!url) {
      console.log("No more URLs in queue");
      return false;
    }

    // Check domain limit
    const domain = new URL(url).hostname;
    if ((this.domainCounts[domain] || 0) >= CRAWL_CONFIG.MAX_PAGES_PER_DOMAIN) {
      console.log(`Skipped ${url} - domain limit reached for ${domain}`);
      this.stats.skipped++;
      return true; // Continue to next
    }

    console.log(`Crawling: ${url}`);

    // Fetch page
    const fetchResult = await fetchPage(url);
    if (!fetchResult.success) {
      console.log(`❌ Failed: ${url} - ${fetchResult.reason}`);
      this.stats.failed++;
      return true;
    }

    // Parse page
    const article = parseArticle(fetchResult.html, fetchResult.url);

    // Validate quality
    if (article.wordCount < CRAWL_CONFIG.MIN_CONTENT_LENGTH) {
      console.log(
        `⏭️  Skipped: ${url} - too short (${article.wordCount} words)`,
      );
      this.stats.skipped++;
      return true;
    }

    if (article.quality < 30) {
      console.log(
        `⏭️  Skipped: ${url} - low quality score (${article.quality})`,
      );
      this.stats.skipped++;
      return true;
    }

    // Save article
    const saveResult = this.storage.addArticle(article);
    if (!saveResult.success) {
      console.log(`⏭️  Skipped: ${url} - ${saveResult.reason}`);
      this.stats.skipped++;
      return true;
    }

    console.log(
      `✅ Saved: ${article.title} (${article.wordCount} words, quality: ${article.quality})`,
    );
    this.domainCounts[domain] = (this.domainCounts[domain] || 0) + 1;
    this.stats.crawled++;

    // Extract internal links
    const cheerio = require("cheerio");
    const $ = cheerio.load(fetchResult.html);
    const internalLinks = [];

    $("a").each((i, elem) => {
      const href = $(elem).attr("href");
      if (href) {
        try {
          const absoluteUrl = new URL(href, fetchResult.url).toString();
          // Only crawl same domain
          if (new URL(absoluteUrl).hostname === domain) {
            internalLinks.push(absoluteUrl);
          }
        } catch (e) {
          // Invalid URL
        }
      }
    });

    // Add to queue (but limit to prevent infinite crawl)
    if (this.storage.queue.length < 5000) {
      this.storage.addToQueue(internalLinks.slice(0, 5));
    }

    return true;
  }

  async runBatch(count = 10) {
    // Run crawler for N pages
    console.log(`Starting crawl batch (${count} pages)...`);

    for (let i = 0; i < count; i++) {
      const shouldContinue = await this.crawlOne();
      if (!shouldContinue) break;

      // Respect rate limiting
      await new Promise((resolve) =>
        setTimeout(resolve, CRAWL_CONFIG.CRAWL_DELAY_MS),
      );
    }

    this.printStats();
  }

  async runUntilQueueEmpty() {
    // Run until queue is empty
    console.log("Starting full crawl...");

    while (this.storage.queue.length > 0) {
      await this.crawlOne();
      await new Promise((resolve) =>
        setTimeout(resolve, CRAWL_CONFIG.CRAWL_DELAY_MS),
      );

      // Print progress every 50 articles
      if (this.stats.crawled % 50 === 0) {
        this.printStats();
      }
    }

    this.printStats();
  }

  printStats() {
    const elapsedSeconds = (Date.now() - this.stats.startTime) / 1000;
    const storageStats = this.storage.getStats();

    console.log("\n" + "=".repeat(50));
    console.log("CRAWL STATISTICS");
    console.log("=".repeat(50));
    console.log(`Crawled: ${this.stats.crawled}`);
    console.log(`Failed: ${this.stats.failed}`);
    console.log(`Skipped: ${this.stats.skipped}`);
    console.log(`Queue remaining: ${storageStats.queueSize}`);
    console.log(`Total articles: ${storageStats.articlesCount}`);
    console.log(`Total storage: ${storageStats.totalSizeKB} KB`);
    console.log(`Unique domains: ${storageStats.domains}`);
    console.log(`Elapsed time: ${(elapsedSeconds / 60).toFixed(2)} minutes`);
    console.log(
      `Rate: ${(this.stats.crawled / elapsedSeconds).toFixed(2)} pages/sec`,
    );
    console.log("=".repeat(50) + "\n");
  }
}

module.exports = { Crawler };
```

#### Step 7: Run the Crawler

```javascript
// crawler.js (main entry point)
const { Crawler } = require("./crawler/crawler");

async function main() {
  const crawler = new Crawler();
  await crawler.initialize();

  // Option 1: Crawl just 100 pages first
  await crawler.runBatch(100);

  // Option 2: Crawl everything
  // await crawler.runUntilQueueEmpty();
}

main().catch(console.error);
```

### 2.3 Run and Monitor

**First run:**

```bash
npm install axios cheerio
node crawler.js
```

**Expected output:**

```
Initializing crawler with seed URLs...
Crawling: https://www.geeksforgeeks.org/data-structures/
✅ Saved: Introduction to Data Structures (1250 words, quality: 75)
Crawling: https://www.geeksforgeeks.org/array-data-structure/
✅ Saved: Arrays in Data Structures (890 words, quality: 68)
...

==================================================
CRAWL STATISTICS
==================================================
Crawled: 100
Failed: 3
Skipped: 12
Queue remaining: 245
Total articles: 100
Total storage: 4.5 MB
Unique domains: 8
Elapsed time: 2.35 minutes
Rate: 0.71 pages/sec
==================================================
```

### 2.4 Crawling Checklist

Before you start crawling:

- [ ] Decide: Algorithms OR System Design OR Hybrid?
- [ ] Choose 10-20 seed URLs (mix of blogs, tutorials, sites)
- [ ] Set up project folder structure
- [ ] Install dependencies: `npm install axios cheerio`
- [ ] Configure CRAWL_CONFIG values (timeouts, delays)
- [ ] Test fetcher on single URL
- [ ] Test parser on fetched HTML
- [ ] Run crawler on 10 pages (verify output)
- [ ] Increase to 100 pages
- [ ] Monitor storage size and quality
- [ ] When satisfied, crawl more

### 2.5 What Success Looks Like (After Crawling)

After crawling 500-1000 articles, you should have:

```json
{
  "articlesCount": 500,
  "queueSize": 250,
  "totalSizeKB": "25000",
  "domains": 15,
  "sampleArticle": {
    "id": "sha256hash",
    "url": "https://example.com/binary-search",
    "title": "Binary Search - Complete Guide",
    "content": "A binary search algorithm...",
    "author": "John Doe",
    "publishDate": "2023-06-15",
    "wordCount": 2500,
    "topics": ["algorithms", "search", "binary-search"],
    "codeBlocks": [
      {
        "code": "def binary_search(arr, target):\n  left, right = 0, len(arr) - 1\n...",
        "language": "python"
      }
    ],
    "quality": 85,
    "crawlTimestamp": "2026-02-27T10:30:00Z"
  }
}
```

---

## PART 3: WHAT COMES AFTER CRAWLING

Once you have crawled data, the next steps are:

### 3.1 Indexer (Build searchable index from crawled data)

- Takes the crawled.json file
- Builds inverted index for fast search
- Tokenizes content, removes stop words
- Calculates TF-IDF scores
- Creates autocomplete index

### 3.2 Query Engine (Search interface)

- Takes user query
- Searches inverted index
- Ranks results by relevance
- Returns top 10 results with snippets

### 3.3 UI (Browser interface)

- Search box
- Display results
- Filter/sort options
- Link to original articles

---

## KEY PRODUCT DECISIONS TO MAKE NOW

1. **Focus**: Algorithms? System Design? Hybrid? (Choose ONE to start)
2. **Content depth**: Snippets only OR full content?
3. **Languages**: Python only? Python + Java + JS?
4. **MVP scale**: 100 articles? 500? 1000?
5. **Update frequency**: One-time crawl? Weekly? Monthly?

Once you answer these, you can confidently crawl the right content.

---

## NEXT IMMEDIATE STEPS

1. **This week**: Set up crawler, test on 10 pages
2. **Next week**: Crawl 500 high-quality articles
3. **Week 3**: Build indexer to search crawled data
4. **Week 4**: Build UI and make it work end-to-end
5. **Week 5**: Optimize, test, gather feedback

Don't jump to indexing/UI until crawling works reliably.
