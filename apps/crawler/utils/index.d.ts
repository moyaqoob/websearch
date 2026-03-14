// all the interfaces here
export interface CrawledArticle {
  id: string;

  url: string;
  url_normalized: string;
  domain: string;

  title: string;
  snippet: string;
  content: string;
  word_count: number;

  author?: string | null;
  published_date?: string | null;
  updated_date?: string | null;

  crawl_timestamp: string;

  category?: string | null;
  difficulty?: string | null;


  //metrics
  quality_score: number;
  readability_score: number;
  authority_score: number;
  freshness_score: number;
  popularity_score: number;

  content_hash: string;
  source_tier?: string | null;

  is_indexed: number;

  s3_snippet_key?: string | null;
  s3_content_key?: string | null;

  embedding_vector_json?: string | null;
}

export type SearchPrecision = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface RankingSignals {
  authority_score: number;
  quality_score: number;
  keyword_relevance_score: number;
  freshness_score: number;
  readability_score: number;
}

export interface RankedArticle extends Partial<CrawledArticle>, RankingSignals {
  tier: string;
  ranking_score: number;
  content_hash: string;
}
