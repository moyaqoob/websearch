import { FEATURES } from "../../lib/constants";
import styles from "../css-modules/FeaturesGrid.module.css";

export function FeaturesGrid() {
  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <div>
          <div className={styles.tag}>Why Zebra</div>
          <h2 className={styles.title}>
            Built different.
            <br />
            On purpose.
          </h2>
        </div>
        <p className={styles.desc}>
          Most search engines are optimized for engagement. Zebra is optimized
          for engineers who know what they're looking for — with zero tolerance
          for noise.
        </p>
      </div>

      <div className={styles.grid}>
        {FEATURES.map((f) => (
          <div
            key={f.title}
            className={`${styles.card} feat-card`}
            data-color={f.color}
          >
            <div className={`${styles.icon} ${styles[`icon_${f.color}`]}`}>
              {f.icon}
            </div>
            <h3 className={styles.cardTitle}>{f.title}</h3>
            <p className={styles.cardDesc}>{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
