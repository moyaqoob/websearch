import type { CrawledArticle } from "../utils/index";
import uuid4 from "uuid4";

export class Normalize {
    normalize(article: Partial<CrawledArticle>, url: string): CrawledArticle {
      // Generate unique ID
      const id = uuid4();

      // Normalize URL
      const urlNormalized = this.normalizeUrl(url);
  
      // Extract domain
      const domain = new URL(url).hostname || 'unknown';
  
      // Current timestamp
      const crawlTimestamp = new Date().toISOString();
  
      // Complete article
      const complete: CrawledArticle = {
        id,
        url,
        url_normalized: urlNormalized,
        domain,
        title: article.title || 'Untitled',
        snippet: article.snippet || '',
        content: article.content || '',
        word_count: article.word_count || 0,
        author: article.author || null,
        published_date: article.published_date || null,
        updated_date: null,
        crawl_timestamp: crawlTimestamp,
        category: article.category || null,
        difficulty: null,
        quality_score: article.quality_score || 0,
        readability_score: article.readability_score || 0,
        authority_score: article.authority_score || 0,
        freshness_score: article.freshness_score || 0,
        popularity_score: article.popularity_score || 0,
        content_hash: article.content_hash || '',
        source_tier: article.source_tier || null,
        is_indexed: 0,
        s3_snippet_key: null,
        s3_content_key: null,
        embedding_vector_json: null,
      };

      return complete;
    }
  
    private normalizeUrl(url: string): string {
      try {
        const parsed = new URL(url);
        return parsed.toString().split('#')[0]; // Remove fragment
      } catch {
        return url;
      }
    }
  }
  