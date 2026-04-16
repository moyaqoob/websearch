import { useState, useEffect } from 'react';
import { SearchResult, ApiStatus } from '../types';
import { API_BASE } from '../lib/constants';
import { getDomain } from '../lib/utils';

interface UseSearchResult {
  results: SearchResult[];
  total: number;
  loading: boolean;
  error: boolean;
  searchTime: string | null;
}

export function useSearch(query: string): UseSearchResult {
  const [results, setResults]       = useState<SearchResult[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState(false);
  const [searchTime, setSearchTime] = useState<string | null>(null);

  console.log("queryy",query.trim())
  useEffect(() => {
    console.log("this is me")
    if (!query.trim()) return;
    console.log("this is me 2")

    setLoading(true);
    setError(false);

    const t0 = performance.now();
    const controller = new AbortController();
    fetch(`${API_BASE}/search?q=${encodeURIComponent(query.trim())}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        const elapsed = ((performance.now() - t0) / 1000).toFixed(3);
        setSearchTime(elapsed);
        const items: SearchResult[] = Array.isArray(data)
          ? data
          : (data.results ?? data.data ?? []);
        setResults(items);
        setTotal(data.total ?? data.count ?? items.length);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setError(true);
        setLoading(false);
      });

    return () => controller.abort();
  }, [query]);
  console.log("results",results)
  return { results, total, loading, error, searchTime };
}

interface UseApiStatusResult {
  apiStatus: ApiStatus;
}

export function useApiStatus(): UseApiStatusResult {
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');

  useEffect(() => {
    fetch(`${API_BASE}/`, {
      signal: AbortSignal.timeout(3000),
    })
      .then((r) => setApiStatus(r.ok ? 'live' : 'dead'))
      .catch(() => setApiStatus('dead'));
  }, []);

  return { apiStatus };
}

/** Derive source breakdown from a result set. */
export function buildSourceFilters(results: SearchResult[]) {
  const counts: Record<string, number> = {};
  results.forEach((r) => {
    const d = getDomain(r.url);
    counts[d] = (counts[d] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count, enabled: true }));
}
