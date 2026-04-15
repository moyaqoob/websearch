import styles from "../css-modules/LandingNav.module.css";

interface Props {
  onTrySearch: () => void;
}

export function LandingNav({ onTrySearch }: Props) {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>🦓</div>
        zebra search
      </div>
      <div className={styles.links}>
        <button
          className={`${styles.link} ${styles.cta}`}
          onClick={onTrySearch}

        >
          Try Search →
        </button>
      </div>
    </nav>
  );
}
