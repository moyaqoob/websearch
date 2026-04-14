import React from "react";
import { SourceFilter, ApiStatus } from "../../types";
import { API_BASE } from "../../lib/constants";
import { getRelatedQueries } from "../../lib/utils";
import { ApiStatusBadge } from "../ui/ApiStatusBadge";
import styles from "../css-modules/SearchSidebar.module.css";

interface Props {
  query: string;
  sources: SourceFilter[];
  apiStatus: ApiStatus;
  onRelatedClick: (q: string) => void;
  onSourceToggle: (index: number) => void;
}

export function SearchSidebar({
  query,
  sources,
  apiStatus,
  onRelatedClick,
  onSourceToggle,
}: Props) {
  const related = getRelatedQueries(query);

  return (
    <aside className={styles.sidebar}>
      {/* Related searches */}
      <section
        className={`${styles.section} fade-up`}
        style={{ animationDelay: "0.1s" }}
      >
        <h4 className={styles.sectionTitle}>Related</h4>
        <div className={styles.relatedList}>
          {related.map((r) => (
            <button
              key={r}
              className={`${styles.relatedItem} rel-item`}
              onClick={() => onRelatedClick(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </section>

      {/* Source filters — only shown when there are results */}
      {sources.length > 0 && (
        <section
          className={`${styles.section} fade-up`}
          style={{ animationDelay: "0.18s" }}
        >
          <h4 className={styles.sectionTitle}>Sources in results</h4>
          <div className={styles.sourceList}>
            {sources.map((s, i) => (
              <button
                key={s.name}
                className={`${styles.sourceItem} sf-item ${s.enabled ? styles.checked : ""}`}
                onClick={() => onSourceToggle(i)}
              >
                <div className={styles.checkbox}>{s.enabled ? "✓" : ""}</div>
                <span className={styles.sourceName}>{s.name}</span>
                <span className={styles.sourceCount}>{s.count}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* API info */}
      <section
        className={`${styles.section} fade-up`}
        style={{ animationDelay: "0.26s" }}
      >
        <h4 className={styles.sectionTitle}>API</h4>
        <div className={styles.apiCard}>
          <div className={styles.apiRow}>
            <span className={styles.apiLabel}>endpoint</span>
            <span className={styles.apiValue}>{API_BASE}/search</span>
          </div>
          <div className={styles.apiRow}>
            <span className={styles.apiLabel}>status</span>
            <ApiStatusBadge status={apiStatus} />
          </div>
        </div>
      </section>
    </aside>
  );
}
