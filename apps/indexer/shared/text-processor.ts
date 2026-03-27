import { PorterStemmer, stopwords as StopwordsEn } from 'natural';
import type { TokenWithMetadata } from '../types/utils.ts';

// ============================================================
// Text Processor
//
// This is the most consequential single component in the
// search engine. Whatever transformation you apply at index
// time MUST be applied identically at query time. If you
// stem at index time but not at query time, "algorithms"
// will not match "algorithm". If you lowercase at index time
// but not at query time, "BFS" will not match "bfs".
//
// The pipeline: raw text → lowercase → tokenize → remove
// stopwords → stem → return.
//
// One design decision worth noting: we're keeping technical
// terms with numbers ("o(n)", "o(1)", "b-tree", "p2p") because
// DSA content is full of them and stripping them loses signal.
// ============================================================

// DSA and system design specific stopwords to ADD to the
// standard English set. These are so common in this corpus
// that they carry near-zero discriminative power.
const DOMAIN_STOPWORDS = new Set([
  'example', 'note', 'following', 'figure', 'section',
  'algorithm', 'data', 'structure', 'system', 'design',
  'implementation', 'approach', 'method', 'technique',
  'solution', 'problem', 'given', 'using', 'used',
]);

// Terms that look like stopwords but are highly meaningful
// in DSA context — we PROTECT these from removal.
const PROTECTED_TERMS = new Set([
  'tree', 'graph', 'heap', 'queue', 'stack', 'array',
  'list', 'map', 'set', 'hash', 'sort', 'search',
  'merge', 'split', 'insert', 'delete', 'find', 'get',
  'put', 'push', 'pop', 'top', 'node', 'edge', 'path',
  'cycle', 'loop', 'index', 'key', 'value', 'cache',
  'load', 'read', 'write', 'lock', 'block', 'queue',
  'rate', 'limit', 'scale', 'shard', 'partition',
  'replica', 'leader', 'follower', 'primary', 'secondary',
]);

const STOPWORDS = new Set([
  ...StopwordsEn,
  ...DOMAIN_STOPWORDS,
]);

// Minimum token length — single chars are almost never useful
const MIN_TOKEN_LENGTH = 2;

// Max token length — runaway tokens from malformed HTML
const MAX_TOKEN_LENGTH = 50;

export class TextProcessor {
  // The tokenization regex. This is doing more work than it looks:
  // \b[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?\b
  // Matches: words, hyphenated terms (b-tree, red-black), and
  // terms with numbers (o(n) becomes 'on' after cleaning, which
  // isn't ideal — but alphanumeric tokens like "sha256", "utf8",
  // "p2p" work perfectly).
  private static readonly TOKEN_REGEX = /[a-z0-9]+(?:['\-][a-z0-9]+)*/g;

  /**
   * Tokenize a field (title or content) into terms with positions.
   * Position is relative to the start of the field.
   */
  tokenizeField(
    text: string,
    field: 'title' | 'content',
    positionOffset: number = 0
  ): TokenWithMetadata[] {
    const tokens: TokenWithMetadata[] = [];
    const normalized = text.toLowerCase();
    let match: RegExpExecArray | null;
    let position = positionOffset;

    TextProcessor.TOKEN_REGEX.lastIndex = 0; // reset stateful regex

    while ((match = TextProcessor.TOKEN_REGEX.exec(normalized)) !== null) {
      const raw = match[0]

      // Length guard
      if (raw.length < MIN_TOKEN_LENGTH || raw.length > MAX_TOKEN_LENGTH) {
        continue
      }

      // Remove trailing hyphens/apostrophes from contraction artifacts
      const cleaned = raw.replace(/^['\-]+|['\-]+$/g, '');
      if (!cleaned || cleaned.length < MIN_TOKEN_LENGTH) continue;

      if (!PROTECTED_TERMS.has(cleaned) && STOPWORDS.has(cleaned)) {
        continue;
      }

      // Stem. PorterStemmer is aggressive; it correctly handles
      // "searching" → "search", "indexed" → "index", "sorted" → "sort"
      // which is exactly what we want for DSA content.
      const stemmed = PorterStemmer.stem(cleaned);
      if (!stemmed || stemmed.length < MIN_TOKEN_LENGTH) continue;

      tokens.push({ term: stemmed, position: position++, field });
    }

    return tokens;
  }

  /**
   * Tokenize a complete document (title + content).
   * Title tokens come first (positions 0..n), then content tokens
   * (positions n+1..m). This contiguous stream supports phrase
   * queries across fields, with a gap to prevent cross-field
   * phrase matches.
   */
  tokenizeDocument(
    title: string,
    content: string
  ): { tokens: TokenWithMetadata[]; docLength: number } {
    const titleTokens = this.tokenizeField(title, 'title', 0);

    // Gap of 100 positions between title and content to prevent
    // spurious phrase matches that straddle the field boundary.
    const FIELD_GAP = 100;
    const contentTokens = this.tokenizeField(
      content,
      'content',
      titleTokens.length + FIELD_GAP
    );

    const tokens = [...titleTokens, ...contentTokens];
    const docLength = tokens.length;

    return { tokens, docLength };
  }

  /**
   * Tokenize a query string.
   * Identical pipeline to document tokenization — this is critical.
   * The contract: what goes in at index time must match what comes
   * out at query time.
   */
  tokenizeQuery(query: string): string[] {
    const tokens = this.tokenizeField(query, 'content', 0);
    return [...new Set(tokens.map((t) => t.term))]; // deduplicate
  }

  /**
   * Extract a snippet from content around the first occurrence
   * of any query term. Returns a ~200-char excerpt.
   */
  extractSnippet(content: string, queryTerms: string[]): string {
    const lowerContent = content.toLowerCase();
    const SNIPPET_RADIUS = 120;

    // Find the earliest hit
    let bestPos = -1;
    for (const term of queryTerms) {
      // Search for the unstemmed term (users see the original text)
      const pos = lowerContent.indexOf(term.slice(0, 4)); // prefix match
      if (pos !== -1 && (bestPos === -1 || pos < bestPos)) {
        bestPos = pos;
      }
    }

    if (bestPos === -1) {
      // No hit found — return the beginning
      return content.slice(0, SNIPPET_RADIUS * 2).trim() + '...';
    }

    const start = Math.max(0, bestPos - SNIPPET_RADIUS);
    const end = Math.min(content.length, bestPos + SNIPPET_RADIUS);
    let snippet = content.slice(start, end).trim();

    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';

    return snippet;
  }
}

export const textProcessor = new TextProcessor();