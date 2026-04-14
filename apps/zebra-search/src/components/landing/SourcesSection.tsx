import React from "react";
import { CURATED_SOURCES } from "../../lib/constants";
import styles from "../css-modules/SourcesSection.module.css";

export function SourcesSection() {
  return (
    <section className={styles.section}>
      <div className={styles.inner}>
        <div className={styles.text}>
          <div className={styles.tag}>Sources</div>
          <h3 className={styles.title}>Only the sites that matter</h3>
          <p className={styles.desc}>
            Zebra's corpus is handcrafted. Every domain earns its place. If it
            doesn't teach algorithms, design systems, or sharpen engineering
            thinking — it's not in.
          </p>
        </div>
        <div className={styles.logos}>
          {CURATED_SOURCES.map((name) => (
            <div key={name} className={`${styles.pill} src-pill`}>
              <span className={styles.dot} />
              {name}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
