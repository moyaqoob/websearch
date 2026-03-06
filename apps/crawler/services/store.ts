import Database from "better-sqlite3";
import type { CrawledArticle } from "../utils";
import {s3} from "./s3Client"
import { PutObjectCommand } from "@aws-sdk/client-s3";

class Store {
    constructor(private db: Database.Database) {}
  
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
  
        stmt.run(
          article.id,
          article.url,
          article.url_normalized,
          article.domain,
          article.title,
          article.snippet,
          article.content,
          article.word_count,
          article.author,
          article.published_date,
          article.updated_date,
          article.crawl_timestamp,
          article.category,
          article.difficulty,
          article.quality_score,
          article.readability_score,
          article.authority_score,
          article.freshness_score,
          article.popularity_score,
          article.content_hash,
          article.is_indexed,
          article.s3_snippet_key,
          article.s3_content_key,
          article.embedding_vector_json
        );
  
        console.log(`   ✅ Stored in SQLite`);
        async function uploadToS3(key:string,content:string){
            await s3.send(
                new PutObjectCommand({
                    Bucket:'crawler-content',
                    Key:key,
                    Body:content,
                    ContentType:"text/plain"
                })
            )
        }
        uploadToS3(article.id,article.content);
        
        // Step 7.2: (Optional) Upload to S3
        // console.log(`   ✅ Uploaded to S3`);
  
        console.log(`\n🟢 ARTICLE STORED SUCCESSFULLY`);
        return true;
  
      } catch (error) {
        console.log(`   ❌ Storage failed: ${error instanceof Error ? error.message : 'Unknown'}`);
        return false;
      }
    }
  }