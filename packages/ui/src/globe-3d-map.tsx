"use client";

import React, { useEffect, useRef, useState } from "react";

// Representación matricial de baja resolución de la Tierra (64x32)
// '#' representa tierra, ' ' representa agua
const WORLD_MAP_GRID = [
  "                                                                ",
  "                ######   ######     #########                   ",
  "               #######  ######### ############                  ",
  "             ######### ########################                 ",
  "            ########## #########################                ",
  "           ########### #########################     #          ",
  "           ##########   #######################     ###         ",
  "            ########     ####################      #####        ",
  "            #######       #################        ####         ",
  "             ####          #############            ##          ",
  "             ###            ###########                         ",
  "             ##              #########                          ",
  "             #                #######            ####           ",
  "                               #####            ######          ",
  "                                ###            #######          ",
  "                                 #             #######          ",
  "                                                #####           ",
  "             #                                   ###            ",
  "            ###                                                 ",
  "           #####                                                ",
  "          #######                                               ",
  "         #########                                              ",
  "         #########                                              ",
  "          #######                                               ",
  "           #####                                                ",
  "            ###                                                 ",
  "             #                                                  ",
  "                                                                ",
  "                                                                ",
  "         ##############################################         ",
  "         ##############################################         ",
  "                                                                "
];

// Generador de puntos terrestres basados en la matriz
const generateLandPoints = (radius: number) => {
  const points: { x: number; y: number; z: number }[] = [];
  const rows = WORLD_MAP_GRID.length;
  const cols = WORLD_MAP_GRID[0].length;

  for (let r = 0; r < rows; r++) {
    const lat = 90 - (r / rows) * 180;
    const radLat = (lat * Math.PI) / 180;
    const cosLat = Math.cos(radLat);
    const sinLat = Math.sin(radLat);

    for (let c = 0; c < cols; c++) {
      if (WORLD_MAP_GRID[r][c] === "#") {
        const lng = (c / cols) * 360 - 180;
        const radLng = (lng * Math.PI) / 180;

        // Proyección esférica 3D
        points.push({
          x: radius * cosLat * Math.sin(radLng),
          y: radius * sinLat,
          z: radius * cosLat * Math.cos(radLng)
        });
      }
    }
  }

  // Agregar cuadrícula decorativa de paralelos y meridianos (puntos tenues en el océano)
  for (let lat = -70; lat <= 70; lat += 20) {
    const radLat = (lat * Math.PI) / 180;
    const cosLat = Math.cos(radLat);
    const sinLat = Math.sin(radLat);
    for (let lng = -180; lng < 180; lng += 15) {
      const radLng = (lng * Math.PI) / 180;
      points.push({
        x: (radius * 0.99) * cosLat * Math.sin(radLng),
        y: (radius * 0.99) * sinLat,
        z: (radius * 0.99) * cosLat * Math.cos(radLng)
      });
    }
  }

  return points;
};

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
  className = ""
}: {
  points?: GlobePoint[];
  routes?: GlobeRoute[];
  width?: number;
  height?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotation, setRotation] = useState({ y: 0, x: 0.2 });
  const mouseRef = useRef({ isDown: false, startX: 0, startY: 0, rotY: 0, rotX: 0.2 });

  const radius = Math.min(width, height) * 0.38;
  const center = { x: width / 2, y: height / 2 };

  // Inicializar puntos terrestres una única vez
  const landPoints = React.useMemo(() => generateLandPoints(radius), [radius]);

  // Convertir puntos de ciudades a 3D
  const cityPoints3D = React.useMemo(() => {
    return points.map((p) => {
      const radLat = (p.lat * Math.PI) / 180;
      const radLng = (p.lng * Math.PI) / 180;
      return {
        ...p,
        x: radius * Math.cos(radLat) * Math.sin(radLng),
        y: radius * Math.sin(radLat),
        z: radius * Math.cos(radLat) * Math.cos(radLng)
      };
    });
  }, [points, radius]);

  // Rotación y Renderizado continuo
  useEffect(() => {
    let animId: number;
    let autoRotY = rotation.y;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Limpiar lienzo
      ctx.clearRect(0, 0, width, height);

      // Auto-rotar ligeramente si el ratón no está presionado
      if (!mouseRef.current.isDown) {
        autoRotY += 0.0035;
        setRotation((prev) => ({ ...prev, y: autoRotY }));
      } else {
        autoRotY = rotation.y;
      }

      const rotY = rotation.y;
      const rotX = rotation.x;

      const cosY = Math.cos(rotY);
      const sinY = Math.sin(rotY);
      const cosX = Math.cos(rotX);
      const sinX = Math.sin(rotX);

      // Matriz de rotación combinada (Y luego X)
      const projectPoint = (x: number, y: number, z: number) => {
        // Rotación sobre eje Y (Giro)
        const x1 = x * cosY - z * sinY;
        const z1 = x * sinY + z * cosY;

        // Rotación sobre eje X (Inclinación)
        const y2 = y * cosX - z1 * sinX;
        const z2 = y * sinX + z1 * cosX;

        return {
          sx: center.x + x1,
          sy: center.y - y2,
          sz: z2
        };
      };

      // 1. Dibujar aura de la atmósfera terrestre
      const gradGlow = ctx.createRadialGradient(center.x, center.y, radius * 0.95, center.x, center.y, radius * 1.25);
      gradGlow.addColorStop(0, "rgba(34, 211, 238, 0.12)");
      gradGlow.addColorStop(0.5, "rgba(99, 102, 241, 0.04)");
      gradGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
      ctx.fillStyle = gradGlow;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius * 1.3, 0, Math.PI * 2);
      ctx.fill();

      // Dibujar contorno exterior de la esfera
      ctx.strokeStyle = "rgba(34, 211, 238, 0.22)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Renderizar puntos del mapa base terrestre
      landPoints.forEach((pt) => {
        const { sx, sy, sz } = projectPoint(pt.x, pt.y, pt.z);

        // Ocultar si está en la parte trasera de la esfera (sz < 0)
        const isFront = sz >= 0;
        const opacity = isFront ? 0.35 + (sz / radius) * 0.45 : 0.08;
        const size = isFront ? 1.4 : 0.8;

        ctx.fillStyle = isFront ? `rgba(103, 232, 249, ${opacity})` : `rgba(71, 85, 105, ${opacity})`;
        ctx.beginPath();
        ctx.arc(sx, sy, size, 0, Math.PI * 2);
        ctx.fill();
      });

      // 3. Renderizar rutas (Arco 3D curvo que se desplaza)
      routes.forEach((route) => {
        const from = cityPoints3D.find(
          (c) => Math.abs(c.lat - route.fromLat) < 0.1 && Math.abs(c.lng - route.fromLng) < 0.1
        );
        const to = cityPoints3D.find(
          (c) => Math.abs(c.lat - route.toLat) < 0.1 && Math.abs(c.lng - route.toLng) < 0.1
        );

        if (from && to) {
          // Generar arco interpolando puntos
          const steps = 30;
          ctx.beginPath();

          let previousPoint = null;
          let isRouteVisible = false;

          for (let i = 0; i <= steps; i++) {
            const t = i / steps;

            // Interpolación lineal 3D en la esfera
            const px = from.x + (to.x - from.x) * t;
            const py = from.y + (to.y - from.y) * t;
            const pz = from.z + (to.z - from.z) * t;

            // Normalizar y multiplicar por radio + altura del arco
            const len = Math.sqrt(px * px + py * py + pz * pz);
            const altitude = Math.sin(t * Math.PI) * (radius * 0.15); // Altura de arco en 3D
            const factor = (radius + altitude) / len;

            const arcX = px * factor;
            const arcY = py * factor;
            const arcZ = pz * factor;

            const { sx, sy, sz } = projectPoint(arcX, arcY, arcZ);

            if (sz >= -20) {
              isRouteVisible = true;
            }

            if (i === 0) {
              ctx.moveTo(sx, sy);
            } else {
              ctx.lineTo(sx, sy);
            }
          }

          if (isRouteVisible) {
            ctx.strokeStyle = route.tone === "warn" ? "rgba(245, 158, 11, 0.42)" : "rgba(34, 211, 238, 0.42)";
            ctx.lineWidth = 1.2;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]); // Reset
            
            // Dibujar punto móvil (pulso de luz viajando sobre la línea)
            const speedFactor = (Date.now() / 1500) % 1.0;
            const px = from.x + (to.x - from.x) * speedFactor;
            const py = from.y + (to.y - from.y) * speedFactor;
            const pz = from.z + (to.z - from.z) * speedFactor;
            const len = Math.sqrt(px * px + py * py + pz * pz);
            const altitude = Math.sin(speedFactor * Math.PI) * (radius * 0.15);
            const factor = (radius + altitude) / len;

            const pulseProj = projectPoint(px * factor, py * factor, pz * factor);
            
            ctx.fillStyle = route.tone === "warn" ? "#f59e0b" : "#22d3ee";
            ctx.beginPath();
            ctx.arc(pulseProj.sx, pulseProj.sy, 2.5, 0, Math.PI * 2);
            ctx.fill();
            
            // Halo del pulso
            ctx.strokeStyle = route.tone === "warn" ? "rgba(245, 158, 11, 0.4)" : "rgba(34, 211, 238, 0.4)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(pulseProj.sx, pulseProj.sy, 5, 0, Math.PI * 2);
            ctx.stroke();
          }
        }
      });

      // 4. Renderizar puntos de ciudades e hitos interactivos B2B
      cityPoints3D.forEach((city) => {
        const { sx, sy, sz } = projectPoint(city.x, city.y, city.z);

        // Mostrar solo en la cara visible anterior
        if (sz >= -10) {
          const sizeFactor = 2 + (sz / radius) * 2;
          const isRisk = (city.risk || 0) > 0;
          const pointColor = isRisk ? "251, 113, 133" : "34, 211, 238"; // Rojo vs Cian

          // Halo animado del punto
          const pulse = 1 + Math.sin(Date.now() / 250) * 0.25;
          ctx.strokeStyle = `rgba(${pointColor}, ${0.15 + (sz / radius) * 0.35})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(sx, sy, sizeFactor * 2 * pulse, 0, Math.PI * 2);
          ctx.stroke();

          // Centro del punto
          ctx.fillStyle = isRisk ? "#fb7185" : "#22d3ee";
          ctx.beginPath();
          ctx.arc(sx, sy, sizeFactor, 0, Math.PI * 2);
          ctx.fill();

          // Nombre de la Ciudad y Métricas (Vidrio flotante)
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 9px sans-serif";
          ctx.shadowColor = "rgba(0,0,0,0.85)";
          ctx.shadowBlur = 4;
          ctx.fillText(city.city, sx + 8, sy - 2);

          // Detalles secundarios
          ctx.shadowBlur = 0; // Reset
          ctx.fillStyle = isRisk ? "#fca5a5" : "#94a3b8";
          ctx.font = "8px sans-serif";
          const subText = city.vertical ? `${city.vertical.toUpperCase()} • ${city.scans} scans` : `${city.scans} scans`;
          ctx.fillText(subText, sx + 8, sy + 8);
        }
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [rotation, width, height, radius, center, landPoints, cityPoints3D, routes]);

  // Manejo de interacciones de arrastre táctil/mouse para girar el globo
  const handleMouseDown = (e: React.MouseEvent) => {
    mouseRef.current = {
      isDown: true,
      startX: e.clientX,
      startY: e.clientY,
      rotY: rotation.y,
      rotX: rotation.x
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!mouseRef.current.isDown) return;
    const deltaX = e.clientX - mouseRef.current.startX;
    const deltaY = e.clientY - mouseRef.current.startY;

    setRotation({
      y: mouseRef.current.rotY + deltaX * 0.007,
      x: Math.max(-Math.PI / 3, Math.min(Math.PI / 3, mouseRef.current.rotX - deltaY * 0.007))
    });
  };

  const handleMouseUp = () => {
    mouseRef.current.isDown = false;
  };

  return (
    <div 
      className={`relative select-none flex items-center justify-center overflow-hidden bg-black/10 rounded-2xl border border-white/5 shadow-2xl p-4 ${className}`}
      style={{ width, height }}
    >
      {/* Controles interactivos flotantes */}
      <div className="absolute top-4 left-4 z-20 text-[10px] text-slate-400 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        🗺️ LIVE TELEMETRY GLOBE3D
      </div>

      <div className="absolute bottom-4 right-4 z-20 text-[9px] text-slate-500 font-mono pointer-events-none bg-slate-950/80 px-2 py-1 rounded border border-white/5 backdrop-blur">
        Drag to rotate
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="cursor-grab active:cursor-grabbing max-w-full max-h-full"
      />
    </div>
  );
}
