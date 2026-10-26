"use client";

import { useState } from "react";
import { fanTier } from "@/lib/scoring";
import type { Scores } from "@/lib/types";
import { A24CtaButton } from "@/components/a24-cta-button";
import styles from "./end-screen.module.css";

interface EndScreenProps {
  scores: Scores;
  onRestart: () => void;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Reveals the final scores on a paper insert inside an interactive A24 sleeve. */
export function EndScreen({ scores, onRestart }: EndScreenProps) {
  const [isOpen, setIsOpen] = useState(false);
  const tier = fanTier(scores);
  const total = scores.locationTotal + scores.crosswordTotal;
  const correct = scores.location + scores.crossword;

  return (
    <section className={styles.results} data-open={isOpen} aria-label="Game results">
      <p className={styles.intro}>The oracle has spoken.</p>
      <div className={styles.stage}>
        <article
          id="results-paper"
          className={styles.paper}
          inert={!isOpen}
          aria-hidden={!isOpen}
        >
          <p className={styles.paperLabel}>Your tier</p>
          <h1 className={styles.title}>{tier.title}</h1>
          <p className={styles.blurb}>{tier.blurb}</p>
          <dl className={styles.stats}>
            <Stat label="Locations" value={`${scores.location}/${scores.locationTotal}`} />
            <Stat label="Crossword" value={`${scores.crossword}/${scores.crosswordTotal}`} />
            <Stat label="Overall" value={`${correct}/${total}`} />
          </dl>
          <p className={styles.signoff}>Yours, A24</p>
        </article>
        <button
          type="button"
          className={styles.sleeve}
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-controls="results-paper"
          aria-label={isOpen ? "Close results envelope" : "Open results envelope"}
        >
          <span className={styles.logo} aria-hidden="true" />
        </button>
      </div>
      <div className={styles.actions}>
        {isOpen ? (
          <A24CtaButton onClick={onRestart}>Consult the oracle again</A24CtaButton>
        ) : (
          <p className={styles.hint}>A little something for you. Click to open.</p>
        )}
      </div>
    </section>
  );
}
