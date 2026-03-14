import { Database } from "bun:sqlite";
import type { CrawledArticle } from "../utils/index";

export class Validate {
  constructor(private db: Database) {}

  validate(article: Partial<CrawledArticle>): boolean {
    if (!article.title || article.title.length < 5) {
      return false;
    }

    if (article.content_hash) {
      const existing = this.db
        .prepare("SELECT id FROM articles WHERE content_hash = ?")
        .get(article.content_hash);

      if (existing) {
        return false;
      }
    }

    if (article.url) {
      const existing = this.db
        .prepare("SELECT id FROM articles WHERE url = ?")
        .get(article.url);

      if (existing) {
        return false;
      }
    }

    return true;
  }
}
