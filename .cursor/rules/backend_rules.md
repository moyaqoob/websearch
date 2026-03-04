# Search Engine Cursor Rules

## Project Overview
Building a small-scale browser-based search engine for algorithms and system design educational content. The system consists of three core components: Crawler, Indexer, and Query Engine. This document provides specific guidelines for development across all three components.

---

## 1. CRAWLER COMPONENT

### Purpose
The Crawler is responsible for discovering, fetching, and extracting content from algorithms and system design blogs. It must be efficient, respectful, and capable of handling various blog formats.

### Key Guidelines

#### 1.1 Data Collection Strategy
- **Target sources**: Focus on popular algorithms/system design blogs (e.g., LeetCode articles, GeeksforGeeks, Baeldung, Medium algorithm articles, system design primers)
- **Scope**: Limit crawling to educational content only; avoid news, social media, or non-technical blogs
- **Frequency**: For initial implementation, use batch crawling rather than continuous crawling to reduce load
- **Content types**: Extract blog posts, tutorials, articles, and documentation pages with clear technical content

#### 1.2 Respectful Crawling Practices
- **robots.txt compliance**: Always check and respect robots.txt rules before crawling
- **Rate limiting**: Implement delays between requests (minimum 1-2 seconds per domain) to avoid overwhelming servers
- **User-Agent identification**: Include a descriptive User-Agent header identifying your crawler
- **No authentication bypass**: Never attempt to bypass login systems or paywalls
- **Duplicate prevention**: Maintain a URL hash set to avoid re-crawling the same pages

#### 1.3 Content Extraction
- **HTML parsing**: Use libraries like Cheerio (Node.js) or jsdom to parse and extract content
- **Target extraction**:
  - Page title
  - Main article content (remove navigation, ads, sidebar clutter)
  - Publication date (if available)
  - Author information (if available)
  - Topic/category tags
  - Code snippets (preserve formatting and language type)
- **Quality filtering**:
  - Minimum content length: 300 words
  - Exclude pages with less than 10% text-to-HTML ratio
  - Filter out duplicate or near-duplicate content using hash comparison
  - Validate extracted content is actual technical content (check for algorithm/system design keywords)

#### 1.4 Error Handling & Recovery
- **Network errors**: Implement exponential backoff (1s, 2s, 4s, 8s) for failed requests
- **Timeout handling**: Set reasonable timeouts (5-10 seconds per page)
- **HTTP status codes**:
  - 200-299: Success
  - 301-302: Follow redirects (max 3 redirects)
  - 403-404: Skip and log
  - 429: Respect rate limiting; back off for 24 hours
  - 500+: Retry with backoff
- **Logging**: Log all errors, skipped pages, and crawl statistics for monitoring
- **Graceful degradation**: If a domain becomes unavailable, skip it and continue with others

#### 1.5 Data Storage Format
Store crawled data in a structured format (JSON):
```json
{
  "id": "unique_hash",
  "url": "https://example.com/article",
  "title": "Understanding Binary Search Trees",
  "content": "Full extracted text content...",
  "author": "John Doe",
  "publishDate": "2024-01-15",
  "domain": "example.com",
  "topics": ["data-structures", "trees", "algorithms"],
  "crawlTimestamp": "2026-02-27T10:30:00Z",
  "wordCount": 2500,
  "codeSnippets": [
    {
      "language": "python",
      "code": "..."
    }
  ]
}
```

#### 1.6 Performance Considerations
- **Concurrency**: Limit concurrent requests to 5-10 per domain (use promise pools)
- **Memory management**: Stream large responses; avoid loading entire websites into memory
- **Progress tracking**: Implement checkpointing so crawls can resume from interruptions
- **Validation**: Validate crawled content before storage (check for minimum quality thresholds)

---

## 2. INDEXER COMPONENT

### Purpose
The Indexer processes crawled content and builds efficient data structures for fast searching. It creates inverted indices, tokenizes content, and manages the searchable index.

### Key Guidelines

#### 2.1 Tokenization & Preprocessing
- **Text normalization**:
  - Convert to lowercase
  - Remove punctuation (except in code snippets)
  - Handle contractions (e.g., "don't" → "don", "t")
  - Preserve technical terms and camelCase identifiers
- **Stop word removal**: Filter common words (the, a, is, etc.) but preserve technical stop words (null, void, async, await)
- **Stemming/Lemmatization**: Use Porter stemmer (or similar) for algorithms/system design context to group similar terms
  - Example: "indexing", "indexed", "indexes" → "index"
- **Tokenization**:
  - Split on whitespace and punctuation
  - Preserve code syntax keywords as separate tokens
  - Handle multi-word phrases (e.g., "binary search tree" as a phrase token)

#### 2.2 Inverted Index Structure
Build an inverted index mapping terms to documents:
```json
{
  "binary": {
    "postingList": [
      {
        "docId": "doc_123",
        "frequency": 5,
        "positions": [12, 45, 89, 156, 234],
        "context": ["binary search", "binary tree", "binary notation"]
      },
      {
        "docId": "doc_456",
        "frequency": 2,
        "positions": [23, 67]
      }
    ],
    "docFrequency": 2,
    "idf": 0.693
  }
}
```

Components:
- **Posting list**: All documents containing the term
- **Frequency**: How many times the term appears in each document
- **Positions**: Exact positions of the term (for phrase queries)
- **IDF (Inverse Document Frequency)**: Used for relevance scoring

#### 2.3 Indexing Strategy
- **Batch indexing**: Process crawled documents in batches (1000-5000 at a time)
- **Incremental updates**: Support adding new documents without rebuilding the entire index
- **Field indexing**: Index separately and weight fields differently:
  - Title: Weight 1.0x
  - Headings: Weight 0.8x
  - Body content: Weight 0.5x
  - Code snippets: Weight 0.3x (search in these but lower relevance)
- **Phrase indexing**: Maintain position information to support phrase queries ("binary search tree")

#### 2.4 Relevance Scoring
Implement TF-IDF (Term Frequency-Inverse Document Frequency):
```
Score(term, doc) = TF(term, doc) * IDF(term)

TF(term, doc) = frequency of term in doc / total terms in doc
IDF(term) = log(total docs / docs containing term)
```

For multi-term queries:
```
Score(query, doc) = Σ (TF-IDF(term, doc) × field_weight × position_boost)
```

#### 2.5 Advanced Indexing Features
- **Faceted search support**:
  - Index document metadata (topic, domain, author, date)
  - Enable filtering by category, difficulty level, date range
- **Autocomplete index**:
  - Build a separate prefix index for term suggestions
  - Store top N-grams (e.g., "bi", "bin", "bina", "binar", "binary")
- **Synonym support** (optional):
  - Map synonyms (e.g., "BST" → "binary search tree", "DP" → "dynamic programming")
  - Store in a separate synonym dictionary

#### 2.6 Index Storage & Persistence
- **Format**: Store index as JSON or binary format (for small scale, JSON is acceptable)
- **Structure**:
  ```
  /index/
    ├── inverted_index.json    (main inverted index)
    ├── document_store.json    (full document content and metadata)
    ├── field_index.json       (per-field indices)
    ├── autocomplete_index.json (prefix trie for suggestions)
    └── metadata.json          (index stats: total docs, total terms, last updated)
  ```
- **Compression**: For production, consider gzip compression for stored indices
- **Versioning**: Include index version to handle schema changes

#### 2.7 Quality & Consistency
- **Validation**: Ensure all indexed documents meet quality thresholds
- **Duplicate detection**: Use content hashing to prevent indexing duplicate documents
- **Consistency checks**: Verify inverted index consistency (all terms point to valid docs)
- **Statistics tracking**: Log index size, document count, unique terms, average document length

#### 2.8 Performance Optimization
- **Index compression**: For large indices, implement bit-packing for posting lists
- **Lazy loading**: Load field indices on-demand rather than all at once
- **Caching**: Cache frequently accessed terms and posting lists
- **Batch operations**: Process updates in batches to reduce I/O operations

---

## 3. QUERY ENGINE COMPONENT

### Purpose
The Query Engine processes user search queries and returns relevant results. It handles query parsing, retrieval, ranking, and result formatting.

### Key Guidelines

#### 3.1 Query Parsing & Preprocessing
- **Input normalization**:
  - Convert to lowercase
  - Remove extra whitespace
  - Handle special characters appropriately
- **Query type detection**:
  - Single term: "algorithms"
  - Multi-term: "binary search tree"
  - Phrase query: "binary search tree" (in quotes)
  - Boolean operators: "binary AND tree NOT binary_heap" (if supported)
- **Error handling**:
  - Provide helpful suggestions for empty queries
  - Validate query length (max 100 characters)
  - Handle malformed queries gracefully

#### 3.2 Retrieval Strategy
- **Inverted index lookup**: Fetch all documents containing query terms
- **Intersection optimization**:
  - For multi-term queries, intersect posting lists of each term
  - Start with the rarest term (smallest posting list) for efficiency
- **Phrase query handling**:
  - Use position information to verify terms appear consecutively
  - Example: "binary search" requires "binary" and "search" positions to be adjacent
- **Wildcard support** (optional):
  - "binar*" matches "binary", "binaries", etc.
  - Use prefix index for efficient matching

#### 3.3 Ranking & Scoring
Implement a multi-factor ranking system:

**Base scoring**: TF-IDF
```
score = TF(term, doc) × IDF(term) × field_weight
```

**Additional ranking factors**:
- **Recency boost** (20% weight): Newer documents ranked slightly higher
  ```
  recency_score = 1 + (days_since_published / 365) × 0.2
  ```
- **Authority/popularity** (10% weight): If tracked, boost popular domains
  ```
  authority_score = domain_authority × 0.1
  ```
- **Content quality** (15% weight): Document length, engagement metrics
  ```
  quality_score = (word_count / avg_word_count) × 0.15
  ```
- **Query-document relevance** (55% weight): Core TF-IDF score

**Final score**:
```
final_score = (tf_idf × 0.55) + (recency × 0.2) + (quality × 0.15) + (authority × 0.1)
```

#### 3.4 Result Filtering & Faceting
- **Filters available**:
  - By topic/category (e.g., "data structures", "system design")
  - By difficulty (if indexed: "beginner", "intermediate", "advanced")
  - By domain (e.g., "geeksforgeeks.com", "baeldung.com")
  - By date range
  - By content type (if tracked: "article", "tutorial", "documentation")
- **Filter application**: Apply filters after ranking to remove irrelevant results
- **Facet counts**: Return count of results per facet value for UI display

#### 3.5 Result Presentation
Return results in structured format:
```json
{
  "query": "binary search tree",
  "totalResults": 1250,
  "resultsPerPage": 10,
  "currentPage": 1,
  "executionTime": "45ms",
  "results": [
    {
      "rank": 1,
      "docId": "doc_123",
      "title": "Understanding Binary Search Trees",
      "url": "https://example.com/bst-guide",
      "domain": "example.com",
      "score": 0.89,
      "snippet": "A binary search tree (BST) is a fundamental data structure that maintains sorted data. Each node has at most two children, with left child values less than...",
      "highlights": ["binary", "search", "tree"],
      "publishDate": "2023-06-15",
      "author": "John Doe",
      "topics": ["data-structures", "trees", "algorithms"],
      "relevance": "95%"
    }
  ],
  "suggestions": {
    "didYouMean": "binary search trees",
    "relatedSearches": ["AVL trees", "red black trees", "binary tree traversal"]
  },
  "facets": {
    "topics": [
      { "value": "data-structures", "count": 450 },
      { "value": "algorithms", "count": 380 }
    ],
    "domain": [
      { "value": "geeksforgeeks.com", "count": 320 },
      { "value": "example.com", "count": 240 }
    ]
  }
}
```

#### 3.6 Snippet Generation
- **Snippet length**: 150-200 characters
- **Content selection**:
  - Include sentences containing query terms
  - Highlight matching terms using `<mark>` tags
  - Provide context around matches
  - Prioritize snippets from early in the document
- **Truncation**: Use ellipsis ("...") for truncated text

#### 3.7 Performance & Optimization
- **Result caching**:
  - Cache top 1000 most frequent queries
  - Cache results for 24 hours
  - Include cache hit/miss in response metadata
- **Pagination**:
  - Default: 10 results per page
  - Max: 100 results per page
  - Implement cursor-based pagination for large result sets
- **Lazy loading**: Don't compute scores for all results; compute top N only
- **Query optimization**:
  - Precompute IDF scores during indexing
  - Use bit-operations for large-scale ranking
  - Implement result pruning (stop after N results with diminishing relevance)

#### 3.8 Query Suggestions & Autocomplete
- **Prefix-based suggestions**:
  - As user types, suggest completions based on indexed terms
  - Return top 5-10 suggestions sorted by frequency
- **Did you mean**:
  - If query returns 0-5 results, suggest corrected queries
  - Use edit distance (Levenshtein) or phonetic similarity
- **Related searches**:
  - Show semantically related terms based on co-occurrence in documents
  - Example: If searching "binary search", suggest "binary tree", "search algorithms"

#### 3.9 Logging & Analytics
- **Query logging**: Log all queries (without PII) for analytics
  - Query text
  - Execution time
  - Number of results
  - Selected result (if tracked)
- **Performance monitoring**:
  - Track average query execution time
  - Monitor slow queries (>200ms)
  - Alert on degraded performance
- **User behavior** (optional):
  - Track which results are clicked
  - Track bounce rate (users returning to search)
  - Use to improve ranking over time

---

## 4. CROSS-COMPONENT GUIDELINES

### 4.1 Data Flow
```
Crawler → Raw Content
   ↓
Indexer → Inverted Index + Document Store
   ↓
Query Engine → User Results
```

### 4.2 Error Handling Strategy
- **Component isolation**: Errors in one component shouldn't crash others
- **Fallback mechanisms**:
  - If query engine fails, return cached results
  - If indexer fails, continue using old index
  - If crawler fails, skip domain and continue
- **Monitoring**: Log all errors with context for debugging

### 4.3 Testing Strategy
#### Unit Tests
- **Crawler**: Test HTML parsing, content extraction, error handling
- **Indexer**: Test tokenization, TF-IDF calculation, index consistency
- **Query Engine**: Test parsing, ranking, filtering, snippet generation

#### Integration Tests
- Test full flow: crawl → index → query → verify results
- Test with real blog content
- Performance testing: index large document sets, measure query time

#### Test Data
- Use 50-100 real blog articles for initial testing
- Create synthetic test cases for edge cases:
  - Very short articles
  - Articles with lots of code
  - Articles with technical terminology
  - Duplicate content across domains

### 4.4 Documentation
- **Code comments**: Document complex algorithms (TF-IDF, phrase matching)
- **Architecture diagram**: Show data flow between components
- **API documentation**: Document query engine API endpoints
- **Configuration guide**: Document tunable parameters (weights, timeouts, limits)

### 4.5 Deployment Considerations
- **Crawler**: Run as scheduled job (e.g., daily, weekly)
- **Indexer**: Run after crawler completes, handle incremental updates
- **Query Engine**: Always available; use load balancing if needed
- **Storage**: Store indices and document store on persistent storage
- **Scalability**: For future scale, consider distributed crawling and sharded indices

---

## 5. CONFIGURATION & TUNING PARAMETERS

### Crawler Configuration
```
MAX_CONCURRENT_REQUESTS: 5
REQUEST_TIMEOUT_MS: 10000
CRAWL_DELAY_MS: 2000
MAX_REDIRECTS: 3
MIN_CONTENT_LENGTH: 300
MAX_CONTENT_LENGTH: 100000
```

### Indexer Configuration
```
MIN_TERM_LENGTH: 2
MAX_TERM_LENGTH: 50
BATCH_SIZE: 5000
FIELD_WEIGHTS: {
  title: 1.0,
  heading: 0.8,
  body: 0.5,
  code: 0.3
}
```

### Query Engine Configuration
```
RESULTS_PER_PAGE: 10
MAX_RESULTS_PER_PAGE: 100
CACHE_TTL_HOURS: 24
SNIPPET_LENGTH: 150
TOP_SUGGESTIONS: 10
QUERY_TIMEOUT_MS: 5000
```

---

## 6. FUTURE ENHANCEMENTS

### Phase 2
- Semantic search using embeddings
- Query expansion based on synonyms
- Learning-to-rank using click data
- A/B testing for ranking algorithms

### Phase 3
- Multi-language support
- Advanced NLP (named entity recognition, question answering)
- Personalized results based on user history
- Real-time index updates

### Phase 4
- Distributed crawling across multiple nodes
- Sharded indices for scalability
- Advanced caching strategies
- ML-based spam detection

---

## 7. DECISION POINTS

### Algorithm vs System Design Focus
This ruleset is generic to both domains. When you decide:
- **Algorithms focus**: Adjust weights to boost data structure and algorithm-specific content; filter out infrastructure/deployment articles
- **System Design focus**: Boost content on scalability, databases, distributed systems; filter out pure algorithm articles

### Technology Stack (Examples)
**Crawler**: Node.js + Cheerio + Axios
**Indexer**: Node.js with in-memory or persistent JSON storage
**Query Engine**: Node.js + Express API + Frontend

### Index Scale Estimates
- 1,000 articles: ~50 MB index size
- 10,000 articles: ~500 MB index size
- 100,000 articles: ~5 GB (may need optimization)

---

## Notes
- Start with a small seed of 50-100 high-quality articles
- Test each component independently before integration
- Monitor performance metrics from day one
- Be prepared to adjust ranking weights based on user feedback