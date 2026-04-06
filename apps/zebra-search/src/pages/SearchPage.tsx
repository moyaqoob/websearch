import React, { useState, useEffect } from 'react';
import { FilterTab, SourceFilter, SortOrder } from '../types';
import { useSearch, useApiStatus, buildSourceFilters } from '../hooks/useSearch';
import { TopBar } from '../components/layout/TopBar';
import { FilterStrip } from '../components/layout/FilterStrip';
import { ResultCard } from '../components/search/ResultCard';
import { SearchSidebar } from '../components/search/SearchSidebar';
import { LoadingState, ErrorState, EmptyState } from '../components/search/SearchStates';
import styles from '../components/css modules/SearchPage.module.css';

interface Props {
  initialQuery: string;
  onHome: () => void;
}

export function SearchPage({ initialQuery, onHome }: Props) {
  const [query, setQuery]             = useState(initialQuery);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All');
  const [sortOrder, setSortOrder]     = useState<SortOrder>('relevance');
  const [sources, setSources]         = useState<SourceFilter[]>([]);

  const { results, total, loading, error, searchTime } = useSearch(query);
  const { apiStatus } = useApiStatus();

  // Rebuild source filter list whenever results change
  useEffect(() => {
    setSources(buildSourceFilters(results));
  }, [results]);

  const handleSearch = (q: string) => setQuery(q);

  const handleSourceToggle = (index: number) => {
    setSources((prev) =>
      prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s))
    );
  };

  // Apply enabled source filters client-side
  const enabledDomains = new Set(
    sources.filter((s) => s.enabled).map((s) => s.name)
  );
  const visibleResults = sources.length === 0
    ? results
    : results.filter((r) => {
        try {
          const domain = new URL(r.url).hostname.replace(/^www\./, '');
          return enabledDomains.has(domain);
        } catch {
          return true;
        }
      });

  return (
    <div className={styles.page}>
      <TopBar
        query={query}
        total={total}
        searchTime={searchTime}
        apiStatus={apiStatus}
        onSearch={handleSearch}
        onHome={onHome}
      />

      <FilterStrip active={activeFilter} onChange={setActiveFilter} />

      <div className={styles.layout}>
        {/* Results column */}
        <div className={styles.resultsCol}>
          {!loading && !error && visibleResults.length > 0 && (
            <div className={styles.resultsMeta}>
              <p className={styles.resultCount}>
                <strong>{total.toLocaleString()}</strong> results for{' '}
                <span className={styles.queryText}>"{query}"</span>
              </p>
              <select
                className={styles.sortSelect}
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              >
                <option value="relevance">relevance</option>
                <option value="freshness">freshness</option>
                <option value="authority">authority</option>
              </select>
            </div>
          )}

          {loading && <LoadingState />}
          {error   && <ErrorState query={query} apiStatus={apiStatus} />}

          {!loading && !error && visibleResults.length === 0 && (
            <EmptyState query={query} />
          )}

          {!loading && !error && visibleResults.length > 0 && (
            <div className={styles.resultList}>
              {visibleResults.map((result, i) => (
                <ResultCard
                  key={result.url ?? result.id ?? i}
                  result={result}
                  query={query}
                  index={i}
                />
              ))}
            </div>
          )}

          {!loading && visibleResults.length > 0 && (
            <div className={styles.pagination}>
              <div className={`${styles.pageBtn} ${styles.disabled}`}>← prev</div>
              <div className={`${styles.pageBtn} ${styles.active}`}>1</div>
              <div className={`${styles.pageBtn} ${styles.disabled}`}>next →</div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <SearchSidebar
          query={query}
          sources={sources}
          apiStatus={apiStatus}
          onRelatedClick={handleSearch}
          onSourceToggle={handleSourceToggle}
        />
      </div>
    </div>
  );
}
