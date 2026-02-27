import axios from "axios";
import { CRAWL_CONFIG } from "./utils";

async function isDisallowed(url: string) {
  // Parse domain
  const domain = new URL(url).hostname;

  // Check robots.txt (simplified)
  try {
    const robotsUrl = `https://${domain}/robots.txt`;
    const robots = await axios.get(robotsUrl, { timeout: 5000 });
    const path = new URL(url).pathname;

    // Simple check (real implementation needs parser library)
    return robots.data.includes(`Disallow: ${path}`);
  } catch {
    // If no robots.txt, assume allowed
    return false;
  }
}

async function fetch_Page(url: string) {
  try {
    if (await isDisallowed(url)) {
      return { success: false, reason: "robots.txt disallowed" };
    }

    const response = await axios.get(url, {
      timeout: CRAWL_CONFIG.REQUEST_TIMEOUT_MS,
      headers: {
        "User-Agent": "SearchEngine-Crawler/1.0 (+http://yoursite.com/crawler)",
      },
      maxRedirects: 3,
    });

    return {
      success: true,
      html: response.data,
      url: response.config.url,
      status: response.status,
    };
  } catch (error: unknown) {
    if (axios.isAxiosError(error)) {
      return {
        success: false,
        errorCode: error.code ?? "UNKNOWN_AXIOS_ERROR",
        status: error.response?.status ?? 0,
        url: url,
      };
    }

    if (error instanceof Error) {
      return {
        success: false,
        errorCode: "GENERIC_ERROR",
        message: error.message,
        url: url,
      };
    }
  }
}
