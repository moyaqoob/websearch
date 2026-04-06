import React from 'react';
import { STATS } from '../../lib/constants';
import styles from './StatsBar.module.css';

export function StatsBar() {
  return (
    <div className={styles.bar}>
      {STATS.map(({ num, label }, i) => (
        <React.Fragment key={num}>
          {i > 0 && <div className={styles.sep} />}
          <div className={styles.stat}>
            <span className={styles.num}>{num}</span>
            <span className={styles.label}>{label}</span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}
