import Database from "bun:sqlite";
import type { CrawledArticle,CrawledSignal } from "../utils";

export class Store {
  constructor(private db: Database) {}

  async store(article: CrawledArticle,signal:CrawledSignal): Promise<boolean> {
    console.log(`\n💾 STAGE 7: STORE`);
    try {
      // Step 7.1: Insert into database
      const articleStmt = this.db.prepare(`
        INSERT INTO articles (
          id, url, url_normalized, domain, title, content,
          content_hash, crawl_timestamp,
        ) VALUES (
          $id, $url, $url_normalized, $domain, $title, $content,
          $content_hash, $crawl_timestamp,
        )
      `);

      const signalStmt = this.db.prepare(`
        INSERT INTO signals (
          article_id,
          quality_score,
          readability_score,
          authority_score,
          freshness_score,
          popularity_score
        ) VALUES (
          $article_id,
          $quality_score,
          $readability_score,
          $authority_score,
          $freshness_score,
          $popularity_score
        )
      `);

      const insert = this.db.transaction((article) => {
        articleStmt.run({
          $id: article.id,
          $url: article.url,
          $url_normalized: article.url_normalized,
          $domain: article.domain,
          $title: article.title,
          $content: article.content,
          $content_hash: article.content_hash,
          $crawl_timestamp: article.crawl_timestamp,
          $published_date:article.published_date
        });

        signalStmt.run({
          $article_id: article.id,
          $quality_score: signal.quality_score,
          $readability_score: signal.readability_score,
          $authority_score: signal.authority_score,
          $freshness_score: signal.freshness_score,
          $popularity_score: signal.popularity_score,
        });
      });

      insert(article);

      console.log(`ARTICLE STORED SUCCESSFULLY`);
      return true;
    } catch (error) {
      console.error(
        ` Storage failed: ${error instanceof Error ? error.message : "Unknown"}`,
      );
      return false;
    }
  }
}

export default Store;
