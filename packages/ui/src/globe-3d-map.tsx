"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import dynamic from "next/dynamic";

const Globe = dynamic(() => import("react-globe.gl"), { ssr: false });

export type GlobePoint = {
  city: string;
  country?: string;
  lat: number;
  lng: number;
  scans?: number;
  risk?: number;
  status?: string;
  vertical?: string;
};

export type GlobeRoute = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  label?: string;
  tone?: "info" | "warn" | "success";
};

export function Globe3dMap({
  points = [],
  routes = [],
  width = 600,
  height = 500,
  className = "",
  offset = [0, 0],
  theme = "auto"
}: {
  points?: GlobePoint[];
  routes?: GlobeRoute[];
  width?: number;
  height?: number;
  className?: string;
  offset?: [number, number];
  theme?: "light" | "dark" | "auto";
}) {
  const globeRef = useRef<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isLightTheme, setIsLightTheme] = useState(false);

  useEffect(() => {
    setMounted(true);
    
    if (theme !== "auto") {
      setIsLightTheme(theme === "light");
      return;
    }

    // Theme synchronization
    const root = document.documentElement;
    const syncTheme = () => {
      const explicitTheme = root.getAttribute("data-theme") || root.getAttribute("data-nexid-theme");
      setIsLightTheme(root.classList.contains("theme-light") || explicitTheme === "light");
    };
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-theme", "data-nexid-theme"] });
    return () => observer.disconnect();
  }, [theme]);

  const handleGlobeReady = () => {
    if (globeRef.current) {
      // Center the camera over the Atlantic between Argentina and Europe
      globeRef.current.pointOfView({ lat: 10, lng: -28, altitude: 2.15 }, 0);
      globeRef.current.globeOffset(offset);
      
      const controls = globeRef.current.controls();
      if (controls) {
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.55;
        controls.enableZoom = true;
        controls.enableDamping = true;
        controls.dampingFactor = 0.05;
      }
    }
  };

  // Re-sync controls and camera when theme changes or globe mounts
  useEffect(() => {
    if (mounted && globeRef.current) {
      const timer = setTimeout(() => {
        handleGlobeReady();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [mounted, isLightTheme, offset]);

  // Prevent overlapping labels by deduplicating by city and adjusting coordinates slightly
  const labelPoints = useMemo(() => {
    const unique: Record<string, GlobePoint> = {};
    points.forEach((p) => {
      if (p.city) {
        unique[p.city] = { ...p };
      }
    });
    const list = Object.values(unique);

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const pi = list[i];
        const pj = list[j];
        const dLat = pi.lat - pj.lat;
        const dLng = pi.lng - pj.lng;
        const dist = Math.sqrt(dLat * dLat + dLng * dLng);
        if (dist < 6.0) {
          if (pi.lat >= pj.lat) {
            pi.lat += 2.2;
            pj.lat -= 2.2;
          } else {
            pi.lat -= 2.2;
            pj.lat += 2.2;
          }
          pi.lng -= 1.8;
          pj.lng += 1.8;
        }
      }
    }
    return list;
  }, [points]);

  if (!mounted) {
    return (
      <div 
        className={`relative flex items-center justify-center bg-black/10 rounded-2xl border border-white/5 shadow-2xl p-0 ${className}`}
        style={{ width, height }}
      >
        <div className="text-xs text-slate-400 font-mono animate-pulse">
          Loading 3D Globe...
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`relative select-none flex items-center justify-center overflow-hidden rounded-2xl border border-white/5 shadow-2xl p-0 pointer-events-auto ${className}`}
      style={{ width, height }}
    >
      <div className="absolute top-4 left-4 z-20 text-[10px] text-slate-400 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        🗺️ LIVE TELEMETRY GLOBE3D
      </div>

      <div className="absolute bottom-4 right-4 z-20 text-[9px] text-slate-500 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        Drag to rotate
      </div>

      <Globe
        ref={globeRef}
        width={width}
        height={height}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere={true}
        atmosphereColor={isLightTheme ? "#3b82f6" : "#22d3ee"}
        atmosphereAltitude={0.16}
        globeImageUrl={
          isLightTheme
            ? "//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
            : "//unpkg.com/three-globe/example/img/earth-night.jpg"
        }
        onGlobeReady={handleGlobeReady}
        
        // Points
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={(p: any) => (p.risk || p.status === "risk" ? "#fb7185" : "#22d3ee")}
        pointAltitude={0.035}
        pointRadius={(p: any) => (p.risk || p.status === "risk" ? 0.38 : 0.28)}
        pointsMerge={false}
        
        // Labels
        labelsData={labelPoints}
        labelLat="lat"
        labelLng="lng"
        labelText="city"
        labelColor={() => (isLightTheme ? "#020617" : "#ffffff")}
        labelSize={1.8}
        labelDotRadius={0}
        labelAltitude={0.045}
        
        // Arcs
        arcsData={routes}
        arcStartLat="fromLat"
        arcStartLng="fromLng"
        arcEndLat="toLat"
        arcEndLng="toLng"
        arcColor={(r: any) => (r.tone === "warn" ? "#fb7185" : "#22d3ee")}
        arcDashLength={0.45}
        arcDashGap={0.15}
        arcDashAnimateTime={1800}
        arcStroke={(r: any) => (r.tone === "warn" ? 1.6 : 1.2)}
        arcAltitudeAutoScale={0.4}
      />
    </div>
  );
}
