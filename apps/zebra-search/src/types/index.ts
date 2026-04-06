export interface SearchResult {
  id?: string | number;
  url: string;
  title: string;
  description?: string;
  snippet?: string;
  excerpt?: string;
  score?: number;
  bm25_score?: number;
  relevance?: number;
  domain_type?: string;
  authority_level?: string;
  content_domain?: string;
  tags?: string[];
}

export interface SearchResponse {
  results?: SearchResult[];
  data?: SearchResult[];
  total?: number;
  count?: number;
}

export type ApiStatus = 'loading' | 'live' | 'dead';

export interface SourceFilter {
  name: string;
  count: number;
  enabled: boolean;
}

export type SortOrder = 'relevance' | 'freshness' | 'authority';

export type FilterTab =
  | 'All'
  | 'Algorithms'
  | 'Data Structures'
  | 'System Design'
  | 'Competitive'
  | 'Articles'
  | 'Tutorials'
  | 'Problems';
