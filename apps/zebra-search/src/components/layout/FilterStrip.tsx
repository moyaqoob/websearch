import React from 'react';
import { FilterTab, FILTER_TABS } from '../../lib/constants';
import styles from './FilterStrip.module.css';

// re-export so consumers can import from here
export type { FilterTab };

interface Props {
  active: FilterTab;
  onChange: (tab: FilterTab) => void;
}

export function FilterStrip({ active, onChange }: Props) {
  return (
    <div className={styles.strip}>
      {FILTER_TABS.map((tab, i) => (
        <React.Fragment key={tab}>
          {i === 5 && <div className={styles.sep} />}
          <button
            className={`${styles.btn} ${active === tab ? styles.active : ''}`}
            onClick={() => onChange(tab as FilterTab)}
          >
            {tab}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}
