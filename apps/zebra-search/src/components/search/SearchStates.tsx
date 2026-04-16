import { ApiStatus } from "../../types";
import styles from "../css-modules/SearchStates.module.css";

export function LoadingState() {
  return (
    <div className={styles.container}>
      <div className={styles.loader}>
        <div className={styles.dot} />
        <div className={styles.dot} />
        <div className={styles.dot} />
      </div>
      <p className={styles.loadingText}>searching corpus...</p>
    </div>
  );
}

interface ErrorProps {
  query: string;
  apiStatus: ApiStatus;
}

export function ErrorState({ query, apiStatus }: ErrorProps) {
  const isOffline = apiStatus === "dead";
  return (
    <div className={styles.container}>
      <div className={styles.icon}>{isOffline ? "🔌" : "⚠️"}</div>
      <h3 className={styles.title} style={{ color: "var(--magenta)" }}>
        {isOffline ? "API offline" : "Search failed"}
      </h3>
      <p className={styles.desc}>
        {isOffline
          ? "Can't reach the Zebra Search API. Make sure your indexer is running."
          : `Something went wrong while searching for "${query}".`}
      </p>
      <code className={styles.hint}>
        {isOffline
          ? `$ bun run src/index.ts   # in apps/indexer`
          : "Check the indexer logs for details"}
      </code>
    </div>
  );
}

interface EmptyProps {
  query: string;
}

export function EmptyState({ query }: EmptyProps) {
  if (!query) {
    return (
      <div className={styles.container}>
        <div className={styles.icon}>🦓</div>
        <h3 className={styles.title}>Ready to search</h3>
        <p className={styles.desc}>Type a query above to search the corpus.</p>
      </div>
    );
  }
  return (
    <div className={styles.container}>
      <div className={styles.icon}>🔍</div>
      <h3 className={styles.title}>No results for "{query}"</h3>
      <p className={styles.desc}>
        Try a different query or check that the corpus has been indexed.
      </p>
    </div>
  );
}
