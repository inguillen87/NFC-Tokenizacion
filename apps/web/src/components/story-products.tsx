import type { ReactElement } from "react";

// Unbranded product illustrations for the scroll story. They are drawings, not
// photographs of real goods, so no third-party brand appears on the home.
export type StoryProductKey = "wine" | "seeds" | "jerrycan" | "perfume" | "pharma";

export const STORY_PRODUCTS: ReadonlyArray<{ key: StoryProductKey; tagTop: string; tagLeft: string; accent: string }> = [
  { key: "wine", tagTop: "56%", tagLeft: "50%", accent: "#f0b35a" },
  { key: "seeds", tagTop: "30%", tagLeft: "50%", accent: "#8fd45a" },
  { key: "jerrycan", tagTop: "52%", tagLeft: "46%", accent: "#60a5fa" },
  { key: "perfume", tagTop: "66%", tagLeft: "50%", accent: "#c4a1ff" },
  { key: "pharma", tagTop: "40%", tagLeft: "50%", accent: "#2fe1c3" },
];

function Wine({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 420" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#0b0f14" /><stop offset=".28" stopColor="#3a1f2c" /><stop offset=".5" stopColor="#141a22" /><stop offset=".82" stopColor="#2a1620" /><stop offset="1" stopColor="#06080b" /></linearGradient>
        <linearGradient id={`${id}l`} x1="0" x2="1"><stop offset="0" stopColor="#2a2418" /><stop offset=".5" stopColor="#4a3d22" /><stop offset="1" stopColor="#1c1810" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="404" rx="62" ry="9" fill="#000" opacity=".45" />
      <path d="M82 14h36v70c0 26 30 44 30 92v198c0 16-10 24-24 24H76c-14 0-24-8-24-24V176c0-48 30-66 30-92z" fill={`url(#${id}g)`} />
      <path d="M82 14h36v30H82z" fill="#16181c" /><path d="M82 40h36" stroke="#f0b35a" strokeWidth="2" opacity=".8" />
      <path d="M66 190c0-30 14-50 22-70v250c-14 0-22-6-22-18z" fill="#fff" opacity=".08" />
      <rect x="52" y="262" width="96" height="88" fill={`url(#${id}l)`} />
      <path d="M68 286h64M76 302h48M84 316h32" stroke="#f0b35a" strokeWidth="3" strokeLinecap="round" opacity=".85" />
      <path d="M52 262h96M52 350h96" stroke="#f0b35a" strokeWidth="1" opacity=".5" />
    </svg>
  );
}

function Seeds({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 420" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#7a6a48" /><stop offset=".35" stopColor="#d8c59a" /><stop offset=".7" stopColor="#b9a676" /><stop offset="1" stopColor="#6d5e40" /></linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#3f9b3a" /><stop offset="1" stopColor="#1f5f2a" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="404" rx="78" ry="9" fill="#000" opacity=".45" />
      <path d="M30 70c20-10 120-10 140 0l10 300c0 18-14 26-30 26H50c-16 0-30-8-30-26z" fill={`url(#${id}g)`} />
      <path d="M26 58c24-14 124-14 148 0l-4 22c-22-10-118-10-140 0z" fill="#8b7a55" />
      <path d="M30 66h140" stroke="#5d5038" strokeWidth="2" strokeDasharray="5 5" />
      <path d="M22 214h156v112H22z" fill={`url(#${id}b)`} />
      <path d="M100 302c0-30-2-44 0-60m0 28c-16-2-26-12-28-28 16 0 26 10 28 28zm0-12c16-2 26-12 28-28-16 0-26 10-28 28z" fill="none" stroke="#d9f7c6" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M44 350h112M60 366h80" stroke="#5d5038" strokeWidth="4" strokeLinecap="round" opacity=".7" />
      <path d="M40 90c-4 80-6 200-4 290" stroke="#fff" strokeWidth="10" opacity=".12" strokeLinecap="round" />
    </svg>
  );
}

function Jerrycan({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 420" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#9fb4c6" /><stop offset=".3" stopColor="#f3f7fb" /><stop offset=".7" stopColor="#d5e0ea" /><stop offset="1" stopColor="#8296a8" /></linearGradient>
        <linearGradient id={`${id}c`} x1="0" x2="1"><stop offset="0" stopColor="#1d4ed8" /><stop offset=".5" stopColor="#60a5fa" /><stop offset="1" stopColor="#1e3a8a" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="404" rx="80" ry="9" fill="#000" opacity=".45" />
      <rect x="112" y="34" width="46" height="34" rx="6" fill={`url(#${id}c)`} />
      <path d="M116 42h38M116 50h38M116 58h38" stroke="#0b1b4a" strokeWidth="2" opacity=".55" />
      <rect x="118" y="66" width="34" height="14" fill="#c4d2de" />
      <path d="M26 122c0-26 16-44 44-44h92c10 0 16 6 16 16v276c0 16-10 26-26 26H48c-14 0-22-10-22-24z" fill={`url(#${id}g)`} />
      <path d="M44 126c0-14 8-24 24-24h26c8 0 12 6 12 12v20c0 8-6 12-12 12H56c-8 0-12-6-12-12z" fill="#04121a" opacity=".85" />
      <rect x="42" y="176" width="116" height="150" rx="6" fill="#0f2a44" />
      <rect x="42" y="176" width="116" height="26" rx="6" fill="#f2b84b" />
      <path d="M58 290h84M66 306h60" stroke="#cfe5ff" strokeWidth="4" strokeLinecap="round" opacity=".8" />
      <path d="M40 350h120" stroke="#8296a8" strokeWidth="2" opacity=".6" />
      <path d="M164 100v270" stroke="#fff" strokeWidth="6" opacity=".35" strokeLinecap="round" />
    </svg>
  );
}

function Perfume({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 420" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#1a1230" /><stop offset=".45" stopColor="#3b2a66" /><stop offset="1" stopColor="#120c22" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" x2="1"><stop offset="0" stopColor="#0d0818" /><stop offset="1" stopColor="#241840" /></linearGradient>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e7b0" /><stop offset=".5" stopColor="#c9a24b" /><stop offset="1" stopColor="#8a6a22" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="404" rx="80" ry="9" fill="#000" opacity=".45" />
      <path d="M36 96l100-18v318H36z" fill={`url(#${id}g)`} />
      <path d="M136 78l32 16v292l-32 10z" fill={`url(#${id}s)`} />
      <path d="M36 96l100-18 32 16-100 18z" fill="#4b3780" />
      <rect x="50" y="118" width="72" height="262" fill="none" stroke={`url(#${id}f)`} strokeWidth="2" />
      <path d="M86 150l14 22-14 22-14-22z" fill="none" stroke={`url(#${id}f)`} strokeWidth="2.5" />
      <path d="M62 216h48M70 230h32" stroke={`url(#${id}f)`} strokeWidth="3" strokeLinecap="round" />
      <path d="M60 352h52" stroke={`url(#${id}f)`} strokeWidth="2" strokeLinecap="round" opacity=".7" />
      <path d="M44 104v280" stroke="#fff" strokeWidth="4" opacity=".1" />
    </svg>
  );
}

function Pharma({ id }: { id: string }) {
  return (
    <svg viewBox="0 0 200 420" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#dfe9ef" /><stop offset=".5" stopColor="#ffffff" /><stop offset="1" stopColor="#cdd9e2" /></linearGradient>
        <linearGradient id={`${id}s`} x1="0" x2="1"><stop offset="0" stopColor="#9fb1bd" /><stop offset="1" stopColor="#c4d2dc" /></linearGradient>
      </defs>
      <ellipse cx="100" cy="404" rx="84" ry="9" fill="#000" opacity=".45" />
      <path d="M28 130l112-16v282H28z" fill={`url(#${id}g)`} />
      <path d="M140 114l34 14v258l-34 10z" fill={`url(#${id}s)`} />
      <path d="M28 130l112-16 34 14-112 16z" fill="#f4f8fb" />
      <path d="M28 130l112-16v58L28 188z" fill="#0b7f78" />
      <path d="M40 300h88M40 318h64M40 336h76" stroke="#7d93a3" strokeWidth="5" strokeLinecap="round" />
      <rect x="40" y="356" width="46" height="22" rx="4" fill="none" stroke="#7d93a3" strokeWidth="2" />
      <path d="M48 367h30" stroke="#7d93a3" strokeWidth="2" strokeDasharray="3 3" />
      <path d="M36 196v194" stroke="#fff" strokeWidth="5" opacity=".6" />
    </svg>
  );
}

const DRAWINGS: Record<StoryProductKey, (props: { id: string }) => ReactElement> = {
  wine: Wine,
  seeds: Seeds,
  jerrycan: Jerrycan,
  perfume: Perfume,
  pharma: Pharma,
};

export function StoryProduct({ product, idPrefix }: { product: StoryProductKey; idPrefix: string }) {
  const Drawing = DRAWINGS[product];
  return <Drawing id={`${idPrefix}${product}`} />;
}
