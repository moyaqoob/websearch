import React, { useState, useCallback } from 'react';
import { LandingPage } from './pages/LandingPage';
import { SearchPage } from './pages/SearchPage';
import { useCursor } from './hooks/useCursor';

type Page = 'landing' | 'search';

export function App() {
  const [page, setPage]   = useState<Page>('landing');
  const [query, setQuery] = useState('');

  useCursor('cursor');
  const handleSearch = useCallback((q: string) => {
    setQuery(q);
    setPage('search');
  }, []);

  const handleHome = useCallback(() => {
    setPage('landing');
  }, []);

  return (
    <>
      {/* Custom cursor */}
      <div className="cursor" id="cursor" />
      {/* Noise texture overlay */}
      <div className="noise" />

      {page === 'landing' ? (
        <LandingPage onSearch={handleSearch} />
      ) : (
        <SearchPage initialQuery={query} onHome={handleHome} />
      )}
    </>
  );
}
