import * as cheerio from "cheerio";
import { fetch_Page } from "./genesis/urlfetcher";

const baseUrl = "https://palantir.com";


export function extractInternalLinks(html: string, baseUrl: string): string[] {
  const $ = cheerio.load(html);
  const links = new Set<string>();

  const base = new URL(baseUrl);

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;

    if (
      href.startsWith("javascript:") ||
      href.startsWith("mailto:") ||
      href.startsWith("#")
    )
      return;

    try {
      const absolute = new URL(href, baseUrl);

      // keep only same-domain links
      if (absolute.hostname === base.hostname) {
        links.add(absolute.toString());
      }
    } catch {}
  });

  return [...links];
}

export function extractLinksFromSitemap(xml: string): string[] {
  const $ = cheerio.load(xml, { xmlMode: true });

  const links: string[] = [];
    console.log("reached here")
  $("loc").each((_, el) => {
    const url = $(el).text().trim();
    console.log("url", url);
    if (url) links.push(url);
  });

  return [...links];
}
const html = await fetch_Page("https://palantir.com");
const xml = extractInternalLinks(html, baseUrl);
const links = extractLinksFromSitemap("https://www.palantir.com/sitemap.xml");
console.log(links);
