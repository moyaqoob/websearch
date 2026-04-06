import React from 'react';
import { SearchResult } from '../../types';
import { getDomain, getUrlPath, getFavLetter, normalizeScore } from '../../lib/utils';
import { Highlight } from '../ui/Highlight';
import styles from './ResultCard.module.css';

interface Props {
  result: SearchResult;
  query: string;
  index: number;
}

export function ResultCard({ result, query, index }: Props) {
  const domain = getDomain(result.url);
  const path   = getUrlPath(result.url);
  const fav    = getFavLetter(result.url);
  const score  = normalizeScore(result.score ?? result.bm25_score ?? result.relevance);
  const snippet = result.description ?? result.snippet ?? result.excerpt;

  const tagClass = (type?: string) => {
    if (!type) return '';
    if (type === 'algorithm' || type === 'competitive') return styles.tagAlgo;
    if (type === 'system_design') return styles.tagSys;
    return styles.tagDsa;
  };

  return (
    <div
      className={`${styles.card} ${index === 0 ? styles.featured : ''}`}
      style={{ animationDelay: `${index * 0.055}s` }}
    >
      {/* source row */}
      <div className={styles.sourceRow}>
        <div className={styles.fav}>{fav}</div>
        <span className={styles.domain}>
          {domain}
          {path && <> › <em className={styles.path}>{path}</em></>}
        </span>
        <div className={styles.score}>
          <div className={styles.scoreBar}>
            <div className={styles.scoreFill} style={{ width: `${score}%` }} />
          </div>
          {score}
        </div>
      </div>

      {/* title */}
      <a href={result.url} target="_blank" rel="noopener noreferrer" className={styles.title}>
        <Highlight text={result.title || domain} query={query} />
      </a>

      {/* snippet */}
      {snippet && (
        <p className={styles.snippet}>
          <Highlight text={snippet} query={query} />
        </p>
      )}

      {/* tags */}
      <div className={styles.tags}>
        {result.domain_type && (
          <span className={`${styles.tag} ${tagClass(result.domain_type)}`}>
            {result.domain_type}
          </span>
        )}
        {result.authority_level && (
          <span className={`${styles.tag} ${styles.tagAlgo}`}>{result.authority_level}</span>
        )}
        {result.content_domain && (
          <span className={styles.tag}>{result.content_domain}</span>
        )}
        {result.tags?.slice(0, 3).map((t) => (
          <span key={t} className={styles.tag}>{t}</span>
        ))}
      </div>
    </div>
  );
}
