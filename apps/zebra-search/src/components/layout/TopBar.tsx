import { useRef } from "react";
import { ApiStatus } from "../../types";
import { SearchIcon } from "../ui/SearchIcon";
import { ApiStatusBadge } from "../ui/ApiStatusBadge";
import styles from "../css-modules/TopBar.module.css";

interface Props {
  query: string;
  total: number;
  searchTime: string | null;
  apiStatus: ApiStatus;
  onSearch: (q: string) => void;
  onHome: () => void;
}

export function TopBar({
  query,
  total,
  searchTime,
  apiStatus,
  onSearch,
  onHome,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = () => {
    const val = inputRef.current?.value.trim();
    if (val) onSearch(val);
  };

  return (
    <header className={styles.topbar}>
      <button className={styles.logo} onClick={onHome}>
        <div className={styles.logoIcon}>🦓</div>
        zebra
      </button>

      <div className={styles.searchBar}>
        <input
          ref={inputRef}
          className={styles.input}
          defaultValue={query}
          placeholder="Search..."
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
        <button className={styles.btn} onClick={submit}>
          <SearchIcon size={12} />
        </button>
      </div>

      <div className={styles.spacer} />

      <div className={styles.meta}>
        {searchTime && (
          <>
            <span>
              <strong>{total.toLocaleString()}</strong> results
            </span>
            <span>{searchTime}s</span>
          </>
        )}
        <ApiStatusBadge status={apiStatus} />
      </div>
    </header>
  );
}
