import { generateAgent } from "../utils/userAgents";

export function generateCrawlerHeaders() {
  return {
    "User-Agent": generateAgent(),
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Connection: "keep-alive",
  };
}

export async function fetcher(url: string) {
  try{
    const headers = generateCrawlerHeaders();
    const parsed = fetch(url, {
      headers,
    });
    console.log("parsed",parsed);
    if(!parsed){
        console.error("parsed data is empty")
    }

    return parsed;
  }catch(e){
    throw new Error("Cannot fetch the page")
  }


}
