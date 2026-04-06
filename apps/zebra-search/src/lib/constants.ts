/** Base URL for the indexer API (no trailing slash). Empty string uses same-origin paths (Vite dev proxy). */
export const API_BASE = import.meta.env.VITE_API_BASE ?? '';

export const FILTER_TABS = [
  'All',
  'Algorithms',
  'Data Structures',
  'System Design',
  'Competitive',
  'Articles',
  'Tutorials',
  'Problems',
] as const;

export type FilterTab = (typeof FILTER_TABS)[number];

export const SEARCH_HINTS = [
  'LRU cache',
  'consistent hashing',
  'segment tree',
  'rate limiting',
  'BFS vs DFS',
  'trie implementation',
];

export const STATS = [
  { num: '50K+', label: 'indexed articles' },
  { num: '120+', label: 'curated sources' },
  { num: 'BM25', label: 'ranking engine' },
  { num: '0',    label: 'ads. ever.' },
];

export const CURATED_SOURCES = [
  'GeeksforGeeks', 'Baeldung', 'LeetCode', 'Codeforces',
  'Netflix Tech Blog', 'Uber Engineering', 'Cloudflare Blog',
  'Martin Fowler', 'High Scalability', 'CP-Algorithms',
  'AlgoExpert', 'ByteByteGo',
];

export const FEATURES = [
  { icon: '⚡', color: 'lime',    title: 'BM25 + Authority Scoring',  desc: 'Four-signal fusion: relevance, quality, authority, and freshness. No black box.' },
  { icon: '🎯', color: 'cyan',    title: 'Curated Corpus',            desc: 'Only authoritative sources: GFG, Baeldung, engineering blogs. No spam farms.' },
  { icon: '🔬', color: 'magenta', title: 'Domain-Aware Indexing',     desc: 'Full-text indexing across title, body, domain signals. Porter stemming.' },
  { icon: '📐', color: 'amber',   title: 'Freshness Decay',           desc: 'Score normalizer with freshness decay — older content degrades gracefully.' },
  { icon: '🏗',  color: 'lime',    title: 'System Design Coverage',    desc: 'CAP theorem to Kafka internals. Engineering blogs from Netflix, Uber, Cloudflare.' },
  { icon: '🦓', color: 'cyan',    title: 'Zero Ads. Ever.',           desc: 'No sponsored links. No SEO gaming. No tracking pixels. Your attention stays yours.' },
] as const;
