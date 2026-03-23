import type { SearchPrecision } from ".";

export interface SourceTierConfig {
    name: string;
    domains: string[];
    authorityScore: number;
    minQualityScore: number;
    minWordCount: number;
    requireCodeExamples: boolean;
    requireAuthor?: boolean;
    searchPrecision: SearchPrecision;
  }
  
export  interface TierDetectionResult {
    tier: Source_Name;
    config: SourceProfile;
    domain: string;
  }
  
 export interface GateResult {
    passed: boolean;
    reason?: string;
  }
  
 export interface ExtractedSignals {
    authority_score: number;
    quality_score: number;
    keyword_relevance_score: number;
    freshness_score: number;
    readability_score: number;
  }
  
  // ============================================================================
  // CONSTANTS
  // ============================================================================
  
  export const RELEVANCE_KEYWORDS: Array<{ term: string; weight: number }> = [

    // === ALGORITHMS - CORE ===
    { term: "algorithm", weight: 1.8 },
    { term: "binary search", weight: 2.2 },
    { term: "dynamic programming", weight: 2.4 },
    { term: "greedy algorithm", weight: 2.1 },
    { term: "divide and conquer", weight: 2.0 },
    { term: "backtracking", weight: 2.0 },
    { term: "memoization", weight: 2.0 },
    { term: "recursion", weight: 1.6 },
    { term: "sliding window", weight: 2.1 },
    { term: "two pointers", weight: 2.0 },
    { term: "bit manipulation", weight: 1.9 },
    { term: "topological sort", weight: 2.1 },
  
    // === DATA STRUCTURES ===
    { term: "data structure", weight: 1.8 },
    { term: "linked list", weight: 1.9 },
    { term: "binary tree", weight: 2.0 },
    { term: "binary search tree", weight: 2.1 },
    { term: "avl tree", weight: 2.0 },
    { term: "red black tree", weight: 2.0 },
    { term: "trie", weight: 2.1 },
    { term: "segment tree", weight: 2.2 },
    { term: "fenwick tree", weight: 2.2 },
    { term: "heap", weight: 1.8 },
    { term: "priority queue", weight: 1.9 },
    { term: "hash map", weight: 1.7 },
    { term: "hash table", weight: 1.7 },
    { term: "graph", weight: 1.6 },
    { term: "adjacency list", weight: 1.9 },
    { term: "union find", weight: 2.1 },
    { term: "disjoint set", weight: 2.1 },
    { term: "monotonic stack", weight: 2.2 },
    { term: "deque", weight: 1.7 },
    { term: "circular buffer", weight: 1.8 },
    { term: "bloom filter", weight: 2.1 },
    { term: "skip list", weight: 2.0 },
    { term: "lru cache", weight: 2.2 },
    { term: "lfu cache", weight: 2.2 },
  
    // === COMPLEXITY & ANALYSIS ===
    { term: "time complexity", weight: 2.1 },
    { term: "space complexity", weight: 2.1 },
    { term: "complexity", weight: 1.7 },
    { term: "big o notation", weight: 2.1 },
    { term: "amortized analysis", weight: 2.2 },
    { term: "asymptotic", weight: 1.9 },
    { term: "np complete", weight: 2.0 },
    { term: "np hard", weight: 2.0 },
  
    // === GRAPH ALGORITHMS ===
    { term: "depth first search", weight: 2.1 },
    { term: "breadth first search", weight: 2.1 },
    { term: "dijkstra", weight: 2.3 },
    { term: "bellman ford", weight: 2.2 },
    { term: "floyd warshall", weight: 2.2 },
    { term: "minimum spanning tree", weight: 2.2 },
    { term: "kruskal", weight: 2.1 },
    { term: "prim", weight: 2.1 },
    { term: "strongly connected components", weight: 2.2 },
  
    // === SORTING & SEARCHING ===
    { term: "quicksort", weight: 1.9 },
    { term: "mergesort", weight: 1.9 },
    { term: "heapsort", weight: 1.9 },
    { term: "counting sort", weight: 1.8 },
    { term: "radix sort", weight: 1.8 },
  
    // === SYSTEM DESIGN - CORE ===
    { term: "system design", weight: 2.3 },
    { term: "distributed systems", weight: 2.3 },
    { term: "scalability", weight: 1.9 },
    { term: "high availability", weight: 2.0 },
    { term: "fault tolerance", weight: 2.0 },
    { term: "load balancing", weight: 2.0 },
    { term: "horizontal scaling", weight: 1.9 },
    { term: "vertical scaling", weight: 1.8 },
    { term: "bottleneck", weight: 1.7 },
    { term: "throughput", weight: 1.7 },
    { term: "latency", weight: 1.7 },
    { term: "sla", weight: 1.6 },
    { term: "slo", weight: 1.6 },
  
    // === DATABASES ===
    { term: "database", weight: 1.5 },
    { term: "sql", weight: 1.3 },
    { term: "nosql", weight: 1.5 },
    { term: "acid", weight: 2.0 },
    { term: "base", weight: 1.7 },
    { term: "cap theorem", weight: 2.3 },
    { term: "consistency", weight: 1.6 },
    { term: "replication", weight: 1.6 },
    { term: "sharding", weight: 2.1 },
    { term: "partitioning", weight: 1.9 },
    { term: "indexing", weight: 1.7 },
    { term: "b-tree index", weight: 2.1 },
    { term: "write ahead log", weight: 2.2 },
    { term: "lsm tree", weight: 2.3 },
    { term: "mvcc", weight: 2.2 },
    { term: "two phase commit", weight: 2.2 },
    { term: "eventual consistency", weight: 2.0 },
    { term: "strong consistency", weight: 2.0 },
    { term: "transactions", weight: 1.6 },
    { term: "deadlock", weight: 1.9 },
  
    // === CACHING ===
    { term: "caching", weight: 1.7 },
    { term: "cache invalidation", weight: 2.1 },
    { term: "cache eviction", weight: 2.0 },
    { term: "write through", weight: 1.9 },
    { term: "write back", weight: 1.9 },
    { term: "cdn", weight: 1.6 },
    { term: "redis", weight: 1.5 },
    { term: "memcached", weight: 1.5 },
  
    // === DISTRIBUTED SYSTEMS CONCEPTS ===
    { term: "consensus", weight: 2.2 },
    { term: "raft", weight: 2.3 },
    { term: "paxos", weight: 2.3 },
    { term: "vector clock", weight: 2.3 },
    { term: "gossip protocol", weight: 2.2 },
    { term: "consistent hashing", weight: 2.3 },
    { term: "leader election", weight: 2.1 },
    { term: "quorum", weight: 2.1 },
    { term: "idempotency", weight: 2.0 },
    { term: "at least once delivery", weight: 2.0 },
    { term: "exactly once delivery", weight: 2.1 },
    { term: "two generals problem", weight: 2.2 },
  
    // === MESSAGING & STREAMING ===
    { term: "message queue", weight: 1.9 },
    { term: "event driven", weight: 1.8 },
    { term: "kafka", weight: 1.7 },
    { term: "pub sub", weight: 1.8 },
    { term: "event sourcing", weight: 2.0 },
    { term: "cqrs", weight: 2.1 },
    { term: "stream processing", weight: 1.9 },
    { term: "backpressure", weight: 2.1 },
  
    // === MICROSERVICES & ARCHITECTURE ===
    { term: "microservices", weight: 1.8 },
    { term: "service mesh", weight: 1.9 },
    { term: "api gateway", weight: 1.8 },
    { term: "circuit breaker", weight: 2.1 },
    { term: "rate limiting", weight: 1.9 },
    { term: "bulkhead pattern", weight: 2.0 },
    { term: "saga pattern", weight: 2.1 },
    { term: "strangler fig", weight: 2.0 },
    { term: "domain driven design", weight: 1.9 },
    { term: "bounded context", weight: 2.0 },
  
    // === CONCURRENCY ===
    { term: "concurrency", weight: 1.9 },
    { term: "parallelism", weight: 1.8 },
    { term: "race condition", weight: 2.0 },
    { term: "mutex", weight: 1.9 },
    { term: "semaphore", weight: 1.9 },
    { term: "lock free", weight: 2.2 },
    { term: "compare and swap", weight: 2.1 },
    { term: "thread pool", weight: 1.8 },
    { term: "async await", weight: 1.5 },
    { term: "coroutine", weight: 1.8 },
    { term: "actor model", weight: 2.0 },
  
    // === NETWORKING ===
    { term: "tcp", weight: 1.5 },
    { term: "http2", weight: 1.6 },
    { term: "websocket", weight: 1.5 },
    { term: "grpc", weight: 1.7 },
    { term: "rest api", weight: 1.3 },
    { term: "long polling", weight: 1.7 },
    { term: "connection pooling", weight: 1.8 },
    { term: "dns", weight: 1.4 },
    { term: "ssl tls", weight: 1.4 },
  
    // === STORAGE & INFRASTRUCTURE ===
    { term: "object storage", weight: 1.6 },
    { term: "block storage", weight: 1.6 },
    { term: "columnar storage", weight: 2.0 },
    { term: "data warehouse", weight: 1.7 },
    { term: "olap", weight: 1.9 },
    { term: "oltp", weight: 1.9 },
    { term: "replication lag", weight: 2.0 },
  
    // === OBSERVABILITY ===
    { term: "observability", weight: 1.8 },
    { term: "distributed tracing", weight: 2.0 },
    { term: "metrics", weight: 1.4 },
    { term: "alerting", weight: 1.4 },
    { term: "chaos engineering", weight: 2.1 },
  
  ];
  
 
  
  export type ContentDomain = 
  | "DSA"
  | "SYSTEM_DESIGN" 
  | "LANGUAGE_SPECIFIC"
  | "GENERAL_ENGINEERING";

export type AuthorityLevel =
  | "CANONICAL"
  | "INSTITUTIONAL"  
  | "ESTABLISHED"
  | "COMMUNITY"
  | "UNKNOWN";

export interface SourceProfile {
  name: string;
  domains: string[];
  authority: AuthorityLevel;
  primaryDomain: ContentDomain;
  authorityScore: number;
  minQualityScore: number;
  minWordCount: number;
  requireCodeExamples: boolean;
  searchPrecision: SearchPrecision;
}

export const SOURCE_CONFIG = {

  // -------------------------------------------------------------------------
  // DSA / ALGORITHMS — purpose-built, canonical
  // -------------------------------------------------------------------------
  DSA_CANONICAL: {
    name: "Canonical DSA Sources",
    authority: "CANONICAL",
    primaryDomain: "DSA",
    domains: [
      "geeksforgeeks.org",
      "leetcode.com",
      "neetcode.io",
      "cp-algorithms.com",
      "usaco.guide",
      "codeforces.com",
      "algo.monster",
      "algoexpert.io",
      "thealgorithms.github.io",
      "visualgo.net",        // moved from Tier 3 — visualization IS canonical for DSA
    ],
    authorityScore: 95,
    minQualityScore: 20,
    minWordCount: 100,
    requireCodeExamples: true,   // DSA without code is not DSA
    searchPrecision: "HIGH" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // SYSTEM DESIGN — company engineering blogs, institutional
  // Not "below" DSA canonical — different authority for different content
  // -------------------------------------------------------------------------
  SYSTEM_DESIGN_INSTITUTIONAL: {
    name: "Company Engineering Blogs",
    authority: "INSTITUTIONAL",
    primaryDomain: "SYSTEM_DESIGN",
    domains: [
      "netflixtechblog.com",
      "eng.uber.com",
      "engineering.fb.com",
      "engineering.atspotify.com",
      "slack.engineering",
      "shopify.engineering",
      "dropbox.tech",
      "airbnb.engineering",
      "doordash.engineering",
      "robinhood.engineering",
      "engineering.pinterest.com",
      "engineering.grab.com",
      "engineering.khanacademy.org",
      "canvatechblog.com",
      "wix.engineering",
      "eng.lyft.com",
      "engineering.razorpay.com",
      "engineering.zalando.com",
      "engineeringblog.yelp.com",
      "developer.squareup.com",
      "devblog.paypal.com",
      "tech.deliveroo.com",
      "tech.instacart.com",
      "technology.riotgames.com",
      "medium.engineering",
      "engineering.monzo.com",
      "engineering.squarespace.com",
      "engineering.gusto.com",
      "engineering.hellofresh.com",
      "engineering.prezi.com",
      "tech.trivago.com",
    ],
    authorityScore: 93,
    minQualityScore: 20,          // lowered — narrative posts without heavy structure still valuable
    minWordCount: 300,
    requireCodeExamples: false,   // system design posts are architecture, not code
    searchPrecision: "VERY_HIGH" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // SYSTEM DESIGN — established individual authors and research-adjacent sites
  // These are named people with track records, not platforms
  // -------------------------------------------------------------------------
  SYSTEM_DESIGN_ESTABLISHED: {
    name: "Established System Design Authors",
    authority: "ESTABLISHED",
    primaryDomain: "SYSTEM_DESIGN",
    domains: [
      "martin.kleppmann.com",      // DDIA author
      "martinfowler.com",          // decades of patterns work
      "aphyr.com",                 // Jepsen, distributed systems analysis
      "the-paper-trail.org",       // Henry Robinson, consensus algorithms
      "brooker.co.za",             // Marc Brooker, AWS
      "muratbuffalo.blogspot.com", // distributed systems researcher
      "notes.eatonphil.com",       // Phil Eaton, databases from scratch
      "highscalability.com",       // long-running systems design aggregator
      "allthingsdistributed.com",  // Werner Vogels, AWS CTO
      "architecturenotes.co",
      "systemdesign.one",
      "bytebytego.com",
      "hellointerview.com",
      "pragmaticengineer.com",
      "staffeng.com",
      "fasterthanli.me",           // moved from Tier 5 — Amos is an established author
    ],
    authorityScore: 90,
    minQualityScore: 30,
    minWordCount: 400,
    requireCodeExamples: false,
    searchPrecision: "VERY_HIGH" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // LANGUAGE / FRAMEWORK SPECIFIC — official docs and canonical references
  // -------------------------------------------------------------------------
  LANGUAGE_CANONICAL: {
    name: "Official Language and Framework Docs",
    authority: "CANONICAL",
    primaryDomain: "LANGUAGE_SPECIFIC",
    domains: [
      "doc.rust-lang.org",
      "rust-lang.org",
      "python.org",
      "docs.microsoft.com",
      "javascript.info",         // not official but de facto canonical for JS
      "realpython.com",
      "doc.rust-lang.org",
      "redis.io",
      "cassandra.apache.org",
      "mongodb.com",
      "clickhouse.com",
      "cockroachlabs.com",
      "planetscale.com",
      "pingcap.com",
      "tigerbeetle.com",
      "abseil.io",
    ],
    authorityScore: 88,
    minQualityScore: 25,
    minWordCount: 150,
    requireCodeExamples: true,
    searchPrecision: "HIGH" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // EDUCATION — structured learning platforms
  // Higher quality bar because content quality varies wildly on these platforms
  // -------------------------------------------------------------------------
  EDUCATIONAL_PLATFORMS: {
    name: "Educational Platforms",
    authority: "COMMUNITY",
    primaryDomain: "DSA",
    domains: [
      "educative.io",
      "programiz.com",
      "javatpoint.com",
      "tutorialspoint.com",
      "scaler.com",
      "interviewbit.com",
      "interviewready.io",
      "codesignal.com",
      "careercup.com",
      "css-tricks.com",
    ],
    authorityScore: 78,
    minQualityScore: 35,
    minWordCount: 250,
    requireCodeExamples: true,
    searchPrecision: "HIGH" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // GENERAL ENGINEERING — broader community, higher bar required
  // dev.to and hashnode are platforms — content quality varies enormously
  // medium.com is a platform — only specific publications should be trusted
  // stackoverflow is reference material not articles
  // -------------------------------------------------------------------------
  COMMUNITY_TECHNICAL: {
    name: "Community Technical Sites",
    authority: "COMMUNITY",
    primaryDomain: "GENERAL_ENGINEERING",
    domains: [
      "stackoverflow.com",
      "dev.to",
      "hashnode.com",
      // NOTE: medium.com and substack.com intentionally excluded
      // They are platforms, not sources. Specific publications
      // on these platforms should be added to ESTABLISHED tiers
      // individually when you encounter them worth trusting.
    ],
    authorityScore: 65,
    minQualityScore: 50,
    minWordCount: 400,
    requireCodeExamples: true,
    searchPrecision: "MEDIUM" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // CLOUD PROVIDERS — official docs and blogs
  // -------------------------------------------------------------------------
  CLOUD_OFFICIAL: {
    name: "Cloud Provider Official Content",
    authority: "INSTITUTIONAL",
    primaryDomain: "SYSTEM_DESIGN",
    domains: [
      "aws.amazon.com",
      "cloud.google.com",
    ],
    authorityScore: 85,
    minQualityScore: 20,
    minWordCount: 200,
    requireCodeExamples: false,
    searchPrecision: "HIGH" as SearchPrecision,
  },

  // -------------------------------------------------------------------------
  // UNKNOWN — strict gates, high bar
  // -------------------------------------------------------------------------
  UNKNOWN: {
    name: "Unknown Sources",
    authority: "UNKNOWN",
    primaryDomain: "GENERAL_ENGINEERING",
    domains: [],
    authorityScore: 40,
    minQualityScore: 65,
    minWordCount: 700,
    requireCodeExamples: true,
    searchPrecision: "LOW" as SearchPrecision,
  },

} satisfies Record<string, SourceProfile>;
export type Source_Name = keyof typeof SOURCE_CONFIG;
  