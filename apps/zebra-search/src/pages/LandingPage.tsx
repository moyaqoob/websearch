import { LandingNav } from '../components/layout/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { StatsBar } from '../components/landing/StatsBar';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { SourcesSection } from '../components/landing/SourcesSection';
import styles from '../css modules/LandingPage.module.css';

interface Props {
  onSearch: (query: string) => void;
}

export function LandingPage({ onSearch }: Props) {
  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div className={styles.stripes} />
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />

      <LandingNav onTrySearch={() => onSearch('segment tree')} />
      <HeroSection onSearch={onSearch} />
      <StatsBar />
      <FeaturesGrid />
      <SourcesSection />

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaGlow} />
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Start<br />searching.</h2>
          <p className={styles.ctaDesc}>No account. No setup. Just type what you need and find it.</p>
          <button className={styles.ctaBtn} onClick={() => onSearch('consistent hashing')}>
            Open Search
            <span className={styles.ctaArrow}>→</span>
          </button>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>© 2025 Zebra Search — <span className={styles.footerMuted}>precision over noise</span></span>
        <div className={styles.footerLinks}>
          <button>Privacy</button>
          <button>About</button>
          <button>Status</button>
        </div>
      </footer>
    </div>
  );
}
