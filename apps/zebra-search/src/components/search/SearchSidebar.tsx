import { SourceFilter, ApiStatus } from "../../types";
import { getRelatedQueries } from "../../lib/utils";
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
    </aside>
  );
}
