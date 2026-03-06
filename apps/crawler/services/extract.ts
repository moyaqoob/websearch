import * as cheerio from "cheerio";
import type { CrawledArticle } from "../utils";

class Extract {
  extract(html: string, url: string): Partial<CrawledArticle> {
    console.log(`\n🔍 STAGE 3: EXTRACT`);
    console.log(`   Parsing HTML...`);

    const $ = cheerio.load(html);

    // Remove noise
    $("script, style, nav, footer, .ad, .comment, .sidebar").remove();

    // Step 3.1: Extract Title
    const title = this.extractTitle($, html);
    console.log(`   ✅ Title: "${title}"`);

    // Step 3.2: Extract Content
    const content = this.extractContent($);
    console.log(`   ✅ Content: ${content.length} characters`);

    // Step 3.3: Extract Snippet (first 200 chars)
    const snippet = content.substring(0, 200);
    console.log(`   ✅ Snippet: "${snippet.substring(0, 50)}..."`);

    // Step 3.4: Extract Author
    const author = this.extractAuthor($);
    console.log(`   ✅ Author: ${author || "Unknown"}`);

    // Step 3.5: Extract Published Date
    const publishedDate = this.extractDate($);
    console.log(`   ✅ Published Date: ${publishedDate || "Unknown"}`);

    // Step 3.6: Extract Code Blocks (for DSA detection)
    const codeBlocks = this.extractCodeBlocks($);
    console.log(`   ✅ Code Blocks: ${codeBlocks.length}`);

    // Step 3.7: Calculate Word Count
    const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    console.log(`   ✅ Word Count: ${wordCount}`);

    // Step 3.8: Extract Category/Topics
    const category = this.detectCategory(title, content);
    console.log(`   ✅ Category: ${category || "General"}`);

    // Step 3.9: Extract Internal Links (for crawling more)
    const internalLinks = this.extractInternalLinks($, url);
    console.log(`   ✅ Internal Links: ${internalLinks.length}`);

    return {
      title,
      snippet,
      content,
      author,
      published_date: publishedDate,
      word_count: wordCount,
      category,
      // We'll fill in other fields in later stages
    };
  }

  private extractTitle($: any, html: string): string {
    return (
      $("h1").first().text().trim() ||
      $("title").text().trim() ||
      $("meta[property='og:title']").attr("content") ||
      "Untitled"
    );
  }

  private extractContent($: any): string {
    const content =
      $('article, main, [role="main"], .content, .post').text() ||
      $("body").text();

    return content.replace(/\s+/g, " ").trim().substring(0, 100000); // Limit to 100K chars
  }

  private extractAuthor($: any): string | null {
    const author =
      $('[rel="author"]').text().trim() ||
      $(".author-name").text().trim() ||
      $('[itemprop="author"]').text().trim() ||
      null;

    return author || null;
  }

  private extractDate($: any): string | null {
    const dateStr =
      $("time").first().attr("datetime") ||
      $("meta[property='article:published_time']").attr("content") ||
      null;

    if (dateStr) {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch (e) {
        console.error("Invalid Date");
      }
    }
    return null;
  }

  private extractCodeBlocks($: any): Array<{ code: string; language: string }> {
    const blocks: Array<{ code: string; language: string }> = [];

    $("pre code, code.language-*").each(
      (i: cheerio.CheerioAPI, elem: cheerio.CheerioAPI) => {
        const code = $(elem).text().trim();
        if (code.length > 20 && code.length < 5000) {
          blocks.push({
            code,
            language: this.detectCodeLanguage(code),
          });
        }
      },
    );

    return blocks;
  }

  private detectCodeLanguage(code: string): string {
    if (/def\s+\w+|import\s+\w+/.test(code)) return "python";
    if (/function\s+\w+|const\s+|=>/.test(code)) return "javascript";
    if (/public\s+class|System\.out/.test(code)) return "java";
    if (/#include|std::/.test(code)) return "cpp";
    return "unknown";
  }

  private detectCategory(title: string, content: string): string | null {
    const text = (title + " " + content).toLowerCase();

    const categories: Record<string, string[]> = {
      algorithms: [
        "algorithm",
        "sorting",
        "quick sort",
        "merge sort",
        "binary search",
        "dfs",
        "bfs",
        "dynamic programming",
        "greedy",
        "backtracking",
        "recursion",
        "time complexity",
      ],

      "data-structures": [
        "array",
        "linked list",
        "stack",
        "queue",
        "hash table",
        "hash map",
        "heap",
        "tree",
        "binary tree",
        "trie",
        "graph",
        "adjacency list",
      ],

      "system-design": [
        "system design",
        "scalability",
        "distributed system",
        "load balancer",
        "database sharding",
        "microservices",
        "event driven",
        "high availability",
        "fault tolerance",
        "message queue",
      ],
    };

    let bestCategory: string | null = null;
    let bestScore = 0;

    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;

      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          score++;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    return bestScore > 0 ? bestCategory : null;
  }

  private extractInternalLinks($: any, pageUrl: string): string[] {
    const domain = new URL(pageUrl).hostname;
    const links: string[] = [];

    $("a[href]").each((i: unknown, elem: unknown) => {
      try {
        const href = $(elem).attr("href");
        if (!href) return;

        const absoluteUrl = new URL(href, pageUrl).toString();

        if (
          new URL(absoluteUrl).hostname === domain &&
          !absoluteUrl.includes("#")
        ) {
          links.push(absoluteUrl);
        }
      } catch (e) {
        console.log("Invalid url");
      }
    });

    return [...new Set(links)]; // Deduplicate
  }
}
