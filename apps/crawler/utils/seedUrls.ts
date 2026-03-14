import fs from "fs"

export const seedUrls:string[] = fs.readFileSync("./utils/seed.txt","utf8")
.split("\n").map(u=>u.trim()).filter(Boolean)
  
  // Calculate expected article count
  export const EXPECTED_ARTICLE_COUNT = {
    geeksforgeeks: 400,
    baeldung: 150,
    medium: 100,
    leetcode: 100,
    devto: 50,
    scaler: 80,
    other: 120,
    total: 1000,
  };
  
  export const CRAWL_TARGETS = {
    phase1: 200, // Test phase
    phase2: 500, // Expansion
    phase3: 1000, // Full crawl
  };
  
  /**
   * DSA Topics Covered
   */
  export const DSA_TOPICS = [
    "arrays",
    "strings",
    "linked-lists",
    "stacks",
    "queues",
    "heaps",
    "hash-tables",
    "trees",
    "binary-search-tree",
    "binary-trees",
    "balanced-trees",
    "graphs",
    "tries",
    "segment-trees",
    "fenwick-trees",
    "union-find",
  ];
  
  /**
   * Algorithm Types Covered
   */
  export const ALGORITHM_TYPES = [
    "sorting",
    "searching",
    "dynamic-programming",
    "greedy",
    "backtracking",
    "divide-and-conquer",
    "graph-algorithms",
    "string-algorithms",
    "bit-manipulation",
    "mathematical-algorithms",
  ];
  
  /**
   * System Design Topics Covered
   */
  export const SYSTEM_DESIGN_TOPICS = [
    "scalability",
    "load-balancing",
    "caching",
    "database-design",
    "consistency",
    "availability",
    "distributed-systems",
    "microservices",
    "api-design",
    "security",
    "authentication",
    "message-queues",
    "cloud-architecture",
    "monitoring",
    "logging",
  ];
  
export default seedUrls;
