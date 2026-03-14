import Database from "bun:sqlite";
import type { CrawledArticle } from "../utils";

export class Store {
  constructor(private db: Database) {}

  async store(article: CrawledArticle): Promise<boolean> {
    console.log(`\n💾 STAGE 7: STORE`);

    try {
      // Step 7.1: Insert into database
      const stmt = this.db.prepare(`
        INSERT INTO articles (
          id, url, url_normalized, domain, title, snippet, content,
          word_count, author, published_date, updated_date, crawl_timestamp,
          category, difficulty, quality_score, readability_score,
          authority_score, freshness_score, popularity_score,
          content_hash, is_indexed, s3_snippet_key, s3_content_key,
          embedding_vector_json
        ) VALUES (
          $id, $url, $url_normalized, $domain, $title, $snippet, $content,
          $word_count, $author, $published_date, $updated_date, $crawl_timestamp,
          $category, $difficulty, $quality_score, $readability_score,
          $authority_score, $freshness_score, $popularity_score,
          $content_hash, $is_indexed, $s3_snippet_key, $s3_content_key,
          $embedding_vector_json
        )
      `);

      stmt.run(`
        $id:                   article.id,
        $url:                  article.url,
        $url_normalized:       article.url_normalized,
        $domain:               article.domain,
        $title:                article.title,
        $snippet:              article.snippet,
        $content:              article.content,
        $word_count:           article.word_count,
        $author:               article.author,
        $published_date:       article.published_date,
        $updated_date:         article.updated_date,
        $crawl_timestamp:      article.crawl_timestamp,
        $category:             article.category,
        $difficulty:           article.difficulty,
        $quality_score:        article.quality_score,
        $readability_score:    article.readability_score,
        $authority_score:      article.authority_score,
        $freshness_score:      article.freshness_score,
        $popularity_score:     article.popularity_score,
        $content_hash:         article.content_hash,
        $is_indexed:           article.is_indexed,
        $s3_snippet_key:       article.s3_snippet_key,
        $s3_content_key:       article.s3_content_key,
        $embedding_vector_json: article.embedding_vector_json,
        `
      );

   
      console.log(`\n🟢 ARTICLE STORED SUCCESSFULLY`);
      return true;

    } catch (error) {
      console.error(
        `   ❌ Storage failed: ${error instanceof Error ? error.message : "Unknown"}`
      );
      return false;
    }
  }
}

export default Store;