const FETCH_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024;

export function generateCrawlerHeaders() {
  return {
    "User-Agent": "Mozilla/5.0 (compatible; DSACrawler/1.0)",
    Accept: "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
  };
}

export class Fetcher {
  constructor(private readonly timeoutMs = FETCH_TIMEOUT_MS) {}

  async fetcher(url: string): Promise<string | null> {
    try {
      const headers = generateCrawlerHeaders();
      const httpFetch = globalThis.fetch;
      const response = await httpFetch(url, {
        headers,
        redirect: "follow",
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response?.ok) {
        console.error(
          `Fetch failed: HTTP ${response?.status} ${response?.statusText}`,
        );
        return null;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (
        !contentType.includes("text/html") &&
        !contentType.includes("text/plain") &&
        !contentType.includes("application/xhtml")
      ) {
        console.error(`Fetch skipped: non-html content (${contentType})`);
        return null;
      }

      const contentLength = Number(response.headers.get("content-length") ?? 0);

      if (contentLength > MAX_RESPONSE_BYTES) {
        console.error(`Fetch skipped: response too large (${contentLength})`);
        return null;
      }



      const html = response.text()
      return html;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "";
      if (name === "TimeoutError" || name === "AbortError") {
        console.error(`Fetch timeout: ${url}`);
      } else {
        console.error(
          `Fetch error: ${err instanceof Error ? err.message : String(err)}`,
        );
      }

      return null;
    }
  }
}