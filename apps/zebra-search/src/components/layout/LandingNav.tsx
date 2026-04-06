import React from 'react';
import styles from './LandingNav.module.css';

interface Props {
  onTrySearch: () => void;
}

export function LandingNav({ onTrySearch }: Props) {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🦓</div>
        zebra
      </div>
      <div className={styles.links}>
        <button className={styles.link}>About</button>
        <button className={styles.link}>Sources</button>
        <button className={styles.link}>Blog</button>
        <button className={`${styles.link} ${styles.cta}`} onClick={onTrySearch}>
          Try Search →
        </button>
      </div>
    </nav>
  );
}
