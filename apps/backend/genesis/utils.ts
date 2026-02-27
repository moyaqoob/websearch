export const CRAWL_CONFIG = {
    MAX_CONCURRENT_CRAWLS: 3,      // Don't hammer servers
    REQUEST_TIMEOUT_MS: 10000,     // 10 second timeout
    CRAWL_DELAY_MS: 2000,          // 2 second delay between requests
    MAX_PAGES_PER_DOMAIN: 500,     // Max pages from one site
    MIN_CONTENT_LENGTH: 300,       // Minimum article length
  };