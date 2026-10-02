import styles from "./sun-brand-identity.module.css";

// The existing Ni artwork, rendered without a client animation dependency.
// Also used by the server-rendered pending view so the identity stays familiar.
export function SunBrandIdentity() {
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
