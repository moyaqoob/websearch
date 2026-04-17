import { LandingNav } from '../components/layout/LandingNav';
import { HeroSection } from '../components/landing/HeroSection';
import { StatsBar } from '../components/landing/StatsBar';
import { FeaturesGrid } from '../components/landing/FeaturesGrid';
import { SourcesSection } from '../components/landing/SourcesSection';
import styles from '../components/css-modules/LandingPage.module.css';
import { useNavigate } from 'react-router-dom';
interface Props {
  onSearch: (query: string) => void;
}

export function LandingPage({ onSearch }: Props) {
  const navigate  = useNavigate();


  return (
    <div className={styles.page}>
      {/* Animated background */}
      <div className={styles.stripes} />
      <div className={`${styles.orb} ${styles.orb1}`} />
      <div className={`${styles.orb} ${styles.orb2}`} />
      <div className={`${styles.orb} ${styles.orb3}`} />

      <LandingNav onTrySearch={() => navigate("/search")} />
      <HeroSection onSearch={onSearch} />
      <StatsBar />
      <FeaturesGrid />
      <SourcesSection />

      {/* CTA */}
      <section className={styles.cta}>
        <div className={styles.ctaGlow} />
        <div className={styles.ctaInner}>
          <h2 className={styles.ctaTitle}>Start searching.</h2>
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
