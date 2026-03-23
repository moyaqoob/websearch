import * as cheerio from "cheerio";
import type { CrawledArticle } from "../utils/index";
import { isLikelyArticleUrl, normalizeQueueUrl } from "./urlFilters";

export interface ExtractResult {
  article: Partial<CrawledArticle>;
  discoveredUrls: string[];
}

export class Extract {
  extract(html: string, url: string): ExtractResult {
    const $ = cheerio.load(html);

    $("script, style, nav, footer, .ad, .comment, .sidebar").remove();

    const title = this.extractTitle($, html);
    const content = this.extractContent($);
    const author = this.extractAuthor($);
    const publishedDate = this.extractDate($);
    const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    const category = this.detectCategory(title, content);
    const discoveredUrls = this.extractInternalLinks($, url);
    return {
      article: {
        title,
        content,
        published_date: publishedDate,
      },
      discoveredUrls,
    };
  }

  private extractTitle($: any, html: string): string {
    return (
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      "Untitled"
    );
  }

  private extractContent($: any): string {
    const container =
      $('article, main, [role="main"], .content, .post').first() ||
      $("body");

    container.find("pre, code").each((_: unknown, elem: unknown) => {
      const snippet = $(elem).text().trim();
      if (!snippet) return;
      $(elem).replaceWith(`\n\`\`\`\n${snippet}\n\`\`\`\n`);
    });

    const content = (container.length > 0 ? container : $("body")).text();

    return content.replace(/\s+/g, " ").trim().substring(0, 100000);
  }

  private extractAuthor($: any): string | null {
    const author =
      $('[rel="author"]').text().trim() ||
      $(".author-name").text().trim() ||
      $('[itemprop="author"]').text().trim() ||
      null;

    return author || null;
  }

  private extractDate($: any): string | null {
    const dateStr =
      $("time").first().attr("datetime") ||
      $("meta[property='article:published_time']").attr("content") ||
      null;

    if (dateStr) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch {
        // Invalid date format, skip
      }
    }
    return null;
  }


  

  private detectCategory(title: string, content: string): string | null {
    const text = (title + " " + content).toLowerCase();

    const categories: Record<string, string[]> = {
      "algorithms-and-data-structures": [
        "algorithm",
        "sorting",
        "quick sort",
        "merge sort",
        "heap sort",
        "radix sort",
        "binary search",
        "dfs",
        "bfs",
        "depth first",
        "breadth first",
        "dynamic programming",
        "memoization",
        "tabulation",
        "greedy",
        "backtracking",
        "recursion",
        "divide and conquer",
        "time complexity",
        "space complexity",
        "big o",
        "amortized",
        "array",
        "linked list",
        "doubly linked",
        "stack",
        "queue",
        "deque",
        "hash table",
        "hash map",
        "hash function",
        "collision",
        "heap",
        "priority queue",
        "tree",
        "binary tree",
        "binary search tree",
        "avl tree",
        "red black tree",
        "b-tree",
        "trie",
        "segment tree",
        "fenwick tree",
        "graph",
        "adjacency list",
        "adjacency matrix",
        "shortest path",
        "dijkstra",
        "bellman ford",
        "topological sort",
        "minimum spanning tree",
        "union find",
        "disjoint set",
        "bloom filter",
        "skip list",
      ],

      "system-design": [
        "system design",
        "scalability",
        "horizontal scaling",
        "vertical scaling",
        "load balancer",
        "load balancing",
        "reverse proxy",
        "api gateway",
        "rate limiting",
        "cdn",
        "content delivery",
        "caching",
        "cache invalidation",
        "redis",
        "memcached",
        "database sharding",
        "partitioning",
        "replication",
        "microservices",
        "monolith",
        "service mesh",
        "event driven",
        "event sourcing",
        "cqrs",
        "message queue",
        "kafka",
        "rabbitmq",
        "pub sub",
        "high availability",
        "fault tolerance",
        "circuit breaker",
        "bulkhead",
        "idempotency",
        "consistency",
        "availability",
        "partition tolerance",
        "cap theorem",
        "eventual consistency",
        "strong consistency",
        "two phase commit",
        "saga pattern",
        "service discovery",
        "heartbeat",
        "health check",
        "back pressure",
        "throttling",
        "observability",
        "distributed tracing",
        "monitoring",
      ],

      "distributed-systems": [
        "distributed system",
        "distributed computing",
        "consensus",
        "raft",
        "paxos",
        "leader election",
        "quorum",
        "replication",
        "log replication",
        "write ahead log",
        "wal",
        "vector clock",
        "lamport clock",
        "causality",
        "linearizability",
        "serializability",
        "isolation",
        "snapshot isolation",
        "mvcc",
        "distributed transaction",
        "byzantine fault",
        "network partition",
        "split brain",
        "fencing",
        "lock",
        "distributed lock",
        "zookeeper",
        "etcd",
        "coordination",
        "membership protocol",
        "gossip protocol",
        "crdt",
        "conflict free",
        "geo distributed",
        "multi region",
        "clock synchronization",
        "ntp",
        "hybrid logical clock",
        "exactly once",
        "LRU",
        "at most once",
        "delivery semantics",
      ],

      databases: [
        "database",
        "sql",
        "nosql",
        "query",
        "query optimization",
        "query planner",
        "index",
        "indexing",
        "b-tree index",
        "lsm tree",
        "sstable",
        "compaction",
        "acid",
        "transaction",
        "deadlock",
        "lock contention",
        "vacuum",
        "postgresql",
        "mysql",
        "sqlite",
        "mongodb",
        "cassandra",
        "dynamodb",
        "rocksdb",
        "leveldb",
        "clickhouse",
        "columnar",
        "row store",
        "column store",
        "oltp",
        "olap",
        "data warehouse",
        "data lake",
        "schema",
        "normalization",
        "denormalization",
        "foreign key",
        "join",
        "execution plan",
        "explain analyze",
        "write amplification",
        "read amplification",
        "storage engine",
        "wal",
        "checkpoint",
        "connection pool",
        "cursor",
        "pagination",
        "full text search",
        "vector database",
        "embedding",
      ],

      "software-engineering": [
        "software architecture",
        "clean code",
        "refactoring",
        "design pattern",
        "solid",
        "single responsibility",
        "open closed",
        "dependency injection",
        "coupling",
        "cohesion",
        "abstraction",
        "encapsulation",
        "modularity",
        "technical debt",
        "code review",
        "testing",
        "unit test",
        "integration test",
        "tdd",
        "test driven",
        "ci cd",
        "continuous integration",
        "continuous deployment",
        "deployment",
        "devops",
        "infrastructure as code",
        "docker",
        "kubernetes",
        "container",
        "performance",
        "profiling",
        "benchmarking",
        "memory management",
        "garbage collection",
        "concurrency",
        "parallelism",
        "thread",
        "async",
        "non blocking",
        "event loop",
        "compiler",
        "runtime",
        "memory layout",
        "cache line",
        "branch prediction",
        "simd",
        "zero copy",
        "engineering culture",
        "on call",
        "post mortem",
        "incident",
        "runbook",
        "sla",
        "slo",
        "error budget",
        "api design",
        "rest",
        "grpc",
        "graphql",
        "versioning",
      ],
    };

    let bestCategory: string | null = null;
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;

      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestScore > 0 ? bestCategory : null;
  }

  private extractInternalLinks($: any, pageUrl: string): string[] {
    const sourceDomain = new URL(pageUrl).hostname;
    const links: string[] = [];
    let rawCount = 0;
    let normalizedCount = 0;
    let filteredCount = 0;

    $("a[href]").each((_i: number, elem: unknown) => {
      rawCount++;
      try {
        const href = $(elem).attr("href");
        if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;

        const absoluteUrl = normalizeQueueUrl(new URL(href, pageUrl).toString());
        normalizedCount++;

        if (isLikelyArticleUrl(absoluteUrl, sourceDomain)) {
          links.push(absoluteUrl);
          filteredCount++;
        }
      } catch {
        return;
      }
    });

    const unique = [...new Set(links)];
    console.log(
      `  Links: ${rawCount} raw → ${normalizedCount} normalized → ${filteredCount} passed filter → ${unique.length} unique`
    );
    return unique;
  }
}
