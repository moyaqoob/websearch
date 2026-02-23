

//worker pool that fetches my page (dude its kinda hard)

async function fetch_Page(url:string) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
  
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "MyCrawler/1.0 (contact@email.com)"
        },
        signal: controller.signal
      });
  
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
  
      const contentType = response.headers.get("content-type") || "";
  
      if (!contentType.includes("text/html")) {
        throw new Error("Not HTML");
      }
  
      return await response.text();
    } finally {
      clearTimeout(timeout);
    }
  }