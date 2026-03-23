export interface CrawledArticle {
  id: string;
  url: string;
  url_normalized: string;
  domain: string;
  title: string;
  content: string;
  is_indexed:number,
  crawl_timestamp: string;
  published_date:string | null,
  content_hash: string;
}

export interface CrawledSignal {
  article_id:string;
  quality_score: number;
  readability_score: number;
  authority_score: number;
  freshness_score: number;
  popularity_score: number;
}

export type SearchPrecision = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export interface RankedSignals {
  article_id:string;
  authority_score: number;
  quality_score: number;
  keyword_relevance_score: number;
  freshness_score: number;
  readability_score: number;
}
