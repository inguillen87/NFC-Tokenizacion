"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import * as THREE from "three";
import { traceabilityGlobePoints } from "../lib/platform-verticals";

export type TraceabilityGlobePoint = {
  city: string;
  country?: string;
  scans?: number;
  risk?: number;
  lat: number;
  lng: number;
  vertical?: string;
  status?: string;
  lastSeen?: string;
};

export type TraceabilityGlobeRoute = {
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
  tone?: "info" | "warn";
  label?: string;
};

type TraceabilityGlobeProps = {
  title?: string;
  subtitle?: string;
  caption?: string;
  points?: readonly TraceabilityGlobePoint[];
  routes?: readonly TraceabilityGlobeRoute[];
  ctaHref?: string;
  ctaLabel?: string;
  className?: string;
  compact?: boolean;
  mapSize?: { width: number; height: number };
  variant?: "default" | "hero" | "panel";
  onPointSelect?: (point: TraceabilityGlobePoint) => void;
};

const fallbackPoints: TraceabilityGlobePoint[] = [
  { city: "Mendoza", country: "Argentina", lat: -32.8895, lng: -68.8458, scans: 4820, risk: 0, status: "origin", vertical: "wine" },
  { city: "Córdoba", country: "Argentina", lat: -31.4201, lng: -64.1888, scans: 1240, risk: 0, status: "tap", vertical: "agro" },
  { city: "São Paulo", country: "Brasil", lat: -23.5505, lng: -46.6333, scans: 2190, risk: 3, status: "risk", vertical: "events" },
  { city: "Miami", country: "Estados Unidos", lat: 25.7617, lng: -80.1918, scans: 3180, risk: 0, status: "export", vertical: "luxury" },
  { city: "Zúrich", country: "Suiza", lat: 47.3769, lng: 8.5417, scans: 980, risk: 0, status: "passport", vertical: "wine" },
  { city: "Madrid", country: "España", lat: 40.4168, lng: -3.7038, scans: 1680, risk: 0, status: "dpp", vertical: "textile" },
];

const fallbackRoutes: TraceabilityGlobeRoute[] = [
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 47.3769, toLng: 8.5417, tone: "info", label: "Exportación premium" },
  { fromLat: -31.4201, fromLng: -64.1888, toLat: -23.5505, toLng: -46.6333, tone: "warn", label: "Alerta de canal" },
  { fromLat: -32.8895, fromLng: -68.8458, toLat: 25.7617, toLng: -80.1918, tone: "info", label: "Ruta retail" },
];

const countryFromCode: Record<string, string> = {
  AR: "Argentina",
  BR: "Brasil",
  CL: "Chile",
  ES: "España",
  FR: "Francia",
  GB: "Reino Unido",
  US: "Estados Unidos",
  UY: "Uruguay",
};

function routeDistanceKm(route: TraceabilityGlobeRoute) {
  const earthRadiusKm = 6371;
  const dLat = ((route.toLat - route.fromLat) * Math.PI) / 180;
  const dLng = ((route.toLng - route.fromLng) * Math.PI) / 180;
  const lat1 = (route.fromLat * Math.PI) / 180;
  const lat2 = (route.toLat * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * earthRadiusKm * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function nearestTracePoint(points: readonly TraceabilityGlobePoint[], lat: number, lng: number) {
  return points.reduce<{ point: TraceabilityGlobePoint | null; distance: number }>(
    (best, point) => {
      const distance = Math.hypot(point.lat - lat, point.lng - lng);
      return distance < best.distance ? { point, distance } : best;
    },
    { point: null, distance: Number.POSITIVE_INFINITY },
  ).point;
}

function determinantAffineShim(this: { determinant?: () => number }) {
  return typeof this?.determinant === "function" ? this.determinant() : 1;
}

function ensureSingleThreeRuntimeCompatibility() {
  const matrixPrototype = (THREE.Matrix4 as unknown as { prototype?: Record<string, unknown> }).prototype;
  if (!matrixPrototype || typeof matrixPrototype.determinantAffine === "function") return;

  try {
    Object.defineProperty(matrixPrototype, "determinantAffine", {
      configurable: true,
      value: determinantAffineShim,
    });
  } catch {
    matrixPrototype.determinantAffine = determinantAffineShim;
  }
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function pointTone(point: TraceabilityGlobePoint) {
  if (point.risk || point.status === "risk") return "#fb7185";
  if (point.status === "origin") return "#34d399";
  if (point.status === "passport") return "#a78bfa";
  return "#22d3ee";
}

function routeTone(route: TraceabilityGlobeRoute) {
  return route.tone === "warn" ? "#fb7185" : "#22d3ee";
}

function createAtlasTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 1536;
  canvas.height = 768;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const ocean = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ocean.addColorStop(0, "#031a2e");
  ocean.addColorStop(0.45, "#06466f");
  ocean.addColorStop(1, "#020617");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(125, 245, 255, 0.14)";
  ctx.lineWidth = 1.3;
  for (let x = 0; x <= canvas.width; x += 96) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  const continents = [
    "M305 260c72-70 164-74 229-31 52 34 53 99 3 135-48 35-43 92-8 140-69 38-158 7-194-64-34-68-98-103-30-180Z",
    "M598 440c72 24 127 94 106 160-27 86-126 96-167 27-39-66-23-145 61-187Z",
    "M765 232c82-52 183-48 265-2 64 36 73 105 16 144-57 40-158 18-211 69-54 52-152 15-157-63-4-55 32-113 87-148Z",
    "M928 401c72-39 167-23 211 45 42 66-4 139-89 151-81 12-150-28-162-93-8-43 8-82 40-103Z",
    "M1130 247c118-54 240-27 307 49 51 58 21 122-59 132-90 11-128-47-207-42-61 4-103-22-112-63-7-32 18-59 71-76Z",
    "M1208 522c84-35 172-4 203 68 25 57-10 105-84 110-87 6-157-46-156-112 0-28 13-51 37-66Z",
  ];

  ctx.fillStyle = "rgba(20, 184, 166, 0.28)";
  ctx.strokeStyle = "rgba(186, 230, 253, 0.42)";
  ctx.lineWidth = 2;
  continents.forEach((path) => {
    const shape = new Path2D(path);
    ctx.fill(shape);
    ctx.stroke(shape);
  });

  const glow = ctx.createRadialGradient(560, 240, 40, 560, 240, 620);
  glow.addColorStop(0, "rgba(255,255,255,.28)");
  glow.addColorStop(0.42, "rgba(34,211,238,.16)");
  glow.addColorStop(1, "rgba(2,6,23,.16)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function createRouteCurve(route: TraceabilityGlobeRoute, radius: number) {
  const from = latLngToVector3(route.fromLat, route.fromLng, radius);
  const to = latLngToVector3(route.toLat, route.toLng, radius);
  const mid = from.clone().add(to).normalize().multiplyScalar(radius * 1.34);
  return new THREE.QuadraticBezierCurve3(from, mid, to);
}

function disposeObject(object: THREE.Object3D) {
  object.traverse((node) => {
    const mesh = node as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
    const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
    geometry?.dispose();
    if (Array.isArray(material)) {
      material.forEach((item) => item.dispose());
    } else {
      material?.dispose();
    }
  });
}

function TraceabilityAtlasScene({
  points,
  routes,
  width,
  height,
  onPointSelect,
}: {
  points: readonly TraceabilityGlobePoint[];
  routes: readonly TraceabilityGlobeRoute[];
  width: number;
  height: number;
  onPointSelect?: (point: TraceabilityGlobePoint) => void;
}) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const pointMeshesRef = useRef<Array<{ mesh: THREE.Mesh; point: TraceabilityGlobePoint }>>([]);
  const [activePoint, setActivePoint] = useState<TraceabilityGlobePoint | null>(null);
  const sceneKey = useMemo(
    () =>
      JSON.stringify({
        points: points.map((point) => [point.city, point.lat, point.lng, point.scans, point.risk, point.status]),
        routes: routes.map((route) => [route.fromLat, route.fromLng, route.toLat, route.toLng, route.tone]),
        width,
        height,
      }),
    [height, points, routes, width],
  );

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    ensureSingleThreeRuntimeCompatibility();

    const radius = 1.72;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, width / Math.max(height, 1), 0.1, 100);
    camera.position.set(0, 0.18, 5.35);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height, false);
    renderer.domElement.dataset.qa = "premium-traceability-atlas-canvas";
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";
    mount.replaceChildren(renderer.domElement);

    const group = new THREE.Group();
    group.rotation.set(-0.16, -0.52, 0.08);
    scene.add(group);

    const ambient = new THREE.AmbientLight(0x9bdcff, 1.45);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(3.2, 2.8, 4.5);
    scene.add(keyLight);
    const rimLight = new THREE.PointLight(0x22d3ee, 16, 9);
    rimLight.position.set(-3.6, 1.2, 2.8);
    scene.add(rimLight);

    const atlasTexture = createAtlasTexture();
    const globeMaterial = new THREE.MeshStandardMaterial({
      map: atlasTexture || undefined,
      color: atlasTexture ? 0xffffff : 0x06466f,
      roughness: 0.82,
      metalness: 0.05,
      emissive: new THREE.Color(0x06263f),
      emissiveIntensity: 0.28,
    });
    const globe = new THREE.Mesh(new THREE.SphereGeometry(radius, 96, 64), globeMaterial);
    group.add(globe);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 1.035, 96, 64),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    group.add(atmosphere);

    const routeMaterials: THREE.LineBasicMaterial[] = [];
    routes.slice(0, 16).forEach((route) => {
      const color = routeTone(route);
      const curve = createRouteCurve(route, radius * 1.01);
      const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(72));
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: route.tone === "warn" ? 0.95 : 0.72,
      });
      routeMaterials.push(material);
      group.add(new THREE.Line(geometry, material));

      const particle = new THREE.Mesh(
        new THREE.SphereGeometry(route.tone === "warn" ? 0.028 : 0.022, 16, 12),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 }),
      );
      particle.userData.curve = curve;
      particle.userData.offset = Math.random();
      group.add(particle);
    });

    pointMeshesRef.current = [];
    points.slice(0, 24).forEach((point) => {
      const color = pointTone(point);
      const scans = Math.max(1, point.scans || 1);
      const size = Math.min(0.095, 0.045 + Math.sqrt(scans) * 0.0025 + (point.risk ? 0.02 : 0));
      const position = latLngToVector3(point.lat, point.lng, radius * 1.035);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(size, 24, 16),
        new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96 }),
      );
      marker.position.copy(position);
      group.add(marker);
      pointMeshesRef.current.push({ mesh: marker, point });

      const ring = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.65, size * 2.55, 34),
        new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: point.risk ? 0.38 : 0.24,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      ring.position.copy(position.clone().normalize().multiplyScalar(radius * 1.042));
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize());
      group.add(ring);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const startedAt = window.performance.now();
    let frameId = 0;
    let disposed = false;

    const setPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / Math.max(rect.height, 1)) * 2 - 1);
    };

    const handlePointerMove = (event: PointerEvent) => {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pointMeshesRef.current.map((item) => item.mesh), false)[0];
      const nextPoint = hit ? pointMeshesRef.current.find((item) => item.mesh === hit.object)?.point || null : null;
      setActivePoint(nextPoint);
      renderer.domElement.style.cursor = nextPoint ? "pointer" : "grab";
    };

    const handlePointerLeave = () => {
      setActivePoint(null);
      renderer.domElement.style.cursor = "grab";
    };

    const handlePointerDown = (event: PointerEvent) => {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(pointMeshesRef.current.map((item) => item.mesh), false)[0];
      const point = hit ? pointMeshesRef.current.find((item) => item.mesh === hit.object)?.point : null;
      if (point) onPointSelect?.(point);
    };

    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("pointerleave", handlePointerLeave);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);

    const animate = () => {
      if (disposed) return;
      const elapsed = (window.performance.now() - startedAt) / 1000;
      group.rotation.y += 0.0026;
      group.children.forEach((child) => {
        const curve = child.userData.curve as THREE.QuadraticBezierCurve3 | undefined;
        if (!curve) return;
        const t = (elapsed * 0.16 + child.userData.offset) % 1;
        child.position.copy(curve.getPoint(t));
      });
      renderer.render(scene, camera);
      frameId = window.requestAnimationFrame(animate);
    };

    animate();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frameId);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener("pointerleave", handlePointerLeave);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      pointMeshesRef.current = [];
      disposeObject(group);
      atlasTexture?.dispose();
      routeMaterials.forEach((material) => material.dispose());
      renderer.dispose();
      mount.replaceChildren();
    };
  }, [height, onPointSelect, points, routes, sceneKey, width]);

  return (
    <div
      className="relative"
      style={{ width: "100%", maxWidth: width, height }}
      data-globe-ready="true"
      data-globe-mode="native-three"
    >
      <div ref={mountRef} className="h-full w-full" aria-hidden="true" />
      {activePoint ? (
        <div className="pointer-events-none absolute left-4 top-4 z-20 max-w-[min(88%,18rem)] rounded-2xl border border-cyan-200/20 bg-slate-950/80 px-3 py-2 text-left shadow-[0_18px_54px_rgba(0,0,0,.34)] backdrop-blur-xl">
          <p className="text-[0.56rem] font-black uppercase tracking-[0.18em] text-cyan-200">
            {activePoint.risk || activePoint.status === "risk" ? "Riesgo operativo" : activePoint.status === "origin" ? "Origen verificado" : "Tap verificado"}
          </p>
          <strong className="mt-1 block text-sm font-black leading-tight text-white">{activePoint.city}</strong>
          <span className="mt-1 block text-[0.66rem] font-bold text-slate-300">
            {activePoint.country || "Ubicacion verificada"} - {(activePoint.scans || 1).toLocaleString("es-AR")} taps
          </span>
        </div>
      ) : null}
    </div>
  );
}

export function PremiumTraceabilityGlobe({
  title = "Mapa 3D de trazabilidad",
  subtitle = "Origen, destino, taps, riesgo y rutas en una vista ejecutiva.",
  caption = "Infraestructura visual para QR, NFC, GS1, UHF, POS y webhooks.",
  points = fallbackPoints,
  routes = fallbackRoutes,
  ctaHref,
  ctaLabel,
  className = "",
  compact = false,
  mapSize,
  variant = "default",
  onPointSelect,
}: TraceabilityGlobeProps) {
  const [liveData, setLiveData] = useState<{
    points: TraceabilityGlobePoint[];
    routes: TraceabilityGlobeRoute[];
  } | null>(null);

  useEffect(() => {
    const isFallbackOrSdk = points === fallbackPoints || points === traceabilityGlobePoints;
    if (!isFallbackOrSdk) return;

    fetch("/api/demo/summary")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.ok && Array.isArray(data.events) && data.events.length > 0) {
          const pointsList: TraceabilityGlobePoint[] = [];
          const routesList: TraceabilityGlobeRoute[] = [];

          const getOrigin = (vertical: string) => {
            if (vertical === "agro" || vertical === "seeds") {
              return { city: "Rosario", country: "Argentina", lat: -32.9442, lng: -60.6505 };
            }
            if (vertical === "fashion" || vertical === "textile") {
              return { city: "Buenos Aires", country: "Argentina", lat: -34.5875, lng: -58.3974 };
            }
            if (vertical === "cosmetics" || vertical === "pharma") {
              return { city: "Santiago", country: "Chile", lat: -33.4489, lng: -70.6693 };
            }
            return { city: "Valle de Uco", country: "Argentina", lat: -33.6131, lng: -69.2075 };
          };

          const uniqueTaps: Record<string, any> = {};
          data.events.forEach((event: any) => {
            const lat = Number(event.lat);
            const lng = Number(event.lng);
            if (Number.isFinite(lat) && Number.isFinite(lng) && event.city) {
              const key = `${event.city}-${event.vertical}`;
              if (!uniqueTaps[key]) {
                uniqueTaps[key] = event;
              }
            }
          });

          const activeEvents = Object.values(uniqueTaps);

          activeEvents.forEach((event: any) => {
            const origin = getOrigin(event.vertical);
            const tapLat = Number(event.lat);
            const tapLng = Number(event.lng);
            const isRisk = /REPLAY|DUPLICATE|TAMPER|INVALID|REVOKED/i.test(event.result || "");

            if (!pointsList.some((p) => p.city === origin.city)) {
              pointsList.push({
                city: origin.city,
                country: origin.country,
                lat: origin.lat,
                lng: origin.lng,
                scans: 1,
                risk: 0,
                status: "origin",
                vertical: event.vertical
              });
            }

            pointsList.push({
              city: event.city,
              country: countryFromCode[String(event.country_code || "").toUpperCase()] || event.country || "",
              lat: tapLat,
              lng: tapLng,
              scans: 1,
              risk: isRisk ? 1 : 0,
              status: isRisk ? "risk" : "tap",
              vertical: event.vertical
            });

            routesList.push({
              fromLat: origin.lat,
              fromLng: origin.lng,
              toLat: tapLat,
              toLng: tapLng,
              tone: isRisk ? "warn" : "info",
              label: `${event.product_name || "Producto"} · ${origin.city} → ${event.city}`
            });
          });

          if (pointsList.length > 0) {
            setLiveData({ points: pointsList, routes: routesList });
          }
        }
      })
      .catch((err) => console.error("Error loading live globe summary:", err));
  }, [points]);

  const safePoints = liveData ? liveData.points : (points.length ? points : fallbackPoints);
  const safeRoutes = liveData ? liveData.routes : (routes.length ? routes : fallbackRoutes);
  const totalScans = safePoints.reduce((acc, point) => acc + (point.scans || 0), 0);
  const totalRisk = safePoints.reduce((acc, point) => acc + (point.risk || 0), 0);
  const regions = new Set(safePoints.map((point) => point.country || point.city)).size;
  const primaryRoute = safeRoutes[0];
  const primaryFrom = primaryRoute ? nearestTracePoint(safePoints, primaryRoute.fromLat, primaryRoute.fromLng) : null;
  const primaryTo = primaryRoute ? nearestTracePoint(safePoints, primaryRoute.toLat, primaryRoute.toLng) : null;
  const primaryDistance = primaryRoute ? Math.round(routeDistanceKm(primaryRoute)).toLocaleString("es-AR") : "";
  const defaultGlobeSize =
    variant === "hero"
      ? compact
        ? { width: 420, height: 260 }
        : { width: 580, height: 360 }
      : variant === "panel"
        ? { width: 620, height: 390 }
      : compact
          ? { width: 420, height: 300 }
          : { width: 720, height: 440 };
  const globeSize = mapSize || defaultGlobeSize;

  return (
    <section
      className={`traceability-globe ${compact ? "traceability-globe--compact" : ""} traceability-globe--${variant} ${className}`}
      aria-label={title}
    >
      <div className="traceability-globe__header">
        <div>
          <p>nexID Global Trust Mesh</p>
          <h2>{title}</h2>
          <span>{subtitle}</span>
        </div>
        <div className="traceability-globe__kpis" aria-label="Indicadores del mapa">
          <strong>{totalScans.toLocaleString("es-AR")}<small>taps</small></strong>
          <strong>{regions}<small>regiones</small></strong>
          <strong>{totalRisk}<small>riesgo</small></strong>
        </div>
      </div>

      <div className="traceability-globe__stage flex justify-center items-center relative">
        <div className="absolute inset-0 flex justify-center items-center z-10 pointer-events-auto">
          <TraceabilityAtlasScene
            points={safePoints}
            routes={safeRoutes}
            width={globeSize.width}
            height={globeSize.height}
            onPointSelect={onPointSelect}
          />
        </div>

        {primaryRoute ? (
          <div className="traceability-globe__routebar">
            <span>Ruta activa</span>
            <strong>
              {primaryFrom?.city || "Origen"} {"->"} {primaryTo?.city || "Tap verificado"}
            </strong>
            <small>Ruta comercial auditada - {primaryDistance} km</small>
          </div>
        ) : null}

        <div className="traceability-globe__floating traceability-globe__floating--left z-20 pointer-events-none">
          <span>Canales</span>
          <strong>QR + NFC + UHF</strong>
          <small>Una arquitectura, muchos soportes.</small>
        </div>
        <div className="traceability-globe__floating traceability-globe__floating--right z-20 pointer-events-none">
          <span>Confianza</span>
          <strong>98.7%</strong>
          <small>Lecturas limpias en ventana activa.</small>
        </div>
      </div>

      <div className="traceability-globe__footer">
        <p>{caption}</p>
        {ctaHref && ctaLabel ? <Link href={ctaHref}>{ctaLabel}</Link> : null}
      </div>
    </section>
  );
}
