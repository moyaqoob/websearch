/**
 * Shared test fixtures — real URLs grouped by expected category.
 * Each URL points to a page with actual content suitable for extraction testing.
 */

export const testArticles = [
  // algorithms-and-data-structures
  {
    url: "https://cp-algorithms.com/graph/dijkstra.html",
    expected: "algorithms-and-data-structures",
  },
  {
    url: "https://cp-algorithms.com/data_structures/segment_tree.html",
    expected: "algorithms-and-data-structures",
  },

  // system-design
  {
    url: "https://netflixtechblog.com/zuul-2-the-netflix-journey-to-asynchronous-non-blocking-systems-45947377fb5c",
    expected: "system-design",
  },
  {
    url: "https://slack.engineering/scaling-slacks-job-queue",
    expected: "system-design",
  },

  // distributed-systems
  {
    url: "https://martin.kleppmann.com/2015/05/11/please-stop-calling-databases-cp-or-ap.html",
    expected: "distributed-systems",
  },
  {
    url: "https://aphyr.com/posts/313-strong-consistency-models",
    expected: "distributed-systems",
  },

  // databases
  {
    url: "https://www.postgresql.org/docs/current/mvcc-intro.html",
    expected: "databases",
  },
  {
    url: "https://planetscale.com/blog/how-does-database-sharding-work",
    expected: "databases",
  },

  // software-engineering
  {
    url: "https://martinfowler.com/articles/microservices.html",
    expected: "software-engineering",
  },
  {
    url: "https://www.joelonsoftware.com/2002/11/11/the-law-of-leaky-abstractions",
    expected: "software-engineering",
  },
] as const;

export type TestArticle = (typeof testArticles)[number];

/** Pick N random URLs from fixtures (defaults to 3). */
export function pickUrls(n = 3): string[] {
  const shuffled = [...testArticles].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n).map((a) => a.url);
}

/** All fixture URLs as a flat array. */
export const allTestUrls = testArticles.map((a) => a.url);

/** Domains present in the fixtures (deduplicated). */
export const testDomains = [
  ...new Set(testArticles.map((a) => new URL(a.url).hostname)),
];
