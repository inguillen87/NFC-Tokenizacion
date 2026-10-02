import { useId } from "react";
import styles from "./sun-brand-identity.module.css";

// The existing Ni artwork, rendered without a client animation dependency.
// Also used by the server-rendered pending view so the identity stays familiar.
export function SunBrandIdentity({ variant = "compact" }: { variant?: "compact" | "passport" }) {
  const artworkId = `sun-${useId().replace(/:/g, "")}`;
  if (variant === "passport") {
    // Same Ni paths and wordmark coordinates as the public BrandMark/Wordmark.
    // Local SVG ids keep concurrent loading/header instances independent.
    return (
      <span className={`${styles.identity} ${styles.passportIdentity}`} data-sun-brand-identity data-sun-brand-variant="passport" aria-hidden="true">
        <span className={styles.markFrame}>
          <svg className={styles.passportMark} viewBox="0 0 160 160" fill="none" focusable="false">
            <defs>
              <linearGradient id={`${artworkId}-face`} x1="20" y1="16" x2="140" y2="144" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--identity-face-hi)" />
                <stop offset="0.42" stopColor="var(--identity-face-mid)" />
                <stop offset="1" stopColor="var(--identity-face-lo)" />
              </linearGradient>
              <linearGradient id={`${artworkId}-edge`} x1="24" y1="22" x2="138" y2="140" gradientUnits="userSpaceOnUse">
                <stop offset="0" stopColor="var(--identity-edge-hi)" />
                <stop offset="0.46" stopColor="var(--identity-accent)" stopOpacity="0.3" />
                <stop offset="1" stopColor="var(--identity-edge-lo)" />
              </linearGradient>
              <clipPath id={`${artworkId}-plate`}><rect x="23" y="22" width="115" height="115" rx="29" /></clipPath>
            </defs>
            <rect x="19" y="19" width="122" height="122" rx="32" className={styles.plateDepth} />
            <rect x="23" y="22" width="115" height="115" rx="29" fill={`url(#${artworkId}-face)`} stroke={`url(#${artworkId}-edge)`} strokeWidth="2" className={styles.plateFace} />
            <path className={styles.circuit} d="M42 52H78C84 52 88 56 88 62V98C88 104 84 108 78 108H42" strokeWidth="2" strokeLinecap="round" />
            <path className={styles.passportOrbit} pathLength="1" d="M112 48C128 54 136 66 136 80C136 95 128 107 112 113" strokeWidth="2" strokeLinecap="round" />
            <path className={styles.letter} d="M47 104V56H58L86 91V56H99V104H88L60 69V104H47Z" />
            <path className={styles.accent} d="M110 56H123V104H110V56Z" />
            <path className={styles.plateLight} d="M38 39C55 25 84 21 112 32" strokeWidth="2" strokeLinecap="round" />
            <path className={styles.circuit} d="M35 121C60 131 98 132 124 115" strokeWidth="2" strokeLinecap="round" />
            <g clipPath={`url(#${artworkId}-plate)`}><path className={styles.scan} d="M24 24L58 20L140 132L108 140Z" /></g>
            <circle className={styles.travellingDot} cx="116.5" cy="40" r="8" />
          </svg>
        </span>
        <svg className={styles.wordArtwork} viewBox="0 0 286 120" fill="none" focusable="false">
          <defs>
            <linearGradient id={`${artworkId}-word`} x1="0" y1="20" x2="170" y2="95" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--identity-ink-hi)" /><stop offset="1" stopColor="var(--identity-ink)" />
            </linearGradient>
            <linearGradient id={`${artworkId}-word-accent`} x1="174" y1="24" x2="278" y2="95" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="var(--identity-edge-hi)" /><stop offset="1" stopColor="var(--identity-accent)" />
            </linearGradient>
          </defs>
          <text x="0" y="78" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fontSize="72" fontWeight="780" letterSpacing="0" fill={`url(#${artworkId}-word)`}>nex</text>
          <text x="154" y="78" fontFamily="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial" fontSize="72" fontWeight="820" letterSpacing="0" fill={`url(#${artworkId}-word-accent)`}>ID</text>
          <ellipse className={styles.wordOrbit} cx="220" cy="41" rx="17" ry="11" strokeWidth="1.5" strokeDasharray="3 3" />
          <g className={styles.wordSatellite}><circle cx="220" cy="30" r="4.4" /></g>
        </svg>
      </span>
    );
  }
  return (
    <span className={styles.identity} data-sun-brand-identity aria-hidden="true">
      <svg className={styles.mark} viewBox="0 0 160 160" fill="none" focusable="false">
        <rect x="3" y="3" width="154" height="154" rx="38" className={styles.face} />
        <rect x="13" y="13" width="134" height="134" rx="30" className={styles.edge} />
        <g transform="translate(-19 -18) scale(1.25)">
          <path className={styles.letter} d="M47 104V56H58L86 91V56H99V104H88L60 69V104H47Z" />
          <path className={styles.accent} d="M110 56H123V104H110V56Z" />
          <circle className={styles.accent} cx="116.5" cy="40" r="7" />
        </g>
        <path className={styles.orbit} pathLength="1" d="M132 48C144 67 144 91 132 112" />
        <path className={styles.light} d="M28 31C53 16 90 16 115 26" />
      </svg>
      <span className={styles.word}>nex<span>ID</span></span>
    </span>
  );
}
