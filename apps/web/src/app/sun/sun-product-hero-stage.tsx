"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { Globe3dMap } from "@product/ui/globe-3d-map";
import { PremiumVectorMap, type VectorMapPoint, type VectorMapRoute } from "@product/ui/premium-vector-map";
import type { ProductInteractionState, ProductKind } from "../../components/hero-three-stage";
import { getSunHeroTraceCopy } from "./sun-hero-truth-copy";
import { useSunLocale } from "./sun-locale-provider";

const HeroThreeStage = dynamic(() => import("../../components/hero-three-stage").then((mod) => mod.HeroThreeStage), {
  ssr: false,
});

export type SunVisualKind = "wine" | "creamJar" | "perfume" | "creamTube" | "bracelet" | "ticket" | "seeds" | "sneaker" | "apparel";

type SunProductHeroStageProps = {
  kind: SunVisualKind;
  productName: string;
  imageUrl?: string | null;
  originDisplay: string;
  tapDisplay: string;
  distanceDisplay: string;
  state: ProductInteractionState;
  originLat?: number | null;
  originLng?: number | null;
  tapLat?: number | null;
  tapLng?: number | null;
  isDemoPreview: boolean;
};

function toThreeKind(kind: SunVisualKind): ProductKind {
  if (kind === "bracelet") return "bracelet";
  if (kind === "ticket") return "ticket";
  if (kind === "seeds") return "seeds";
  if (kind === "creamJar") return "creamJar";
  if (kind === "perfume") return "perfume";
  if (kind === "creamTube") return "creamTube";
  return "wine";
}

function shortLocation(value: string) {
  return value.split(",")[0]?.trim() || value || "N/A";
}

function SunProductFallback({ kind, productName }: { kind: SunVisualKind; productName: string }) {
  const isWine = kind === "wine";
  const isCream = kind === "creamJar" || kind === "creamTube";
  const isPerfume = kind === "perfume";
  const isSneaker = kind === "sneaker";
  const isWearable = kind === "bracelet" || kind === "ticket" || kind === "apparel";
  const title = productName.length > 22 ? `${productName.slice(0, 20)}...` : productName;

  return (
    <svg className={`sun-product-fallback sun-product-fallback--${kind}`} viewBox="0 0 360 430" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`sunFallbackGlass-${kind}`} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor={isWine ? "#050303" : isPerfume ? "#dff7ff" : isCream ? "#fdf4ff" : "#0f766e"} />
          <stop offset="48%" stopColor={isWine ? "#3a0909" : isPerfume ? "#4fc3e8" : isCream ? "#e9d5ff" : "#14b8a6"} />
          <stop offset="100%" stopColor={isWine ? "#010101" : isPerfume ? "#075985" : isCream ? "#a78bfa" : "#042f2e"} />
        </linearGradient>
        <linearGradient id={`sunFallbackPaper-${kind}`} x1="0%" x2="100%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#fffaf1" />
          <stop offset="100%" stopColor="#e9dfce" />
        </linearGradient>
        <filter id={`sunFallbackShadow-${kind}`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="24" stdDeviation="18" floodColor="#020617" floodOpacity="0.52" />
        </filter>
      </defs>
      <ellipse cx="180" cy="374" rx="118" ry="28" fill="#22d3ee" opacity="0.16" />

      {isWine ? (
        <g filter={`url(#sunFallbackShadow-${kind})`}>
          <path d="M154 34h52l9 91c2 17 12 28 26 39 15 13 23 32 23 59v102c0 38-27 64-65 64h-38c-38 0-65-26-65-64V223c0-27 8-46 23-59 14-11 24-22 26-39l9-91Z" fill={`url(#sunFallbackGlass-${kind})`} />
          <path d="M154 34h52l5 64h-62l5-64Z" fill="#7f1d1d" />
          <path d="M161 40h39v82h-39z" fill="#fbfaf5" opacity="0.9" />
          <path d="M177 40h8v174h-8z" fill="#22d3ee" opacity="0.78" />
          <path d="M122 201c16-18 36-27 58-27s42 9 58 27v44H122v-44Z" fill="#14532d" opacity="0.42" />
          <path d="M134 242h92c8 0 14 6 14 14v98c0 8-6 14-14 14h-92c-8 0-14-6-14-14v-98c0-8 6-14 14-14Z" fill={`url(#sunFallbackPaper-${kind})`} stroke="#f8fafc" strokeWidth="2" />
          <text x="180" y="275" textAnchor="middle" fill="#1f2937" fontSize="11" fontWeight="800" letterSpacing="1.6">GRAN RESERVA</text>
          <text x="180" y="304" textAnchor="middle" fill="#111827" fontSize="25" fontWeight="900" letterSpacing="2">MALBEC</text>
          <text x="180" y="329" textAnchor="middle" fill="#475569" fontSize="10" fontWeight="800" letterSpacing="1.4">VALLE DE UCO</text>
          <path d="M145 349c28-34 48-34 72 0M137 356c38-26 78-25 91 0" fill="none" stroke="#334155" strokeWidth="1.5" opacity="0.38" />
          <path d="M128 91c-13 62-13 154-4 231" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" opacity="0.11" />
        </g>
      ) : null}

      {isPerfume || isCream ? (
        <g filter={`url(#sunFallbackShadow-${kind})`}>
          <rect x="142" y="54" width="76" height="42" rx="10" fill="#e5e7eb" />
          <rect x="128" y="24" width="104" height="38" rx="10" fill="#f8fafc" opacity={isPerfume ? 1 : 0.68} />
          <path d={isCream ? "M113 144c0-24 20-44 44-44h46c24 0 44 20 44 44v170c0 34-24 58-58 58h-18c-34 0-58-24-58-58V144Z" : "M120 122c0-25 20-45 45-45h30c25 0 45 20 45 45v190c0 30-23 53-53 53h-14c-30 0-53-23-53-53V122Z"} fill={`url(#sunFallbackGlass-${kind})`} />
          <path d="M137 140c-8 64-5 132 10 202" stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.22" />
          <rect x="123" y="222" width="114" height="72" rx="12" fill="#f8fafc" opacity="0.88" />
          <text x="180" y="253" textAnchor="middle" fill="#0f172a" fontSize="16" fontWeight="900" letterSpacing="1.5">{isPerfume ? "PARFUM" : "DERMO"}</text>
          <text x="180" y="275" textAnchor="middle" fill="#334155" fontSize="11" fontWeight="800" letterSpacing="1.2">{isPerfume ? "LIMITED" : "CREMA"}</text>
        </g>
      ) : null}

      {isWearable ? (
        <g filter={`url(#sunFallbackShadow-${kind})`} transform="rotate(-8 180 214)">
          <path d="M63 209c42-58 203-74 257-21 26 26 5 72-34 75-62 5-150 30-216-7-23-13-25-30-7-47Z" fill={`url(#sunFallbackGlass-${kind})`} />
          <rect x="130" y="195" width="100" height="50" rx="13" fill="#04111d" />
          <text x="180" y="227" textAnchor="middle" fill="#ecfeff" fontSize="19" fontWeight="900" letterSpacing="2">{kind === "ticket" ? "VIP" : "NFC"}</text>
          <rect x="244" y="186" width="58" height="82" rx="13" fill="#020617" />
          <circle cx="273" cy="219" r="15" fill="#22d3ee" opacity="0.8" />
        </g>
      ) : null}

      {isSneaker ? (
        <g filter={`url(#sunFallbackShadow-${kind})`} transform="rotate(-8 180 214)">
          <path d="M58 249c38-17 64-41 90-82 13-20 32-28 56-19l31 12c19 7 34 20 45 38l16 26c9 14 20 24 34 30l3 2c18 8 22 31 8 45-15 15-43 27-79 30l-150 12c-38 3-73-12-89-39-11-20 0-45 35-55Z" fill="#f8fafc" />
          <path d="M64 273c59 19 147 21 263 6l14 25c-28 20-66 31-114 33l-113 5c-38 2-70-11-88-35-11-15 3-31 38-34Z" fill="#cbd5e1" />
          <path d="M129 180c32 18 55 34 72 50 26 2 51-1 75-10-11-19-25-33-43-43l-32-16c-27-14-51-7-72 19Z" fill="#e0f2fe" />
          <path d="M119 234c46 9 91 8 136-2" fill="none" stroke="#0f172a" strokeWidth="7" strokeLinecap="round" opacity="0.82" />
          <path d="M148 198l30 36M179 198l29 34M210 201l25 27" fill="none" stroke="#0f172a" strokeWidth="5" strokeLinecap="round" opacity="0.72" />
          <path d="M79 285h246" stroke="#64748b" strokeWidth="8" strokeLinecap="round" opacity="0.75" />
          <rect x="88" y="213" width="82" height="43" rx="12" fill="#f8fafc" stroke="#22d3ee" strokeWidth="3" />
          <text x="129" y="235" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">NEXID</text>
          <text x="129" y="249" textAnchor="middle" fill="#0f172a" fontSize="10" fontWeight="800">NFC TAG</text>
          <circle cx="296" cy="238" r="21" fill="#020617" stroke="#67e8f9" strokeWidth="4" />
          <text x="296" y="243" textAnchor="middle" fill="#ecfeff" fontSize="11" fontWeight="900">NFC</text>
        </g>
      ) : null}

      {kind === "seeds" ? (
        <g filter={`url(#sunFallbackShadow-${kind})`}>
          <path d="M111 72h138c16 0 29 13 29 29v226c0 16-13 29-29 29H111c-16 0-29-13-29-29V101c0-16 13-29 29-29Z" fill="#84cc16" />
          <path d="M104 111h152v57H104z" fill="#f7fee7" />
          <text x="180" y="146" textAnchor="middle" fill="#166534" fontSize="18" fontWeight="900">SEMILLAS</text>
          <rect x="116" y="196" width="128" height="56" rx="14" fill="#14532d" opacity="0.26" />
          <text x="180" y="230" textAnchor="middle" fill="#f7fee7" fontSize="14" fontWeight="900">LOTE A12</text>
        </g>
      ) : null}

      <g transform="translate(180 130) rotate(-9)">
        <rect x="-96" y="-22" width="192" height="44" rx="17" fill="#020617" opacity="0.9" stroke="#22d3ee" strokeWidth="2" />
        <text x="-36" y="5" textAnchor="middle" fill="#ecfeff" fontSize="16" fontWeight="900">NFC</text>
        <text x="42" y="5" textAnchor="middle" fill="#a5f3fc" fontSize="12" fontWeight="900">SUN OK</text>
      </g>
      <text x="180" y="412" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="800">{title}</text>
    </svg>
  );
}

export function SunProductHeroStage({
  kind,
  productName,
  imageUrl,
  originDisplay,
  tapDisplay,
  distanceDisplay,
  state,
  originLat,
  originLng,
  tapLat,
  tapLng,
  isDemoPreview,
}: SunProductHeroStageProps) {
  const { locale } = useSunLocale();
  const [ready, setReady] = useState(false);
  const threeKind = toThreeKind(kind);
  const hasTraceCoordinates = originLat != null && originLng != null && tapLat != null && tapLng != null;
  const traceTone = state === "blocked" ? "warn" : state === "opened" ? "success" : "info";
  const traceCopy = getSunHeroTraceCopy(isDemoPreview, state, locale);
  const tracePoints: VectorMapPoint[] = hasTraceCoordinates
    ? [
        {
          id: "sun-origin",
          label: shortLocation(originDisplay),
          sublabel: traceCopy.originSublabel,
          lat: Number(originLat),
          lng: Number(originLng),
          scans: 0,
          risk: 0,
          tone: "origin",
          stageLabel: traceCopy.originStageLabel,
          evidence: traceCopy.originEvidence,
        },
        {
          id: "sun-current-tap",
          label: shortLocation(tapDisplay),
          sublabel: traceCopy.tapSublabel,
          lat: Number(tapLat),
          lng: Number(tapLng),
          scans: state === "blocked" ? 2 : 1,
          risk: state === "blocked" ? 1 : 0,
          tone: state === "blocked" ? "risk" : "tap",
          stageLabel: traceCopy.tapStageLabel,
          evidence: traceCopy.tapEvidence,
        },
      ]
    : [];
  const traceRoutes: VectorMapRoute[] = hasTraceCoordinates && isDemoPreview
    ? [
        {
          id: "sun-origin-current-tap",
          fromLat: Number(originLat),
          fromLng: Number(originLng),
          toLat: Number(tapLat),
          toLng: Number(tapLng),
          label: traceCopy.routeLabel,
          tone: traceTone,
          distanceLabel: distanceDisplay,
          evidence: traceCopy.routeEvidence,
        },
      ]
    : [];

  useEffect(() => {
    setReady(false);
  }, [threeKind]);

  return (
    <div className={`sun-product-stage sun-product-stage--realtime sun-product-stage--${kind}`}>
      {hasTraceCoordinates ? (
        <div className="sun-stage-real-map flex justify-center items-center overflow-hidden" aria-hidden="true">
          <Globe3dMap
            points={tracePoints.map((p) => ({
              city: p.label,
              country: p.sublabel,
              lat: p.lat,
              lng: p.lng,
              scans: p.scans,
              risk: p.risk,
              vertical: kind === "wine" ? "wine" : "seeds"
            }))}
            routes={traceRoutes.map((r) => ({
              fromLat: r.fromLat,
              fromLng: r.fromLng,
              toLat: r.toLat,
              toLng: r.toLng,
              tone: r.tone === "warn" ? "warn" as const : "info" as const
            }))}
            width={260}
            height={200}
            className="border-0 bg-transparent shadow-none"
          />
        </div>
      ) : isDemoPreview ? (
        <div className="sun-stage-map" aria-hidden="true" data-location-evidence="demo">
          <span className="sun-stage-map__land sun-stage-map__land--origin" />
          <span className="sun-stage-map__land sun-stage-map__land--tap" />
          {isDemoPreview ? <span className="sun-stage-map__route" /> : null}
          <span className="sun-stage-map__route sun-stage-map__route--glow" />
          <span className="sun-stage-map__point sun-stage-map__point--origin" />
          {isDemoPreview ? <span className="sun-stage-map__point sun-stage-map__point--tap" /> : null}
        </div>
      ) : (
        <div
          className="sun-stage-location-empty"
          data-geographic-renderer="none"
          data-location-evidence="absent"
          role="status"
        >
          <span className="sun-stage-location-empty__eyebrow">Ubicación no informada</span>
          <strong>Sin coordenadas observadas</strong>
          <span>No mostramos un mapa, una ruta ni puntos de ejemplo.</span>
        </div>
      )}
      {hasTraceCoordinates || isDemoPreview ? (
        <>
          <span className="sun-stage-pin sun-stage-pin--origin">
            <b>{traceCopy.originPinLabel}</b>
            <em>{shortLocation(originDisplay)}</em>
          </span>
          <span className="sun-stage-pin sun-stage-pin--tap">
            <b>{traceCopy.tapPinLabel}</b>
            <em>{shortLocation(tapDisplay)}</em>
          </span>
        </>
      ) : null}
      {isDemoPreview && hasTraceCoordinates ? <span className="sun-stage-route-label">{distanceDisplay}</span> : null}
      <div className={`sun-three-product-shell${ready ? " sun-three-product-shell--ready" : ""}`}>
        {imageUrl ? (
          <div className={`sun-product-photo-shell sun-product-photo-shell--${state}`}>
            <img src={imageUrl} alt={productName} className="sun-product-photo" />
            <span className="sun-product-photo-seal">
              <b>NFC</b>
              <em>{state === "opened" ? "abierto" : state === "blocked" ? "bloq" : "TT"}</em>
            </span>
          </div>
        ) : (
          <>
            {!ready ? <SunProductFallback kind={kind} productName={productName} /> : null}
            <HeroThreeStage
              active={threeKind}
              product={productName}
              className="sun-three-stage"
              state={state}
              onReady={() => setReady(true)}
            />
          </>
        )}
      </div>
      <div className="sun-tap-wave" />
    </div>
  );
}
