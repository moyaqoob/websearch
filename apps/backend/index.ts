import * as cheerio from 'cheerio'

const EVERY_BASE = 'https://every.to'

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

async function searchEveryTo(query?: string) {
  const html = await fetchHtml(`${EVERY_BASE}/`)
  const $ = cheerio.load(html)

  const results: Array<{
    title: string
    url: string
    author?: string
    column?: string
    date?: string
  }> = []
  const seenUrls = new Set<string>()

  function add(url: string, title: string, meta?: { author?: string; column?: string; date?: string }) {
    const fullUrl = url.startsWith('http') ? url : `${EVERY_BASE}${url}`
    const cleanTitle = title.replace(/\s+/g, ' ').trim().split('\n')[0].trim()
    if (seenUrls.has(fullUrl) || !cleanTitle || cleanTitle.length < 3) return
    seenUrls.add(fullUrl)
    results.push({
      title: cleanTitle,
      url: fullUrl,
      author: meta?.author,
      column: meta?.column,
      date: meta?.date,
    })
  }

  // 1) Explicit article/essay links: h2/h3/h4 with a single link
  $('h2 a[href^="/"], h3 a[href^="/"], h4 a[href^="/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const title = $a.text().trim()
    if (!href || !title) return
    const $parent = $a.closest('article, [class*="card"], [class*="post"], div')
    const author = $parent.find('a[href*="/@"]').first().text().trim() || undefined
    const dateEl = $parent.find('time').first()
    const date = dateEl.attr('datetime') || dateEl.text().trim() || undefined
    add(href, title, { author, date })
  })

  // 2) Links to every.to articles (path with multiple segments, skip /login, /subscribe, etc.)
  $('a[href^="/"]').each((_, el) => {
    const $a = $(el)
    const href = $a.attr('href')
    const title = $a.text().trim()
    if (
      !href ||
      !title ||
      href === '/' ||
      /^\/(login|subscribe|search|newsletter|columnists|podcast|studio|events|consulting|store|about|team|faq|cdn-cgi)/.test(href)
    )
      return
    // Skip generic CTAs
    const low = title.toLowerCase()
    if (/\b(read an article|learn more|try it|explore|see more|latest episodes)\b/i.test(low)) return
    // Looks like an article: e.g. /chain-of-thought/..., /p/..., /c/..., /vibe-check/...
    if (href.split('/').filter(Boolean).length >= 2 && title.length >= 10) {
      add(href, title)
    }
  })

  // Optional text filter
  const filtered = query
    ? results.filter(
        (r) =>
          r.title.toLowerCase().includes(query.toLowerCase()) ||
          (r.author?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
          (r.column?.toLowerCase().includes(query.toLowerCase()) ?? false)
      )
    : results

  return filtered
}

async function crawl() {
  const query = process.argv[2] // e.g. "bun run index.ts Claude"
  const items = await searchEveryTo(query)
  console.log(JSON.stringify(items, null, 2))
  console.log(`\nTotal: ${items.length} items`)
}

crawl().catch((err) => {
  console.error(err)
  process.exit(1)
})