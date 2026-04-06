import React, { useState } from 'react';
import { SEARCH_HINTS } from '../../lib/constants';
import { SearchIcon } from '../ui/SearchIcon';
import styles from './HeroSection.module.css';

interface Props {
  onSearch: (query: string) => void;
}

export function HeroSection({ onSearch }: Props) {
  const [query, setQuery] = useState('');

  const go = () => {
    if (query.trim()) onSearch(query.trim());
  };

  return (
    <div className={styles.hero}>
      <div className={styles.inner}>
        <div className={`${styles.badge} fade-up`}>
          <span className={styles.badgeDot} />
          Precision Search for Engineers
        </div>

        <h1 className={`${styles.title} fade-up`} style={{ animationDelay: '0.08s' }}>
          <span className={styles.titleLine1}>Cut Through</span>
          <span className={styles.titleLine2}>The Noise.</span>
        </h1>

        <p className={`${styles.sub} fade-up`} style={{ animationDelay: '0.16s' }}>
          A search engine built for DSA, algorithms, and system design.
          No SEO junk. No sponsored results. Just signal.
        </p>

        <div className={`${styles.searchWrap} fade-up`} style={{ animationDelay: '0.24s' }}>
          <input
            className={styles.input}
            placeholder="Search algorithms, data structures, system design..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && go()}
          />
          <button className={styles.btn} onClick={go}>
            <SearchIcon />
          </button>
        </div>

        <div className={`${styles.hints} fade-up`} style={{ animationDelay: '0.32s' }}>
          <span className={styles.hintLabel}>try:</span>
          {SEARCH_HINTS.map((h) => (
            <span key={h} className={`${styles.hintChip} hint-chip`} onClick={() => setQuery(h)}>
              {h}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
