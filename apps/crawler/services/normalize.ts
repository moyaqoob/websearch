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
        content: article.content || '',
        is_indexed:0,
        crawl_timestamp: crawlTimestamp,
        published_date: article.published_date || null,
        content_hash: article.content_hash ?? ""
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
  